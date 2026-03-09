mod vscode_bridge;
mod explorer_bridge;
mod dma_bridge;

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::os::windows::process::CommandExt;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use serde::Deserialize;
use tauri::{AppHandle, Listener, Manager, State};
use vscode_bridge::VsCodeBridge;
use explorer_bridge::ExplorerBridge;
use dma_bridge::DmaBridge;

#[cfg(target_os = "windows")]
fn disable_webview_shortcuts(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|webview| unsafe {
        let core = webview.controller().CoreWebView2().unwrap();
        let settings = core.Settings().unwrap();
        settings.SetAreDevToolsEnabled(false.into()).unwrap();
        settings.SetAreDefaultContextMenusEnabled(false.into()).unwrap();
        settings.SetIsStatusBarEnabled(false.into()).unwrap();
    });
}

const APP_VERSION: &str = "1.0.0";
const VERSION_URL: &str = "https://hosting-sepia-nine.vercel.app/version";

#[derive(Deserialize)]
struct VersionInfo {
    version: String,
    download_url: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LicenseAuthResponse {
    token: String,
    license_key: String,
    display_name: String,
    expires_at: Option<String>,
}

struct LspProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

struct LspState {
    process: Mutex<Option<LspProcess>>,
}

struct VsCodeState {
    bridge: VsCodeBridge,
}

struct ExplorerState {
    bridge: ExplorerBridge,
}

struct DmaState {
    bridge: DmaBridge,
}

fn get_sidecar_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let binary_name = "binaries/luau-lsp-x86_64-pc-windows-msvc.exe";
    let path = resource_path.join(binary_name);

    if !path.exists() {
        let dev_path = std::env::current_dir()
            .map_err(|e| format!("Failed to get current dir: {}", e))?
            .join("src-tauri")
            .join(binary_name);

        if dev_path.exists() {
            return Ok(dev_path);
        }

        return Err(format!("LSP binary not found at {:?} or {:?}", path, dev_path));
    }

    Ok(path)
}

#[tauri::command]
async fn start_lsp(app: AppHandle, state: State<'_, LspState>) -> Result<bool, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if process_guard.is_some() {
        return Ok(true);
    }

    let lsp_path = get_sidecar_path(&app)?;

    let mut child = Command::new(&lsp_path)
        .arg("lsp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn LSP: {}", e))?;

    let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;

    *process_guard = Some(LspProcess {
        child,
        stdin,
        stdout: BufReader::new(stdout),
    });

    Ok(true)
}

#[tauri::command]
async fn stop_lsp(state: State<'_, LspState>) -> Result<bool, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(mut lsp) = process_guard.take() {
        let _ = lsp.child.kill();
    }

    Ok(true)
}

#[tauri::command]
async fn send_lsp_message(state: State<'_, LspState>, message: String) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    let lsp = process_guard
        .as_mut()
        .ok_or("LSP not started")?;

    let content_length = message.len();
    let header = format!("Content-Length: {}\r\n\r\n", content_length);

    lsp.stdin
        .write_all(header.as_bytes())
        .map_err(|e| format!("Failed to write header: {}", e))?;
    lsp.stdin
        .write_all(message.as_bytes())
        .map_err(|e| format!("Failed to write message: {}", e))?;
    lsp.stdin
        .flush()
        .map_err(|e| format!("Failed to flush: {}", e))?;

    let mut headers = HashMap::new();
    loop {
        let mut line = String::new();
        lsp.stdout
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read header line: {}", e))?;

        let line = line.trim();
        if line.is_empty() {
            break;
        }

        if let Some((key, value)) = line.split_once(':') {
            headers.insert(key.trim().to_lowercase(), value.trim().to_string());
        }
    }

    let content_length: usize = headers
        .get("content-length")
        .ok_or("Missing Content-Length header")?
        .parse()
        .map_err(|e| format!("Invalid Content-Length: {}", e))?;

    let mut content = vec![0u8; content_length];
    lsp.stdout
        .read_exact(&mut content)
        .map_err(|e| format!("Failed to read content: {}", e))?;

    String::from_utf8(content).map_err(|e| format!("Invalid UTF-8 response: {}", e))
}

#[tauri::command]
fn lsp_available(app: AppHandle) -> bool {
    get_sidecar_path(&app).is_ok()
}

#[tauri::command]
async fn execute_script(script: String, pids: Option<Vec<u32>>) -> Result<bool, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA environment variable")?;

    let scheduler_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("bin")
        .join("scheduler");

    if !scheduler_dir.exists() {
        return Err("Scheduler folder not found. Is Synapse Z installed?".to_string());
    }

    let content = format!("{}@@FileFullyWritten@@", script);

    let target_pids = pids.unwrap_or_else(|| vec![0]);

    for pid in target_pids {
        let random_name: String = (0..10)
            .map(|_| {
                let idx = rand::random::<usize>() % 62;
                b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[idx] as char
            })
            .collect();

        let file_name = if pid == 0 {
            format!("{}.lua", random_name)
        } else {
            format!("PID{}_{}.lua", pid, random_name)
        };

        let file_path = scheduler_dir.join(file_name);
        std::fs::write(&file_path, &content)
            .map_err(|e| format!("Failed to write script to scheduler: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
async fn handle_attach(_injector_path: Option<String>) -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
fn is_roblox_running() -> bool {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.processes().values().any(|p| {
        let name = p.name().to_string_lossy().to_lowercase();
        name == "robloxplayerbeta.exe" || name == "windows10universal.exe"
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RobloxProcess {
    pid: u32,
    name: String,
}

#[tauri::command]
fn get_roblox_processes() -> Vec<RobloxProcess> {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.processes()
        .iter()
        .filter_map(|(pid, process)| {
            let name = process.name().to_string_lossy().to_lowercase();
            if name == "robloxplayerbeta.exe" || name == "windows10universal.exe" {
                Some(RobloxProcess {
                    pid: pid.as_u32(),
                    name: format!("Roblox (PID {})", pid.as_u32()),
                })
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
async fn reset_hwid() -> Result<String, String> {
    let account_key = read_account_key()?;
    let client = reqwest::Client::new();
    let response = client
        .post("https://z-api.synapse.do/resethwid")
        .header("key", &account_key)
        .header("USER-AGENT", "SYNZ-SERVICE")
        .send()
        .await
        .map_err(|e| format!("HWID reset request failed: {}", e))?;

    match response.status().as_u16() {
        418 => Ok("HWID reset successful".to_string()),
        429 => Err("Reset on cooldown. Try again later.".to_string()),
        403 => Err("Account is blacklisted.".to_string()),
        status => Err(format!("HWID reset failed: HTTP {}", status)),
    }
}

#[tauri::command]
async fn get_account_info() -> Result<AccountInfo, String> {
    let account_key = read_account_key()?;
    let expires_at = fetch_license_expiry(&account_key).await.ok().flatten();

    Ok(AccountInfo {
        key: account_key,
        expires_at,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountInfo {
    key: String,
    expires_at: Option<String>,
}

#[tauri::command]
fn logout_account() -> Result<bool, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;
    let account_key_path = std::path::Path::new(&local_app_data).join("auth_v2.syn");
    if account_key_path.exists() {
        std::fs::remove_file(&account_key_path)
            .map_err(|e| format!("Failed to remove account key: {}", e))?;
    }
    Ok(true)
}

fn read_account_key() -> Result<String, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let account_key_path = std::path::Path::new(&local_app_data).join("auth_v2.syn");
    let key = std::fs::read_to_string(account_key_path)
        .map_err(|_| "Could not find local license account key")?;

    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err("Local license account key is empty".to_string());
    }

    Ok(trimmed)
}

async fn fetch_license_expiry(account_key: &str) -> Result<Option<String>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://z-api.synapse.do/info")
        .header("key", account_key)
        .header("USER-AGENT", "SYNZ-SERVICE")
        .send()
        .await
        .map_err(|e| format!("License info request failed: {}", e))?;

    if response.status().as_u16() != 418 {
        return Err(format!("License info request failed: HTTP {}", response.status()));
    }

    let text = response.text()
        .await
        .map_err(|e| format!("Failed to read license info response: {}", e))?;

    let unix_seconds = text.trim().parse::<i64>()
        .map_err(|e| format!("Invalid license expiry timestamp: {}", e))?;
    let expires_at = chrono::DateTime::<chrono::Utc>::from_timestamp(unix_seconds, 0)
        .ok_or("Invalid expiry date returned by license API")?;

    Ok(Some(expires_at.to_rfc3339()))
}

#[tauri::command]
async fn redeem_license(license: String) -> Result<LicenseAuthResponse, String> {
    let trimmed_license = license.trim().to_string();
    if trimmed_license.is_empty() {
        return Err("License key is required".to_string());
    }

    let account_key = read_account_key()?;
    let client = reqwest::Client::new();
    let response = client
        .post("https://z-api.synapse.do/redeem")
        .header("key", &account_key)
        .header("USER-AGENT", "SYNZ-SERVICE")
        .header("license", &trimmed_license)
        .send()
        .await
        .map_err(|e| format!("License redemption failed: {}", e))?;

    match response.status().as_u16() {
        418 => {
            let body = response.text()
                .await
                .map_err(|e| format!("Failed to read license redemption response: {}", e))?;
            if !body.starts_with("Added") {
                return Err("Invalid license key".to_string());
            }
        }
        403 => return Err("Invalid license key".to_string()),
        status => return Err(format!("License redemption failed: HTTP {}", status)),
    }

    let expires_at = fetch_license_expiry(&account_key).await.ok().flatten();

    Ok(LicenseAuthResponse {
        token: trimmed_license.clone(),
        license_key: trimmed_license,
        display_name: "Licensed User".to_string(),
        expires_at,
    })
}

#[tauri::command]
async fn validate_license_session(_license: Option<String>) -> Result<bool, String> {
    let account_key = match read_account_key() {
        Ok(key) => key,
        Err(_) => return Ok(false),
    };

    Ok(fetch_license_expiry(&account_key).await.is_ok())
}

#[tauri::command]
fn toggle_protection(protection_type: String, enabled: bool) -> Result<bool, String> {
    if enabled {
        println!("active");
    }
    println!("[Protection] {} = {}", protection_type, enabled);
    Ok(enabled)
}

#[tauri::command]
async fn start_vscode_server(state: State<'_, VsCodeState>) -> Result<bool, String> {
    state.bridge.start().await?;
    Ok(true)
}

#[tauri::command]
async fn stop_vscode_server(state: State<'_, VsCodeState>) -> Result<bool, String> {
    state.bridge.stop().await;
    Ok(true)
}

#[tauri::command]
async fn is_vscode_server_running(state: State<'_, VsCodeState>) -> Result<bool, String> {
    Ok(state.bridge.is_running().await)
}

fn check_version_and_update() -> Result<(), String> {
    let response = reqwest::blocking::get(VERSION_URL)
        .map_err(|e| format!("Failed to fetch version: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Version check failed: HTTP {}", response.status()));
    }

    let version_info: VersionInfo = response.json()
        .map_err(|e| format!("Failed to parse version info: {}", e))?;

    if version_info.version != APP_VERSION {
        let current_exe = std::env::current_exe()
            .map_err(|e| format!("Failed to get current exe path: {}", e))?;

        let exe_dir = current_exe.parent()
            .ok_or("Failed to get exe directory")?;

        let exe_name = current_exe.file_name()
            .ok_or("Failed to get exe name")?
            .to_string_lossy();

        let new_exe_path = exe_dir.join(format!("{}.new", exe_name));
        let batch_path = exe_dir.join("_update.bat");

        let download_response = reqwest::blocking::get(&version_info.download_url)
            .map_err(|e| format!("Failed to download update: {}", e))?;

        if !download_response.status().is_success() {
            return Err(format!("Download failed: HTTP {}", download_response.status()));
        }

        let bytes = download_response.bytes()
            .map_err(|e| format!("Failed to read update: {}", e))?;

        std::fs::write(&new_exe_path, &bytes)
            .map_err(|e| format!("Failed to save update: {}", e))?;

        let batch_content = format!(
            "@echo off\r\ntimeout /t 1 /nobreak >nul\r\ndel \"{}\"\r\nmove \"{}\" \"{}\"\r\nstart \"\" \"{}\"\r\ndel \"%~f0\"\r\n",
            current_exe.display(),
            new_exe_path.display(),
            current_exe.display(),
            current_exe.display()
        );

        std::fs::write(&batch_path, &batch_content)
            .map_err(|e| format!("Failed to write update script: {}", e))?;

        Command::new("cmd")
            .args(["/C", &batch_path.to_string_lossy()])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("Failed to launch update script: {}", e))?;

        std::process::exit(0);
    }

    Ok(())
}

#[tauri::command]
fn get_app_version() -> String {
    APP_VERSION.to_string()
}

#[tauri::command]
async fn install_vscode_extension() -> Result<bool, String> {
    let url = "https://raw.githubusercontent.com/orev7s/vault/main/pearl-executor-1.0.0.vsix";

    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let pearl_dir = std::path::Path::new(&local_app_data).join("Synapse Z");
    if !pearl_dir.exists() {
        std::fs::create_dir_all(&pearl_dir)
            .map_err(|e| format!("Failed to create Synapse Z directory: {}", e))?;
    }

    let vsix_path = pearl_dir.join("pearl-executor.vsix");

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to download extension: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download extension: HTTP {}", response.status()));
    }

    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read extension: {}", e))?;

    std::fs::write(&vsix_path, &bytes)
        .map_err(|e| format!("Failed to save extension: {}", e))?;

    let code_path = find_vscode_cli()?;

    let output = Command::new(&code_path)
        .args(["--install-extension", &vsix_path.to_string_lossy()])
        .creation_flags(0x08000000)
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                let _ = Command::new(&code_path)
                    .creation_flags(0x08000000)
                    .spawn();
                Ok(true)
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                Err(format!("Installation failed: {}", stderr))
            }
        }
        Err(e) => {
            Err(format!("Failed to run VS Code CLI: {}", e))
        }
    }
}

fn find_vscode_cli() -> Result<String, String> {
    if let Ok(output) = Command::new("code").arg("--version").creation_flags(0x08000000).output() {
        if output.status.success() {
            return Ok("code".to_string());
        }
    }

    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let program_files = std::env::var("PROGRAMFILES").unwrap_or_default();
    let program_files_x86 = std::env::var("PROGRAMFILES(X86)").unwrap_or_default();
    let user_profile = std::env::var("USERPROFILE").unwrap_or_default();

    let possible_paths = [
        format!("{}\\Programs\\Microsoft VS Code\\bin\\code.cmd", local_app_data),
        format!("{}\\Programs\\Microsoft VS Code\\Code.exe", local_app_data),
        format!("{}\\Microsoft VS Code\\bin\\code.cmd", program_files),
        format!("{}\\Microsoft VS Code\\Code.exe", program_files),
        format!("{}\\Microsoft VS Code\\bin\\code.cmd", program_files_x86),
        format!("{}\\Microsoft VS Code\\Code.exe", program_files_x86),
        format!("{}\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd", user_profile),
        format!("{}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe", user_profile),
    ];

    for path in &possible_paths {
        if std::path::Path::new(path).exists() {
            return Ok(path.clone());
        }
    }

    Err("VS Code is not installed. Please install VS Code first.".to_string())
}

#[tauri::command]
async fn start_explorer_server(state: State<'_, ExplorerState>) -> Result<bool, String> {
    state.bridge.start().await?;
    Ok(true)
}

#[tauri::command]
async fn stop_explorer_server(state: State<'_, ExplorerState>) -> Result<bool, String> {
    state.bridge.stop().await;
    Ok(true)
}

#[tauri::command]
async fn is_explorer_connected(state: State<'_, ExplorerState>) -> Result<bool, String> {
    Ok(state.bridge.is_connected().await)
}

#[tauri::command]
async fn get_explorer_connection_info(state: State<'_, ExplorerState>) -> Result<Option<serde_json::Value>, String> {
    Ok(state.bridge.get_connection_info().await)
}

#[tauri::command]
async fn send_explorer_message(state: State<'_, ExplorerState>, message: String) -> Result<String, String> {
    println!("[Explorer] send_message called: {}", &message[..message.len().min(100)]);

    let mut rx = state.bridge.subscribe().await
        .ok_or("Explorer not connected")?;

    state.bridge.send_message(message.clone()).await?;

    let parsed: serde_json::Value = serde_json::from_str(&message)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    let request_id = parsed.get("requestId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let timeout = tokio::time::Duration::from_secs(10);
    let start = std::time::Instant::now();

    loop {
        if start.elapsed() > timeout {
            return Err("Request timeout".to_string());
        }

        match tokio::time::timeout(tokio::time::Duration::from_millis(100), rx.recv()).await {
            Ok(Ok(response)) => {
                println!("[Explorer] Got response: {}", &response[..response.len().min(100)]);

                if let Some(ref req_id) = request_id {
                    if let Ok(resp_parsed) = serde_json::from_str::<serde_json::Value>(&response) {
                        let resp_req_id = resp_parsed.get("data")
                            .and_then(|d| d.get("requestId"))
                            .and_then(|v| v.as_str());

                        if resp_req_id == Some(req_id.as_str()) {
                            return Ok(response);
                        }
                    }
                } else {
                    return Ok(response);
                }
            }
            Ok(Err(_)) => {
                return Err("Channel closed".to_string());
            }
            Err(_) => {
                continue;
            }
        }
    }
}

#[tauri::command]
fn get_explorer_port() -> u16 {
    21574
}

#[tauri::command]
async fn get_explorer_script() -> Result<String, String> {
    let url = "https://raw.githubusercontent.com/orev7s/vault/refs/heads/main/ws-explorer.lua";

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to fetch explorer script: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch explorer script: HTTP {}", response.status()));
    }

    response.text()
        .await
        .map_err(|e| format!("Failed to read explorer script: {}", e))
}

#[tauri::command]
async fn save_decompiled_script(name: String, content: String) -> Result<String, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let workspace_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("workspace");

    if !workspace_dir.exists() {
        std::fs::create_dir_all(&workspace_dir)
            .map_err(|e| format!("Failed to create workspace directory: {}", e))?;
    }

    let safe_name = name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let file_name = if safe_name.ends_with(".lua") || safe_name.ends_with(".luau") {
        safe_name
    } else {
        format!("{}.lua", safe_name)
    };

    let file_path = workspace_dir.join(&file_name);

    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_all_scripts(scripts: Vec<(String, String)>) -> Result<String, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let dump_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("workspace")
        .join(format!("dump_{}", timestamp));

    std::fs::create_dir_all(&dump_dir)
        .map_err(|e| format!("Failed to create dump directory: {}", e))?;

    let mut saved_count = 0;
    for (path, content) in scripts {
        let safe_path = path
            .replace("game:GetService(\"", "")
            .replace("\")", "")
            .replace([':', '"', '<', '>', '|', '*', '?'], "_")
            .replace('.', "/");

        let file_path = dump_dir.join(format!("{}.lua", safe_path));

        if let Some(parent) = file_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        if std::fs::write(&file_path, &content).is_ok() {
            saved_count += 1;
        }
    }

    Ok(dump_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn open_folder_in_explorer(path: String) -> Result<bool, String> {
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok(true)
}

#[tauri::command]
fn get_workspace_path() -> Result<String, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let workspace_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("workspace");

    if !workspace_dir.exists() {
        std::fs::create_dir_all(&workspace_dir)
            .map_err(|e| format!("Failed to create workspace directory: {}", e))?;
    }

    Ok(workspace_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn get_scripts_path() -> Result<String, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let scripts_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("scripts");

    if !scripts_dir.exists() {
        std::fs::create_dir_all(&scripts_dir)
            .map_err(|e| format!("Failed to create scripts directory: {}", e))?;
    }

    Ok(scripts_dir.to_string_lossy().to_string())
}

#[derive(serde::Serialize, Clone)]
struct WorkspaceEntry {
    name: String,
    path: String,
    is_dir: bool,
    extension: Option<String>,
}

#[tauri::command]
fn read_workspace_dir(dir_path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let path = std::path::Path::new(&dir_path);

    if !path.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<WorkspaceEntry> = vec![];

    let read_dir = std::fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        if let Ok(entry) = entry {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_path = entry.path().to_string_lossy().to_string();
            let is_dir = entry.path().is_dir();
            let extension = if is_dir {
                None
            } else {
                entry.path().extension().map(|e| e.to_string_lossy().to_string())
            };

            entries.push(WorkspaceEntry {
                name: file_name,
                path: file_path,
                is_dir,
                extension,
            });
        }
    }

    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
fn read_workspace_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn get_autoexec_path() -> Result<String, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let autoexec_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("autoexec");

    if !autoexec_dir.exists() {
        std::fs::create_dir_all(&autoexec_dir)
            .map_err(|e| format!("Failed to create autoexec directory: {}", e))?;
    }

    Ok(autoexec_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn add_to_autoexec(script_name: String, content: String) -> Result<bool, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let autoexec_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("autoexec");

    if !autoexec_dir.exists() {
        std::fs::create_dir_all(&autoexec_dir)
            .map_err(|e| format!("Failed to create autoexec directory: {}", e))?;
    }

    let file_path = autoexec_dir.join(&script_name);
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write autoexec script: {}", e))?;

    Ok(true)
}

#[tauri::command]
fn remove_from_autoexec(script_name: String) -> Result<bool, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let autoexec_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("autoexec");

    let file_path = autoexec_dir.join(&script_name);

    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to remove autoexec script: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
fn is_in_autoexec(script_name: String) -> Result<bool, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let autoexec_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("autoexec");

    let file_path = autoexec_dir.join(&script_name);

    Ok(file_path.exists())
}

#[tauri::command]
fn get_autoexec_scripts() -> Result<Vec<String>, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let autoexec_dir = std::path::Path::new(&local_app_data)
        .join("Synapse Z")
        .join("autoexec");

    if !autoexec_dir.exists() {
        return Ok(vec![]);
    }

    let mut scripts = vec![];
    let read_dir = std::fs::read_dir(&autoexec_dir)
        .map_err(|e| format!("Failed to read autoexec directory: {}", e))?;

    for entry in read_dir {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".lua") || name.ends_with(".luau") {
                    scripts.push(name.to_string());
                }
            }
        }
    }

    Ok(scripts)
}

#[tauri::command]
fn load_favorites() -> Result<Vec<String>, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let pearl_dir = std::path::Path::new(&local_app_data).join("Synapse Z");
    if !pearl_dir.exists() {
        std::fs::create_dir_all(&pearl_dir)
            .map_err(|e| format!("Failed to create Synapse Z directory: {}", e))?;
    }

    let favorites_path = pearl_dir.join("favorites.json");

    if !favorites_path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&favorites_path)
        .map_err(|e| format!("Failed to read favorites: {}", e))?;

    let favorites: Vec<String> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse favorites: {}", e))?;

    Ok(favorites)
}

#[tauri::command]
fn save_favorites(favorites: Vec<String>) -> Result<bool, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA")?;

    let pearl_dir = std::path::Path::new(&local_app_data).join("Synapse Z");
    if !pearl_dir.exists() {
        std::fs::create_dir_all(&pearl_dir)
            .map_err(|e| format!("Failed to create Synapse Z directory: {}", e))?;
    }

    let favorites_path = pearl_dir.join("favorites.json");

    let content = serde_json::to_string(&favorites)
        .map_err(|e| format!("Failed to serialize favorites: {}", e))?;

    std::fs::write(&favorites_path, content)
        .map_err(|e| format!("Failed to write favorites: {}", e))?;

    Ok(true)
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<bool, String> {
    let path = std::path::Path::new(&path);

    if path.exists() {
        Command::new("explorer")
            .args(["/select,", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to reveal in explorer: {}", e))?;
    } else if let Some(parent) = path.parent() {
        if parent.exists() {
            Command::new("explorer")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }

    Ok(true)
}

async fn install_vsix(vsix_path: &std::path::Path) -> Result<bool, String> {
    let output = Command::new("code")
        .args(["--install-extension", &vsix_path.to_string_lossy()])
        .creation_flags(0x08000000)
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                Ok(true)
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                if stderr.contains("not recognized") || stderr.contains("not found") {
                    Err("VS Code CLI not found. Please install VS Code first.".to_string())
                } else {
                    Err(format!("Installation failed: {}", stderr))
                }
            }
        }
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                Err("VS Code is not installed or not in PATH. Please install VS Code first.".to_string())
            } else {
                Err(format!("Failed to run VS Code CLI: {}", e))
            }
        }
    }
}

#[tauri::command]
async fn start_dma_server(state: State<'_, DmaState>) -> Result<bool, String> {
    state.bridge.start().await?;
    Ok(true)
}

#[tauri::command]
async fn stop_dma_server(state: State<'_, DmaState>) -> Result<bool, String> {
    state.bridge.stop().await;
    Ok(true)
}

#[tauri::command]
async fn is_dma_connected(state: State<'_, DmaState>) -> Result<bool, String> {
    Ok(state.bridge.is_connected().await)
}

#[tauri::command]
async fn send_dma_script(state: State<'_, DmaState>, script: String) -> Result<bool, String> {
    state.bridge.send_script(script).await?;
    Ok(true)
}

#[tauri::command]
async fn launch_dma_exe(state: State<'_, DmaState>, exe_path: String, auto_close_seconds: u32) -> Result<bool, String> {
    state.bridge.launch_hidden_exe(exe_path, auto_close_seconds).await?;
    Ok(true)
}

#[tauri::command]
fn get_dma_port() -> u16 {
    21575
}

#[tauri::command]
async fn get_roblox_auth_ticket(cookie: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    let csrf_response = client
        .post("https://auth.roblox.com/v1/authentication-ticket")
        .header("Cookie", format!(".ROBLOSECURITY={}", cookie))
        .header("Content-Type", "application/json")
        .header("Referer", "https://www.roblox.com")
        .send()
        .await
        .map_err(|e| format!("CSRF request failed: {}", e))?;

    let csrf_token = csrf_response
        .headers()
        .get("x-csrf-token")
        .ok_or("No CSRF token returned")?
        .to_str()
        .map_err(|_| "Invalid CSRF token")?
        .to_string();

    let ticket_response = client
        .post("https://auth.roblox.com/v1/authentication-ticket")
        .header("Cookie", format!(".ROBLOSECURITY={}", cookie))
        .header("Content-Type", "application/json")
        .header("x-csrf-token", &csrf_token)
        .header("Referer", "https://www.roblox.com")
        .send()
        .await
        .map_err(|e| format!("Auth ticket request failed: {}", e))?;

    if !ticket_response.status().is_success() {
        return Err(format!("Auth ticket failed: HTTP {}", ticket_response.status()));
    }

    let ticket = ticket_response
        .headers()
        .get("rbx-authentication-ticket")
        .ok_or("No auth ticket in response")?
        .to_str()
        .map_err(|_| "Invalid auth ticket")?
        .to_string();

    Ok(ticket)
}

#[tauri::command]
fn open_roblox_url(url: String) -> Result<bool, String> {
    Command::new("cmd")
        .args(["/C", "start", "", &url])
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(true)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RobloxUserInfo {
    id: u64,
    name: String,
    display_name: String,
}

#[tauri::command]
async fn fetch_roblox_user_from_cookie(cookie: String) -> Result<RobloxUserInfo, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://users.roblox.com/v1/users/authenticated")
        .header("Cookie", format!(".ROBLOSECURITY={}", cookie))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Invalid cookie (HTTP {})", response.status()));
    }

    let info: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(RobloxUserInfo {
        id: info["id"].as_u64().unwrap_or(0),
        name: info["name"].as_str().unwrap_or("").to_string(),
        display_name: info["displayName"].as_str().unwrap_or("").to_string(),
    })
}

#[tauri::command]
async fn fetch_roblox_avatar(user_id: u64) -> Result<String, String> {
    let url = format!(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={}&size=150x150&format=Png&isCircular=false",
        user_id
    );
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Ok(String::new());
    }

    let json: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(json["data"][0]["imageUrl"].as_str().unwrap_or("").to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RobloxGameInfo {
    universe_id: u64,
    name: String,
    thumbnail_url: String,
}

#[tauri::command]
async fn fetch_roblox_game_details(place_id: u64) -> Result<RobloxGameInfo, String> {
    let uni_url = format!("https://apis.roblox.com/universes/v1/places/{}/universe", place_id);
    let uni_response = reqwest::get(&uni_url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !uni_response.status().is_success() {
        return Err("Invalid place ID".to_string());
    }

    let uni_json: serde_json::Value = uni_response.json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let universe_id = uni_json["universeId"].as_u64()
        .ok_or("Could not get universe ID")?;

    let game_url = format!("https://games.roblox.com/v1/games?universeIds={}", universe_id);
    let game_response = reqwest::get(&game_url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let game_json: serde_json::Value = game_response.json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let name = game_json["data"][0]["name"].as_str()
        .unwrap_or("Unknown Game")
        .to_string();

    let thumb_url = format!(
        "https://thumbnails.roblox.com/v1/games/icons?universeIds={}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false",
        universe_id
    );
    let thumb_response = reqwest::get(&thumb_url).await;
    let thumbnail_url = match thumb_response {
        Ok(resp) if resp.status().is_success() => {
            let tj: serde_json::Value = resp.json().await.unwrap_or_default();
            tj["data"][0]["imageUrl"].as_str().unwrap_or("").to_string()
        }
        _ => String::new(),
    };

    Ok(RobloxGameInfo {
        universe_id,
        name,
        thumbnail_url,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(LspState {
            process: Mutex::new(None),
        })
        .manage(VsCodeState {
            bridge: VsCodeBridge::new(),
        })
        .manage(ExplorerState {
            bridge: ExplorerBridge::new(),
        })
        .manage(DmaState {
            bridge: DmaBridge::new(),
        })
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    disable_webview_shortcuts(&window);
                }
                let app_handle = app.handle().clone();
                app.listen("tauri://webview-created", move |_event| {
                    for (_, window) in app_handle.webview_windows() {
                        disable_webview_shortcuts(&window);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_lsp,
            stop_lsp,
            send_lsp_message,
            lsp_available,
            execute_script,
            redeem_license,
            validate_license_session,
            handle_attach,
            is_roblox_running,
            get_roblox_processes,
            reset_hwid,
            get_account_info,
            logout_account,
            toggle_protection,
            start_vscode_server,
            stop_vscode_server,
            is_vscode_server_running,
            get_app_version,
            install_vscode_extension,
            start_explorer_server,
            stop_explorer_server,
            is_explorer_connected,
            get_explorer_connection_info,
            send_explorer_message,
            get_explorer_port,
            get_explorer_script,
            save_decompiled_script,
            save_all_scripts,
            open_folder_in_explorer,
            get_workspace_path,
            get_scripts_path,
            reveal_in_explorer,
            read_workspace_dir,
            read_workspace_file,
            get_autoexec_path,
            add_to_autoexec,
            remove_from_autoexec,
            is_in_autoexec,
            get_autoexec_scripts,
            load_favorites,
            save_favorites,
            start_dma_server,
            stop_dma_server,
            is_dma_connected,
            send_dma_script,
            launch_dma_exe,
            get_dma_port,
            fetch_roblox_user_from_cookie,
            fetch_roblox_avatar,
            fetch_roblox_game_details,
            get_roblox_auth_ticket,
            open_roblox_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
