use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};
use std::path::{Path, PathBuf};
use std::os::windows::ffi::OsStrExt;
use tokio::sync::{RwLock, broadcast};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use windows_sys::Win32::System::Threading::{
    CreateProcessW, TerminateProcess, WaitForSingleObject, STARTUPINFOW, PROCESS_INFORMATION,
};
use windows_sys::Win32::Foundation::{BOOL, CloseHandle, HANDLE, HWND, LPARAM, WAIT_OBJECT_0};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowLongW, GetWindowThreadProcessId, SetWindowLongW, SetWindowPos, ShowWindow,
    GWL_EXSTYLE, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, SW_SHOWNA,
    WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
};

const DMA_PORT: u16 = 21575;
const DMA_SCRIPT_FILE_PREFIX: &str = "pearl_dma_script_";
const DMA_SCRIPT_FILE_SUFFIX: &str = ".txt";

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DmaMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

struct HiddenProcess {
    process_id: u32,
    process_handle: HANDLE,
    thread_handle: HANDLE,
}

unsafe impl Send for HiddenProcess {}
unsafe impl Sync for HiddenProcess {}

impl Drop for HiddenProcess {
    fn drop(&mut self) {
        unsafe {
            if !self.process_handle.is_null() {
                if is_process_running(self.process_handle) {
                    let _ = TerminateProcess(self.process_handle, 0);
                }
                CloseHandle(self.process_handle);
            }
            if !self.thread_handle.is_null() {
                CloseHandle(self.thread_handle);
            }
        }
    }
}

pub struct DmaBridge {
    running: Arc<RwLock<bool>>,
    connected: Arc<RwLock<bool>>,
    tx_to_client: Arc<RwLock<Option<broadcast::Sender<String>>>>,
    pending_script_files: Arc<RwLock<HashSet<String>>>,
    hidden_process: Arc<RwLock<Option<HiddenProcess>>>,
    auto_close_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

impl DmaBridge {
    pub fn new() -> Self {
        Self {
            running: Arc::new(RwLock::new(false)),
            connected: Arc::new(RwLock::new(false)),
            tx_to_client: Arc::new(RwLock::new(None)),
            pending_script_files: Arc::new(RwLock::new(HashSet::new())),
            hidden_process: Arc::new(RwLock::new(None)),
            auto_close_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn start(&self) -> Result<(), String> {
        if *self.running.read().await {
            println!("[DMA] Server already running");
            return Ok(());
        }

        *self.running.write().await = true;
        println!("[DMA] Starting WebSocket server on port {}", DMA_PORT);

        let (tx_out, _) = broadcast::channel::<String>(256);
        *self.tx_to_client.write().await = Some(tx_out.clone());

        let running = self.running.clone();
        let connected = self.connected.clone();
        let pending_script_files = self.pending_script_files.clone();

        tokio::spawn(async move {
            let addr = format!("127.0.0.1:{}", DMA_PORT);
            println!("[DMA] Binding to {}", addr);

            let listener = match TcpListener::bind(&addr).await {
                Ok(l) => {
                    println!("[DMA] Successfully bound to port {}", DMA_PORT);
                    l
                },
                Err(e) => {
                    eprintln!("[DMA] Failed to bind: {}", e);
                    *running.write().await = false;
                    return;
                }
            };

            println!("[DMA] Waiting for connections...");

            loop {
                if !*running.read().await {
                    println!("[DMA] Server stopping...");
                    break;
                }

                let accept_result = tokio::select! {
                    result = listener.accept() => Some(result),
                    _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => None,
                };

                if let Some(Ok((stream, addr))) = accept_result {
                    println!("[DMA] New TCP connection from: {}", addr);

                    let ws_stream = match accept_async(stream).await {
                        Ok(ws) => {
                            println!("[DMA] WebSocket handshake completed with {}", addr);
                            ws
                        },
                        Err(e) => {
                            eprintln!("[DMA] WebSocket handshake failed: {}", e);
                            continue;
                        }
                    };

                    *connected.write().await = true;
                    println!("[DMA] Client connected, setting connected = true");

                    let (mut write, mut read) = ws_stream.split();
                    let mut rx_out = tx_out.subscribe();
                    let conn_clone = connected.clone();
                    let running_inner = running.clone();
                    let pending_script_files_inner = pending_script_files.clone();

                    let read_task = tokio::spawn(async move {
                        println!("[DMA] Read task started");
                        while let Some(msg) = read.next().await {
                            match msg {
                                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                    println!("[DMA] Received: {}", &text[..text.len().min(100)]);
                                    if let Ok(parsed) = serde_json::from_str::<DmaMessage>(&text) {
                                        println!("[DMA] Parsed message type: {}", parsed.msg_type);
                                        if parsed.msg_type == "ready" {
                                            *conn_clone.write().await = true;
                                            println!("[DMA] Client sent ready signal");
                                        } else if parsed.msg_type == "executed_file" {
                                            let Some(file_name) = extract_file_name_from_data(parsed.data.as_ref()) else {
                                                eprintln!("[DMA] executed_file missing file_name");
                                                continue;
                                            };

                                            if !is_valid_dma_file_name(&file_name) {
                                                eprintln!("[DMA] Ignoring invalid executed_file name: {}", file_name);
                                                continue;
                                            }

                                            let was_pending = pending_script_files_inner.write().await.remove(&file_name);
                                            if !was_pending {
                                                eprintln!("[DMA] Ignoring executed_file for unknown file: {}", file_name);
                                                continue;
                                            }

                                            if let Ok(path) = get_wave_workspace_file_path(&file_name) {
                                                if let Err(err) = remove_script_file(&path) {
                                                    eprintln!("[DMA] Failed to remove script file {}: {}", path.display(), err);
                                                } else {
                                                    println!("[DMA] Removed script file: {}", path.display());
                                                }
                                            }

                                            if let Some(success) = extract_success_from_data(parsed.data.as_ref()) {
                                                println!("[DMA] executed_file success={} ({})", success, file_name);
                                            }

                                            if let Some(error) = extract_error_from_data(parsed.data.as_ref()) {
                                                if !error.is_empty() {
                                                    eprintln!("[DMA] executed_file error for {}: {}", file_name, error);
                                                }
                                            }
                                        } else if parsed.msg_type == "bridge_log" {
                                            let level = extract_bridge_log_level(parsed.data.as_ref())
                                                .unwrap_or_else(|| "INFO".to_string());
                                            let message = extract_bridge_log_message(parsed.data.as_ref())
                                                .unwrap_or_else(|| "<empty>".to_string());
                                            println!("[DMA-Bridge][{}] {}", level, message);
                                        } else if parsed.msg_type == "executed_runtime" {
                                            let source = extract_source_from_data(parsed.data.as_ref())
                                                .unwrap_or_else(|| "unknown".to_string());
                                            let success = extract_success_from_data(parsed.data.as_ref()).unwrap_or(false);
                                            let error = extract_error_from_data(parsed.data.as_ref()).unwrap_or_default();
                                            if success {
                                                println!("[DMA] executed_runtime success ({})", source);
                                            } else if !error.is_empty() {
                                                eprintln!("[DMA] executed_runtime error ({}): {}", source, error);
                                            } else {
                                                eprintln!("[DMA] executed_runtime failed ({})", source);
                                            }
                                        }
                                    }
                                }
                                Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                                    println!("[DMA] Client sent close frame");
                                    break;
                                }
                                Err(e) => {
                                    eprintln!("[DMA] Read error: {}", e);
                                    break;
                                }
                                _ => {}
                            }
                        }
                        println!("[DMA] Read task ended");
                        *conn_clone.write().await = false;
                    });

                    let write_task = tokio::spawn(async move {
                        println!("[DMA] Write task started");
                        while let Ok(msg) = rx_out.recv().await {
                            println!("[DMA] Sending message: {}", &msg[..msg.len().min(100)]);
                            if write.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await.is_err() {
                                println!("[DMA] Write failed, disconnecting");
                                break;
                            }
                            println!("[DMA] Message sent successfully");
                        }
                        println!("[DMA] Write task ended");
                    });

                    tokio::select! {
                        _ = read_task => {},
                        _ = write_task => {},
                        _ = async {
                            loop {
                                if !*running_inner.read().await {
                                    break;
                                }
                                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                            }
                        } => {},
                    }

                    *connected.write().await = false;
                    println!("[DMA] Connection ended");
                }
            }

            println!("[DMA] Server stopped");
        });

        Ok(())
    }

    pub async fn stop(&self) {
        println!("[DMA] Stopping...");
        *self.running.write().await = false;
        *self.connected.write().await = false;
        *self.tx_to_client.write().await = None;
        self.pending_script_files.write().await.clear();

        if let Some(handle) = self.auto_close_handle.write().await.take() {
            handle.abort();
        }

        if let Some(proc) = self.hidden_process.write().await.take() {
            terminate_process_if_alive(proc.process_handle);
        }
        println!("[DMA] Stopped");
    }

    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }

    pub async fn is_connected(&self) -> bool {
        let connected = *self.connected.read().await;
        println!("[DMA] is_connected check: {}", connected);
        connected
    }

    pub async fn send_script(&self, script: String) -> Result<(), String> {
        println!("[DMA] send_script called, script length: {}", script.len());
        let tx = self.tx_to_client.read().await;
        if let Some(sender) = tx.as_ref() {
            let msg = DmaMessage {
                msg_type: "execute".to_string(),
                script: Some(script),
                data: None,
            };
            let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
            println!("[DMA] Sending execute message");
            if let Err(e) = sender.send(json) {
                return Err(format!("Send error: {}", e));
            }
            println!("[DMA] Message queued for sending");
            Ok(())
        } else {
            println!("[DMA] send_script failed: tx_to_client is None");
            Err("DMA not connected".to_string())
        }
    }

    pub async fn launch_hidden_exe(&self, exe_path: String, auto_close_seconds: u32) -> Result<(), String> {
        println!("[DMA] launch_hidden_exe: {} (auto-close: {}s)", exe_path, auto_close_seconds);

        if !std::path::Path::new(&exe_path).exists() {
            println!("[DMA] EXE file not found: {}", exe_path);
            return Err("EXE file not found".to_string());
        }

        let hidden_proc = spawn_hidden_process(&exe_path)?;
        let process_id = hidden_proc.process_id;

        let _ = hide_process_windows(process_id);

        println!("[DMA] EXE launched successfully (hidden)");

        *self.hidden_process.write().await = Some(hidden_proc);

        let connected = self.connected.clone();
        let running = self.running.clone();

        let handle = tokio::spawn(async move {
            println!("[DMA] Auto-close timer started: {}s", auto_close_seconds);
            let deadline = Instant::now() + Duration::from_secs(auto_close_seconds as u64);
            while Instant::now() < deadline {
                let _ = hide_process_windows(process_id);
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            }
            println!("[DMA] Auto-close timer expired");

            *connected.write().await = true;
            println!("[DMA] Timer complete, marked connected=true without terminating hidden EXE");

            loop {
                if !*running.read().await {
                    break;
                }
                let _ = hide_process_windows(process_id);
                tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
            }
        });

        *self.auto_close_handle.write().await = Some(handle);

        Ok(())
    }

    pub fn get_port(&self) -> u16 {
        DMA_PORT
    }
}

fn get_wave_workspace_path() -> Result<PathBuf, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Failed to get LOCALAPPDATA environment variable".to_string())?;
    let wave_dir = Path::new(&local_app_data).join("Wave").join("Workspace");
    std::fs::create_dir_all(&wave_dir)
        .map_err(|e| format!("Failed to create Wave directory: {}", e))?;
    Ok(wave_dir)
}

fn get_wave_workspace_file_path(file_name: &str) -> Result<PathBuf, String> {
    if !is_valid_dma_file_name(file_name) {
        return Err("Invalid script file name".to_string());
    }
    Ok(get_wave_workspace_path()?.join(file_name))
}

fn is_valid_dma_file_name(file_name: &str) -> bool {
    !file_name.is_empty()
        && file_name.starts_with(DMA_SCRIPT_FILE_PREFIX)
        && file_name.ends_with(DMA_SCRIPT_FILE_SUFFIX)
        && !file_name.contains('\\')
        && !file_name.contains('/')
        && !file_name.contains("..")
}

fn extract_file_name_from_data(data: Option<&serde_json::Value>) -> Option<String> {
    let file_name = data?
        .get("file_name")?
        .as_str()?;
    Some(file_name.to_string())
}

fn extract_success_from_data(data: Option<&serde_json::Value>) -> Option<bool> {
    data?
        .get("success")?
        .as_bool()
}

fn extract_error_from_data(data: Option<&serde_json::Value>) -> Option<String> {
    data?
        .get("error")?
        .as_str()
        .map(ToString::to_string)
}

fn extract_source_from_data(data: Option<&serde_json::Value>) -> Option<String> {
    data?
        .get("source")?
        .as_str()
        .map(ToString::to_string)
}

fn extract_bridge_log_level(data: Option<&serde_json::Value>) -> Option<String> {
    data?
        .get("level")?
        .as_str()
        .map(ToString::to_string)
}

fn extract_bridge_log_message(data: Option<&serde_json::Value>) -> Option<String> {
    data?
        .get("message")?
        .as_str()
        .map(ToString::to_string)
}

fn remove_script_file(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

struct HideWindowContext {
    process_id: u32,
    hid_any: bool,
}

fn hide_process_windows(process_id: u32) -> bool {
    let mut context = HideWindowContext {
        process_id,
        hid_any: false,
    };

    unsafe {
        EnumWindows(
            Some(enum_windows_for_process),
            (&mut context as *mut HideWindowContext) as LPARAM,
        );
    }

    context.hid_any
}

unsafe extern "system" fn enum_windows_for_process(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let context = &mut *(lparam as *mut HideWindowContext);
    let mut window_pid = 0u32;
    GetWindowThreadProcessId(hwnd, &mut window_pid);

    if window_pid != context.process_id {
        return 1;
    }

    let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
    let mut new_ex_style = ex_style | WS_EX_TOOLWINDOW as i32;
    new_ex_style &= !(WS_EX_APPWINDOW as i32);
    if new_ex_style != ex_style {
        SetWindowLongW(hwnd, GWL_EXSTYLE, new_ex_style);
    }

    SetWindowPos(
        hwnd,
        std::ptr::null_mut(),
        -32000,
        -32000,
        0,
        0,
        SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
    );
    ShowWindow(hwnd, SW_SHOWNA);

    context.hid_any = true;
    1
}

fn spawn_hidden_process(exe_path: &str) -> Result<HiddenProcess, String> {
    let exe_path_buf = Path::new(exe_path).to_path_buf();
    let exe_dir = exe_path_buf
        .parent()
        .ok_or("Failed to resolve EXE directory".to_string())?
        .to_path_buf();

    let wide_path: Vec<u16> = exe_path_buf
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let wide_dir: Vec<u16> = exe_dir
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut startup_info: STARTUPINFOW = unsafe { std::mem::zeroed() };
    startup_info.cb = std::mem::size_of::<STARTUPINFOW>() as u32;

    let mut process_info: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };

    let success = unsafe {
        CreateProcessW(
            wide_path.as_ptr(),
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            0,
            std::ptr::null(),
            wide_dir.as_ptr(),
            &startup_info,
            &mut process_info,
        )
    };

    if success == 0 {
        let error = std::io::Error::last_os_error();
        println!("[DMA] CreateProcessW failed: {}", error);
        return Err(format!("Failed to launch EXE: {}", error));
    }

    Ok(HiddenProcess {
        process_id: process_info.dwProcessId,
        process_handle: process_info.hProcess,
        thread_handle: process_info.hThread,
    })
}

fn is_process_running(process_handle: HANDLE) -> bool {
    unsafe {
        WaitForSingleObject(process_handle, 0) != WAIT_OBJECT_0
    }
}

fn terminate_process_if_alive(process_handle: HANDLE) {
    if is_process_running(process_handle) {
        unsafe {
            TerminateProcess(process_handle, 0);
        }
    }
}
