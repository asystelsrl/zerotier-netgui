use std::io::Write;
use std::process::{Command, Stdio};
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_networks(app: tauri::AppHandle, networks_json: String) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    
    let file_path = config_dir.join("networks.json");
    std::fs::write(file_path, networks_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_networks(app: tauri::AppHandle) -> Result<String, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let file_path = config_dir.join("networks.json");
    
    if file_path.exists() {
        std::fs::read_to_string(file_path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn run_zerotier(password: String, args: Vec<String>) -> Result<String, String> {
    let mut child = Command::new("sudo")
        .arg("-S")
        .arg("zerotier-cli")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(format!("{}\n", password).as_bytes())
            .map_err(|e| e.to_string())?;
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn run_zerotier(_password: String, args: Vec<String>) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut child = Command::new("zerotier-cli.bat")
        .args(&args)
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .or_else(|_| {
            Command::new("zerotier-cli")
                .args(&args)
                .creation_flags(CREATE_NO_WINDOW)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
        })
        .map_err(|_| "Comando zerotier-cli non trovato. Assicurati che ZeroTier sia installato.".to_string())?;

    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, run_zerotier, save_file, save_networks, load_networks, is_windows])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
