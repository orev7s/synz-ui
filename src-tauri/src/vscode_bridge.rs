use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::RwLock;
use serde::Deserialize;
use rand::Rng;

#[derive(Deserialize)]
struct ExecuteRequest {
    token: String,
    script: String,
}

pub struct VsCodeBridge {
    token: Arc<RwLock<Option<String>>>,
    running: Arc<RwLock<bool>>,
}

impl VsCodeBridge {
    pub fn new() -> Self {
        Self {
            token: Arc::new(RwLock::new(None)),
            running: Arc::new(RwLock::new(false)),
        }
    }

    fn get_pearl_dir() -> Result<PathBuf, String> {
        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Failed to get LOCALAPPDATA")?;
        Ok(PathBuf::from(local_app_data).join("SynapseZ"))
    }

    fn get_token_path() -> Result<PathBuf, String> {
        Ok(Self::get_pearl_dir()?.join("session.key"))
    }

    fn get_request_path() -> Result<PathBuf, String> {
        Ok(Self::get_pearl_dir()?.join("vscode-request.json"))
    }

    fn get_pearl_txt_path() -> Result<PathBuf, String> {
        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Failed to get LOCALAPPDATA")?;
        Ok(PathBuf::from(local_app_data).join("pearl.txt"))
    }

    pub async fn start(&self) -> Result<(), String> {
        if *self.running.read().await {
            return Ok(());
        }

        let pearl_dir = Self::get_pearl_dir()?;
        if !pearl_dir.exists() {
            std::fs::create_dir_all(&pearl_dir)
                .map_err(|e| format!("Failed to create SynapseZ dir: {}", e))?;
        }

        let new_token: String = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(64)
            .map(char::from)
            .collect();

        let token_path = Self::get_token_path()?;
        std::fs::write(&token_path, &new_token)
            .map_err(|e| format!("Failed to write token: {}", e))?;

        *self.token.write().await = Some(new_token);
        *self.running.write().await = true;

        let token = self.token.clone();
        let running = self.running.clone();

        tokio::spawn(async move {
            let request_path = match Self::get_request_path() {
                Ok(p) => p,
                Err(_) => return,
            };
            let pearl_txt = match Self::get_pearl_txt_path() {
                Ok(p) => p,
                Err(_) => return,
            };

            loop {
                if !*running.read().await {
                    break;
                }

                if request_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&request_path) {
                        let _ = std::fs::remove_file(&request_path);

                        if let Ok(req) = serde_json::from_str::<ExecuteRequest>(&content) {
                            let valid = if let Some(expected) = token.read().await.as_ref() {
                                req.token == *expected
                            } else {
                                false
                            };

                            if valid {
                                let _ = std::fs::write(&pearl_txt, &req.script);
                            }
                        }
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        });

        Ok(())
    }

    pub async fn stop(&self) {
        *self.running.write().await = false;
        *self.token.write().await = None;

        if let Ok(token_path) = Self::get_token_path() {
            let _ = std::fs::remove_file(token_path);
        }
        if let Ok(request_path) = Self::get_request_path() {
            let _ = std::fs::remove_file(request_path);
        }
    }

    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }
}
