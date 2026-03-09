use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};

const EXPLORER_PORT: u16 = 21574;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ExplorerMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub data: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<f64>,
    #[serde(rename = "requestId", skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

pub struct ExplorerBridge {
    running: Arc<RwLock<bool>>,
    connected: Arc<RwLock<bool>>,
    connection_info: Arc<RwLock<Option<serde_json::Value>>>,
    tx_to_client: Arc<RwLock<Option<broadcast::Sender<String>>>>,
    rx_from_client: Arc<RwLock<Option<broadcast::Sender<String>>>>,
}

impl ExplorerBridge {
    pub fn new() -> Self {
        Self {
            running: Arc::new(RwLock::new(false)),
            connected: Arc::new(RwLock::new(false)),
            connection_info: Arc::new(RwLock::new(None)),
            tx_to_client: Arc::new(RwLock::new(None)),
            rx_from_client: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn start(&self) -> Result<(), String> {
        if *self.running.read().await {
            return Ok(());
        }

        *self.running.write().await = true;

        let (tx_out, _) = broadcast::channel::<String>(256);
        let (tx_in, _) = broadcast::channel::<String>(256);

        *self.tx_to_client.write().await = Some(tx_out.clone());
        *self.rx_from_client.write().await = Some(tx_in.clone());

        let running = self.running.clone();
        let connected = self.connected.clone();
        let connection_info = self.connection_info.clone();

        tokio::spawn(async move {
            let addr = format!("127.0.0.1:{}", EXPLORER_PORT);
            println!("[Explorer] Starting WebSocket server on {}", addr);

            let listener = match TcpListener::bind(&addr).await {
                Ok(l) => {
                    println!("[Explorer] Server bound successfully");
                    l
                },
                Err(e) => {
                    eprintln!("[Explorer] Failed to bind: {}", e);
                    *running.write().await = false;
                    return;
                }
            };

            println!("[Explorer] Waiting for connections...");

            loop {
                if !*running.read().await {
                    println!("[Explorer] Server stopping...");
                    break;
                }

                let accept_result = tokio::select! {
                    result = listener.accept() => Some(result),
                    _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => None,
                };

                if let Some(Ok((stream, addr))) = accept_result {
                    println!("[Explorer] New connection from: {}", addr);

                    let ws_stream = match accept_async(stream).await {
                        Ok(ws) => {
                            println!("[Explorer] WebSocket handshake completed");
                            ws
                        },
                        Err(e) => {
                            eprintln!("[Explorer] WebSocket handshake failed: {}", e);
                            continue;
                        }
                    };

                    *connected.write().await = true;

                    let (mut write, mut read) = ws_stream.split();
                    let mut rx_out = tx_out.subscribe();
                    let tx_in_clone = tx_in.clone();

                    let conn_clone = connected.clone();
                    let info_clone = connection_info.clone();
                    let running_inner = running.clone();

                    let read_task = tokio::spawn(async move {
                        println!("[Explorer] Read task started");
                        while let Some(msg) = read.next().await {
                            match msg {
                                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                    println!("[Explorer] Received: {}", &text[..text.len().min(200)]);

                                    if let Ok(parsed) = serde_json::from_str::<ExplorerMessage>(&text) {
                                        if parsed.msg_type == "connected" {
                                            println!("[Explorer] Game connected! Info: {:?}", parsed.data);
                                            *info_clone.write().await = Some(parsed.data.clone());
                                        }
                                    }
                                    let _ = tx_in_clone.send(text);
                                }
                                Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                                    println!("[Explorer] Connection closed by client");
                                    break;
                                }
                                Err(e) => {
                                    eprintln!("[Explorer] Read error: {}", e);
                                    break;
                                }
                                _ => {}
                            }
                        }
                        println!("[Explorer] Read task ended");
                        *conn_clone.write().await = false;
                        *info_clone.write().await = None;
                    });

                    let write_task = tokio::spawn(async move {
                        println!("[Explorer] Write task started");
                        while let Ok(msg) = rx_out.recv().await {
                            println!("[Explorer] Sending: {}", &msg[..msg.len().min(100)]);
                            if write.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await.is_err() {
                                println!("[Explorer] Write failed, disconnecting");
                                break;
                            }
                        }
                        println!("[Explorer] Write task ended");
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
                    println!("[Explorer] Connection ended");
                }
            }

            println!("[Explorer] Server stopped");
        });

        Ok(())
    }

    pub async fn stop(&self) {
        println!("[Explorer] Stopping...");
        *self.running.write().await = false;
        *self.connected.write().await = false;
        *self.connection_info.write().await = None;
        *self.tx_to_client.write().await = None;
        *self.rx_from_client.write().await = None;
    }

    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }

    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    pub async fn get_connection_info(&self) -> Option<serde_json::Value> {
        self.connection_info.read().await.clone()
    }

    pub async fn send_message(&self, message: String) -> Result<(), String> {
        println!("[Explorer] send_message called: {}", &message[..message.len().min(100)]);
        let tx = self.tx_to_client.read().await;
        if let Some(sender) = tx.as_ref() {
            sender.send(message).map_err(|e| format!("Send error: {}", e))?;
            Ok(())
        } else {
            Err("Not connected".to_string())
        }
    }

    pub async fn subscribe(&self) -> Option<broadcast::Receiver<String>> {
        let rx = self.rx_from_client.read().await;
        rx.as_ref().map(|s| s.subscribe())
    }

    pub fn get_port(&self) -> u16 {
        EXPLORER_PORT
    }
}
