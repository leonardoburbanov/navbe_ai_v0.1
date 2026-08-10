#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

/// Hide console flashes when spawning ``powershell`` / ``netstat`` / ``taskkill`` on Windows.
fn hide_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri::State;

const BASE_URL: &str = "http://127.0.0.1:8000";
const HEALTH_URL: &str = "http://127.0.0.1:8000/health";
const VERSION_URL: &str = "http://127.0.0.1:8000/api/v1/version";
const MCP_URL: &str = "http://127.0.0.1:8000/mcp";
const LISTEN_PORT: u16 = 8000;
const LAN_REMOTE_FILE: &str = "lan_remote.json";
const LAN_TOKEN_FILE: &str = "lan_token";
const CLOUD_FILE: &str = "cloud.json";

struct DaemonState {
    child: Mutex<Option<Child>>,
    cloud_agent: Mutex<Option<Child>>,
    attached: Mutex<bool>,
    error: Mutex<Option<String>>,
    log_path: Mutex<Option<String>>,
    /// False until the first ensure_daemon attempt finishes.
    booting: Mutex<bool>,
}

#[derive(Serialize, Clone)]
struct DaemonStatus {
    running: bool,
    attached: bool,
    booting: bool,
    base_url: String,
    mcp_url: String,
    log_path: Option<String>,
    error: Option<String>,
    lan_enabled: bool,
    lan_urls: Vec<String>,
    lan_token: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct LanRemoteConfig {
    enabled: bool,
}

#[derive(Serialize, Clone)]
struct LanRemoteStatus {
    enabled: bool,
    token: Option<String>,
    urls: Vec<String>,
    qr_payload: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct CloudConfig {
    account_token: String,
    relay_url: String,
    #[serde(default)]
    device_id: Option<String>,
    #[serde(default)]
    device_secret: Option<String>,
    #[serde(default)]
    enabled: bool,
    /// Optional path to navbe_ai_cloud checkout for ``uv run navbe-cloud agent``.
    #[serde(default)]
    project_dir: Option<String>,
}

impl Default for CloudConfig {
    fn default() -> Self {
        Self {
            account_token: String::new(),
            relay_url: "http://127.0.0.1:8443".into(),
            device_id: None,
            device_secret: None,
            enabled: false,
            project_dir: None,
        }
    }
}

#[derive(Serialize, Clone)]
struct McpClientEntryStatus {
    connected: bool,
    path: Option<String>,
    available: bool,
}

#[derive(Serialize, Clone)]
struct McpClientStatus {
    mcp_url: String,
    cursor: McpClientEntryStatus,
    claude: McpClientEntryStatus,
    cursor_snippet: String,
    claude_snippet: String,
}

#[derive(Serialize, Clone)]
struct McpClientConfigureResult {
    client: String,
    path: String,
    message: String,
}

#[derive(Serialize, Clone)]
struct CloudRemoteStatus {
    enabled: bool,
    agent_running: bool,
    relay_url: String,
    account_token_set: bool,
    device_id: Option<String>,
    online: bool,
    error: Option<String>,
}

#[derive(Serialize)]
struct ApiProxyResponse {
    status: u16,
    body: String,
}

#[derive(serde::Deserialize)]
struct VersionPayload {
    features: Option<Vec<String>>,
}

fn http_get_ok(url: &str) -> bool {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .ok()
        .and_then(|c| c.get(url).send().ok())
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

fn health_ok() -> bool {
    http_get_ok(HEALTH_URL)
}

/// True when the daemon exposes the features this desktop build needs.
fn version_ok() -> bool {
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    let Ok(resp) = client.get(VERSION_URL).send() else {
        return false;
    };
    if !resp.status().is_success() {
        return false;
    }
    let Ok(body) = resp.json::<VersionPayload>() else {
        return false;
    };
    body.features
        .unwrap_or_default()
        .iter()
        .any(|f| f == "catalog")
}

fn daemon_ready() -> bool {
    health_ok() && version_ok()
}

fn wait_until_ready(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    let mut foreign_health_since: Option<Instant> = None;
    while Instant::now() < deadline {
        if daemon_ready() {
            return true;
        }
        // Old uv-tool serve answers /health but not /version — don't wait 60s.
        if health_ok() && !version_ok() {
            let since = foreign_health_since.get_or_insert_with(Instant::now);
            if since.elapsed() > Duration::from_secs(3) {
                return false;
            }
        } else {
            foreign_health_since = None;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

fn wait_until_unhealthy(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if !health_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

fn default_log_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".navbe")
        .join("serve.log")
}

fn navbe_home() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".navbe")
}

fn lan_remote_config_path() -> PathBuf {
    navbe_home().join(LAN_REMOTE_FILE)
}

fn lan_token_path() -> PathBuf {
    navbe_home().join(LAN_TOKEN_FILE)
}

fn cloud_config_path() -> PathBuf {
    navbe_home().join(CLOUD_FILE)
}

fn cursor_mcp_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cursor")
        .join("mcp.json")
}

/// Claude Desktop config path for this OS, if a conventional location exists.
fn claude_desktop_config_path() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("APPDATA").map(|appdata| {
            PathBuf::from(appdata)
                .join("Claude")
                .join("claude_desktop_config.json")
        })
    } else if cfg!(target_os = "macos") {
        Some(
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("Library")
                .join("Application Support")
                .join("Claude")
                .join("claude_desktop_config.json"),
        )
    } else {
        // Linux: no single conventional path; paste via snippet.
        None
    }
}

fn mcp_server_entry(client: &str) -> serde_json::Value {
    if client == "claude" {
        serde_json::json!({
            "command": "npx",
            "args": [
                "-y",
                "mcp-remote",
                MCP_URL,
                "--allow-http",
                "--transport",
                "http-only"
            ]
        })
    } else {
        serde_json::json!({ "url": MCP_URL })
    }
}

fn mcp_config_snippet(client: &str) -> String {
    let payload = serde_json::json!({
        "mcpServers": {
            "navbe": mcp_server_entry(client)
        }
    });
    serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".into())
}

fn read_mcp_json_object(path: &PathBuf) -> serde_json::Map<String, serde_json::Value> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return serde_json::Map::new();
    };
    match serde_json::from_str::<serde_json::Value>(&raw) {
        Ok(serde_json::Value::Object(map)) => map,
        _ => serde_json::Map::new(),
    }
}

fn navbe_mcp_connected(path: &PathBuf) -> bool {
    if !path.is_file() {
        return false;
    }
    let map = read_mcp_json_object(path);
    let Some(servers) = map.get("mcpServers") else {
        return false;
    };
    servers
        .as_object()
        .map(|s| s.contains_key("navbe"))
        .unwrap_or(false)
}

fn merge_and_write_mcp_config(path: &PathBuf, client: &str) -> Result<(), String> {
    let mut map = read_mcp_json_object(path);
    let mut servers = match map.remove("mcpServers") {
        Some(serde_json::Value::Object(obj)) => obj,
        _ => serde_json::Map::new(),
    };
    servers.insert("navbe".into(), mcp_server_entry(client));
    map.insert("mcpServers".into(), serde_json::Value::Object(servers));
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(&serde_json::Value::Object(map))
        .map_err(|e| e.to_string())?;
    std::fs::write(path, raw + "\n").map_err(|e| format!("write {}: {e}", path.display()))
}

fn build_mcp_client_status() -> McpClientStatus {
    let cursor_path = cursor_mcp_path();
    let claude_path = claude_desktop_config_path();
    McpClientStatus {
        mcp_url: MCP_URL.into(),
        cursor: McpClientEntryStatus {
            connected: navbe_mcp_connected(&cursor_path),
            path: Some(cursor_path.display().to_string()),
            available: true,
        },
        claude: match &claude_path {
            Some(p) => McpClientEntryStatus {
                connected: navbe_mcp_connected(p),
                path: Some(p.display().to_string()),
                available: true,
            },
            None => McpClientEntryStatus {
                connected: false,
                path: None,
                available: false,
            },
        },
        cursor_snippet: mcp_config_snippet("cursor"),
        claude_snippet: mcp_config_snippet("claude"),
    }
}

fn read_cloud_config() -> CloudConfig {
    let path = cloud_config_path();
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return CloudConfig::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_cloud_config(cfg: &CloudConfig) -> Result<(), String> {
    let home = navbe_home();
    std::fs::create_dir_all(&home).map_err(|e| format!("mkdir {}: {e}", home.display()))?;
    let path = cloud_config_path();
    let raw = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw + "\n").map_err(|e| format!("write {}: {e}", path.display()))
}

fn cloud_agent_alive(state: &DaemonState) -> bool {
    let mut guard = state.cloud_agent.lock().unwrap();
    match guard.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(None) => true,
            Ok(Some(_)) => {
                *guard = None;
                false
            }
            Err(_) => {
                *guard = None;
                false
            }
        },
        None => false,
    }
}

fn stop_cloud_agent(state: &DaemonState) {
    if let Some(mut child) = state.cloud_agent.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn register_cloud_device(cfg: &CloudConfig) -> Result<(String, String), String> {
    let base = cfg.relay_url.trim_end_matches('/');
    let url = format!("{base}/v1/devices");
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("http client: {e}"))?;
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", cfg.account_token.trim()))
        .header("Content-Type", "application/json")
        .body(r#"{"label":"Laptop"}"#)
        .send()
        .map_err(|e| format!("register device failed: {e}"))?;
    let status = response.status();
    let text = response.text().map_err(|e| format!("read body: {e}"))?;
    if !status.is_success() {
        return Err(format!("register device HTTP {status}: {text}"));
    }
    #[derive(Deserialize)]
    struct Reg {
        device_id: String,
        device_secret: String,
    }
    let parsed: Reg = serde_json::from_str(&text).map_err(|e| format!("parse register: {e}"))?;
    Ok((parsed.device_id, parsed.device_secret))
}

fn spawn_cloud_agent(state: &DaemonState, cfg: &CloudConfig) -> Result<(), String> {
    stop_cloud_agent(state);
    let log_path = navbe_home().join("cloud-agent.log");
    let log_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("open cloud-agent.log: {e}"))?;
    let err_file = log_file
        .try_clone()
        .map_err(|e| format!("clone log: {e}"))?;

    let project = cfg
        .project_dir
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("NAVBE_CLOUD_ROOT").ok());

    let mut cmd = if let Some(dir) = project {
        let mut c = Command::new("uv");
        c.arg("run")
            .arg("--directory")
            .arg(dir)
            .arg("navbe-cloud")
            .arg("agent");
        c
    } else {
        let mut c = Command::new("navbe-cloud");
        c.arg("agent");
        c
    };

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(err_file))
        .spawn()
        .map_err(|e| {
            format!(
                "spawn cloud agent failed: {e}. Install navbe-cloud on PATH or set project_dir / NAVBE_CLOUD_ROOT."
            )
        })?;
    *state.cloud_agent.lock().unwrap() = Some(child);
    Ok(())
}

fn probe_device_online(cfg: &CloudConfig) -> bool {
    let Some(device_id) = cfg.device_id.as_ref().filter(|s| !s.is_empty()) else {
        return false;
    };
    if cfg.account_token.trim().is_empty() {
        return false;
    }
    let base = cfg.relay_url.trim_end_matches('/');
    let url = format!("{base}/v1/devices");
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    let Ok(resp) = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", cfg.account_token.trim()))
        .send()
    else {
        return false;
    };
    if !resp.status().is_success() {
        return false;
    }
    let Ok(text) = resp.text() else {
        return false;
    };
    #[derive(Deserialize)]
    struct Row {
        device_id: String,
        online: bool,
    }
    let Ok(rows) = serde_json::from_str::<Vec<Row>>(&text) else {
        return false;
    };
    rows.iter()
        .any(|r| r.device_id == *device_id && r.online)
}

fn build_cloud_remote_status(state: &DaemonState) -> CloudRemoteStatus {
    let cfg = read_cloud_config();
    let agent_running = cloud_agent_alive(state);
    let online = if cfg.enabled && agent_running {
        probe_device_online(&cfg)
    } else {
        false
    };
    CloudRemoteStatus {
        enabled: cfg.enabled,
        agent_running,
        relay_url: cfg.relay_url,
        account_token_set: !cfg.account_token.trim().is_empty(),
        device_id: cfg.device_id,
        online,
        error: None,
    }
}

fn read_lan_remote_config() -> LanRemoteConfig {
    let path = lan_remote_config_path();
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return LanRemoteConfig::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_lan_remote_config(cfg: &LanRemoteConfig) -> Result<(), String> {
    let home = navbe_home();
    std::fs::create_dir_all(&home).map_err(|e| format!("mkdir {}: {e}", home.display()))?;
    let path = lan_remote_config_path();
    let raw = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw + "\n").map_err(|e| format!("write {}: {e}", path.display()))
}

fn read_lan_token() -> Option<String> {
    let Ok(raw) = std::fs::read_to_string(lan_token_path()) else {
        return None;
    };
    let token = raw.trim().to_string();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

fn write_lan_token(token: &str) -> Result<(), String> {
    let home = navbe_home();
    std::fs::create_dir_all(&home).map_err(|e| format!("mkdir {}: {e}", home.display()))?;
    let path = lan_token_path();
    std::fs::write(&path, format!("{}\n", token.trim()))
        .map_err(|e| format!("write {}: {e}", path.display()))
}

fn clear_lan_token_file() {
    let _ = std::fs::remove_file(lan_token_path());
}

fn generate_lan_token() -> String {
    let mut buf = [0u8; 24];
    if getrandom::fill(&mut buf).is_err() {
        // Fallback should be rare; still produce something unique enough to type.
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        return format!("navbe{nanos:x}");
    }
    // URL-safe base64 without padding (pairing paste / QR).
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity(32);
    let mut i = 0;
    while i + 2 < buf.len() {
        let n = ((buf[i] as u32) << 16) | ((buf[i + 1] as u32) << 8) | (buf[i + 2] as u32);
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        out.push(TABLE[((n >> 6) & 63) as usize] as char);
        out.push(TABLE[(n & 63) as usize] as char);
        i += 3;
    }
    out
}

/// Best-effort IPv4 addresses other hosts on the LAN can use.
///
/// Cached: ``daemon_status`` polls every few seconds while LAN is on; shelling
/// out to PowerShell each time flashed a console and stole focus.
fn lan_ipv4_addrs() -> Vec<String> {
    const TTL: Duration = Duration::from_secs(60);
    static CACHE: Mutex<Option<(Instant, Vec<String>)>> = Mutex::new(None);

    if let Ok(guard) = CACHE.lock() {
        if let Some((at, ips)) = guard.as_ref() {
            if at.elapsed() < TTL {
                return ips.clone();
            }
        }
    }

    let mut out = Vec::new();
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip();
                if let std::net::IpAddr::V4(v4) = ip {
                    if !v4.is_loopback() {
                        out.push(v4.to_string());
                    }
                }
            }
        }
    }
    #[cfg(windows)]
    {
        // Only when UDP failed — keep rare; always CREATE_NO_WINDOW.
        if out.is_empty() {
            let mut cmd = Command::new("powershell");
            hide_console(&mut cmd);
            if let Ok(output) = cmd
                .args([
                    "-NoProfile",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    "Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | \
                     Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | \
                     Select-Object -ExpandProperty IPAddress",
                ])
                .output()
            {
                if output.status.success() {
                    for line in String::from_utf8_lossy(&output.stdout).lines() {
                        let ip = line.trim();
                        if !ip.is_empty() && !out.iter().any(|x| x == ip) {
                            out.push(ip.to_string());
                        }
                    }
                }
            }
        }
    }

    if let Ok(mut guard) = CACHE.lock() {
        *guard = Some((Instant::now(), out.clone()));
    }
    out
}

fn lan_base_urls() -> Vec<String> {
    lan_ipv4_addrs()
        .into_iter()
        .map(|ip| format!("http://{ip}:{LISTEN_PORT}"))
        .collect()
}

fn build_lan_remote_status() -> LanRemoteStatus {
    let cfg = read_lan_remote_config();
    let token = if cfg.enabled {
        read_lan_token()
    } else {
        None
    };
    let urls = if cfg.enabled {
        lan_base_urls()
    } else {
        Vec::new()
    };
    let qr_payload = match (token.as_ref(), urls.first()) {
        (Some(t), Some(url)) => Some(
            serde_json::json!({ "baseUrl": url, "token": t }).to_string(),
        ),
        _ => None,
    };
    LanRemoteStatus {
        enabled: cfg.enabled,
        token,
        urls,
        qr_payload,
    }
}

fn sidecar_exe_name() -> &'static str {
    if cfg!(windows) {
        "navbe.exe"
    } else {
        "navbe"
    }
}

/// Candidate paths for the PyInstaller sidecar shipped next to the desktop app.
///
/// Tauri's ``resource_dir()`` is not reliable on every Windows install layout
/// (per-user MSI/NSIS under ``%LOCALAPPDATA%``). Always also check
/// ``<exe_dir>/resources/navbe/``. Never treat a stale PATH ``navbe`` as bundled.
fn bundled_sidecar_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let name = sidecar_exe_name();
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("navbe").join(name));
        candidates.push(resource_dir.join(name));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("resources").join("navbe").join(name));
            candidates.push(dir.join("navbe").join(name));
        }
    }

    candidates.into_iter().find(|p| p.is_file())
}

/// True when an install-layout resources folder sits next to this exe.
fn install_layout_resources_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let resources = dir.join("resources").join("navbe");
    if resources.is_dir() {
        Some(resources)
    } else {
        None
    }
}

/// Packaged app when the installer-bundled sidecar is present.
fn is_packaged(app: &tauri::AppHandle) -> bool {
    bundled_sidecar_path(app).is_some()
}

fn resolve_sidecar_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(bundled) = bundled_sidecar_path(app) {
        return Ok(bundled);
    }

    // Installers must ship resources/navbe — do not silently run a stale
    // ``uv tool`` / PATH navbe (often missing /api/v1/version).
    if let Some(resources) = install_layout_resources_dir() {
        return Err(format!(
            "Bundled navbe sidecar missing under {}. Reinstall the desktop app \
             or run scripts/build_sidecar.ps1 before packaging.",
            resources.display()
        ));
    }

    if let Ok(path) = which_navbe() {
        return Ok(path);
    }

    Err(
        "Bundled navbe sidecar not found. Run scripts/build_sidecar.ps1 \
         or ensure `navbe` is on PATH for development."
            .into(),
    )
}

fn which_navbe() -> Result<PathBuf, String> {
    let candidates = if cfg!(windows) {
        vec!["navbe.exe", "navbe.cmd", "navbe"]
    } else {
        vec!["navbe"]
    };
    for name in candidates {
        let mut cmd = Command::new(if cfg!(windows) { "where" } else { "which" });
        hide_console(&mut cmd);
        if let Ok(output) = cmd.arg(name).output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = text.lines().next() {
                    let path = PathBuf::from(line.trim());
                    if path.exists() {
                        return Ok(path);
                    }
                }
            }
        }
    }
    Err("navbe not found on PATH".into())
}

/// PIDs listening on TCP LISTEN for ``127.0.0.1:port`` / ``0.0.0.0:port`` (Windows).
///
/// Important: ``uv tool install navbe`` leaves a **python.exe** (not navbe.exe)
/// as the LISTENING owner — never reclaim by image name alone.
#[cfg(windows)]
fn pids_listening_on_port(port: u16) -> Vec<u32> {
    let mut pids = Vec::new();

    // Prefer Get-NetTCPConnection — reliable OwningProcess for python.exe listeners.
    let mut ps = Command::new("powershell");
    hide_console(&mut ps);
    if let Ok(output) = ps
        .args([
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &format!(
                "Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | \
                 Select-Object -ExpandProperty OwningProcess"
            ),
        ])
        .output()
    {
        if output.status.success() {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                if let Ok(pid) = line.trim().parse::<u32>() {
                    if pid > 0 && !pids.contains(&pid) {
                        pids.push(pid);
                    }
                }
            }
        }
    }

    // Fallback: netstat (works when Get-NetTCPConnection is unavailable).
    if pids.is_empty() {
        let mut ns = Command::new("netstat");
        hide_console(&mut ns);
        if let Ok(output) = ns.args(["-ano"]).output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                let needle = format!(":{port}");
                for line in text.lines() {
                    let line = line.trim();
                    if !line.contains("LISTENING") || !line.contains(&needle) {
                        continue;
                    }
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() < 5 {
                        continue;
                    }
                    let local = parts[1];
                    if !(local.ends_with(&needle)
                        || local.eq_ignore_ascii_case(&format!("127.0.0.1:{port}"))
                        || local.eq_ignore_ascii_case(&format!("0.0.0.0:{port}")))
                    {
                        continue;
                    }
                    if let Ok(pid) = parts[parts.len() - 1].parse::<u32>() {
                        if pid > 0 && !pids.contains(&pid) {
                            pids.push(pid);
                        }
                    }
                }
            }
        }
    }
    pids
}

#[cfg(not(windows))]
fn pids_listening_on_port(_port: u16) -> Vec<u32> {
    Vec::new()
}

fn kill_pid(pid: u32) {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("taskkill");
        hide_console(&mut cmd);
        let _ = cmd
            .args(["/F", "/PID", &pid.to_string(), "/T"])
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
    }
}

/// Stop anything on :8000 so the bundled/dev sidecar can bind.
fn reclaim_port(app: &tauri::AppHandle) {
    if let Ok(bundled) = resolve_sidecar_path(app) {
        let mut cmd = Command::new(&bundled);
        hide_console(&mut cmd);
        let _ = cmd.arg("stop").output();
    }
    if let Ok(path) = which_navbe() {
        let mut cmd = Command::new(&path);
        hide_console(&mut cmd);
        let _ = cmd.arg("stop").output();
    }

    // Kill LISTEN owners first (often python.exe from `uv tool`, not navbe.exe).
    for _ in 0..3 {
        let pids = pids_listening_on_port(LISTEN_PORT);
        if pids.is_empty() {
            break;
        }
        for pid in pids {
            kill_pid(pid);
        }
        thread::sleep(Duration::from_millis(300));
    }

    #[cfg(windows)]
    {
        let mut cmd = Command::new("taskkill");
        hide_console(&mut cmd);
        let _ = cmd.args(["/F", "/IM", "navbe.exe", "/T"]).output();
    }

    let _ = wait_until_unhealthy(Duration::from_secs(8));
}

fn spawn_sidecar(app: &tauri::AppHandle, state: &DaemonState) -> Result<(), String> {
    if health_ok() {
        reclaim_port(app);
        if health_ok() {
            return Err(format!(
                "port {LISTEN_PORT} is still busy after reclaim; stop the other \
                 process (see netstat) or run uninstall stop-all"
            ));
        }
    }

    let lan = read_lan_remote_config();
    let bind_host = if lan.enabled {
        "0.0.0.0"
    } else {
        "127.0.0.1"
    };
    let lan_token = if lan.enabled {
        let token = read_lan_token().unwrap_or_else(generate_lan_token);
        write_lan_token(&token)?;
        Some(token)
    } else {
        None
    };

    let exe = resolve_sidecar_path(app)?;
    let log_path = default_log_path();
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let log_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("failed to open log {}: {e}", log_path.display()))?;
    let log_err = log_file
        .try_clone()
        .map_err(|e| format!("failed to clone log handle: {e}"))?;

    let mut cmd = Command::new(&exe);
    cmd.args(["serve", "--host", bind_host, "--port", "8000"])
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_err));
    // Clear inherited token when LAN is off so loopback-only serve stays locked down.
    cmd.env_remove("NAVBE_LAN_TOKEN");
    if let Some(token) = lan_token.as_ref() {
        cmd.env("NAVBE_LAN_TOKEN", token);
    }

    if let Some(dir) = exe.parent() {
        cmd.current_dir(dir);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn {}: {e}", exe.display()))?;

    *state.child.lock().unwrap() = Some(child);
    *state.attached.lock().unwrap() = false;
    *state.log_path.lock().unwrap() = Some(log_path.display().to_string());

    // Cold start of a ready sidecar is usually ~2–5s; keep a shorter ceiling.
    if !wait_until_ready(Duration::from_secs(25)) {
        if let Some(mut child) = state.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        // One more reclaim+hint if a foreign /health is still answering.
        if health_ok() && !version_ok() {
            reclaim_port(app);
            return Err(format!(
                "port {LISTEN_PORT} still has an old Navbe (health OK, no /api/v1/version). \
                 Closed leftover python/navbe listeners; click Restart engine, or run \
                 resources\\stop-all.cmd. Log: {}",
                log_path.display()
            ));
        }
        return Err(format!(
            "navbe serve did not become ready (need /health + /api/v1/version \
             features=[catalog]); see {}",
            log_path.display()
        ));
    }
    Ok(())
}

fn ensure_daemon(app: &tauri::AppHandle, state: &DaemonState) {
    let packaged = is_packaged(app);
    let lan_enabled = read_lan_remote_config().enabled;

    // LAN remote needs 0.0.0.0 + pairing token — never attach to a foreign localhost serve.
    if lan_enabled {
        if health_ok() {
            reclaim_port(app);
        }
        match spawn_sidecar(app, state) {
            Ok(()) => {
                *state.error.lock().unwrap() = None;
            }
            Err(err) => {
                *state.error.lock().unwrap() = Some(err);
            }
        }
        *state.booting.lock().unwrap() = false;
        return;
    }

    // Packaged desktop always owns the engine — never attach to a random CLI.
    if !packaged && daemon_ready() {
        *state.attached.lock().unwrap() = true;
        *state.error.lock().unwrap() = None;
        *state.log_path.lock().unwrap() = Some(default_log_path().display().to_string());
        *state.booting.lock().unwrap() = false;
        return;
    }

    if packaged && daemon_ready() {
        // Fast relaunch: leftover owned engine — still "local", not a foreign attach.
        *state.attached.lock().unwrap() = false;
        *state.error.lock().unwrap() = None;
        *state.log_path.lock().unwrap() = Some(default_log_path().display().to_string());
        *state.booting.lock().unwrap() = false;
        return;
    }

    // Stale/foreign or nothing listening → reclaim (if needed) and spawn ours.
    if health_ok() {
        reclaim_port(app);
    }

    match spawn_sidecar(app, state) {
        Ok(()) => {
            *state.error.lock().unwrap() = None;
        }
        Err(err) => {
            *state.error.lock().unwrap() = Some(err);
        }
    }
    *state.booting.lock().unwrap() = false;
}

#[tauri::command]
fn daemon_status(state: State<'_, DaemonState>) -> DaemonStatus {
    let attached = *state.attached.lock().unwrap();
    let booting = *state.booting.lock().unwrap();
    let running = daemon_ready();
    let lan = build_lan_remote_status();
    DaemonStatus {
        running,
        attached,
        booting,
        base_url: BASE_URL.into(),
        mcp_url: MCP_URL.into(),
        log_path: state.log_path.lock().unwrap().clone(),
        error: state.error.lock().unwrap().clone(),
        lan_enabled: lan.enabled,
        lan_urls: lan.urls,
        lan_token: lan.token,
    }
}

/// Enable or disable LAN remote (rebinds daemon host + rotates/clears pair token).
#[tauri::command]
fn lan_remote_set(
    app: tauri::AppHandle,
    state: State<'_, DaemonState>,
    enabled: bool,
) -> Result<LanRemoteStatus, String> {
    if enabled {
        let token = generate_lan_token();
        write_lan_token(&token)?;
        write_lan_remote_config(&LanRemoteConfig { enabled: true })?;
    } else {
        write_lan_remote_config(&LanRemoteConfig { enabled: false })?;
        clear_lan_token_file();
    }

    *state.booting.lock().unwrap() = true;
    *state.error.lock().unwrap() = None;
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    reclaim_port(&app);
    match spawn_sidecar(&app, &state) {
        Ok(()) => {
            *state.error.lock().unwrap() = None;
        }
        Err(err) => {
            *state.error.lock().unwrap() = Some(err.clone());
            *state.booting.lock().unwrap() = false;
            return Err(err);
        }
    }
    *state.booting.lock().unwrap() = false;
    Ok(build_lan_remote_status())
}

#[tauri::command]
fn lan_remote_status() -> LanRemoteStatus {
    build_lan_remote_status()
}

/// Enable or disable cloud remote (register device + start/stop outbound agent).
#[tauri::command]
fn cloud_remote_set(
    state: State<'_, DaemonState>,
    enabled: bool,
    account_token: Option<String>,
    relay_url: Option<String>,
    project_dir: Option<String>,
) -> Result<CloudRemoteStatus, String> {
    let mut cfg = read_cloud_config();
    if let Some(token) = account_token {
        let t = token.trim().to_string();
        if !t.is_empty() {
            cfg.account_token = t;
        }
    }
    if let Some(url) = relay_url {
        let u = url.trim().to_string();
        if !u.is_empty() {
            cfg.relay_url = u;
        }
    }
    if let Some(dir) = project_dir {
        let d = dir.trim().to_string();
        cfg.project_dir = if d.is_empty() { None } else { Some(d) };
    }

    if !enabled {
        cfg.enabled = false;
        write_cloud_config(&cfg)?;
        stop_cloud_agent(&state);
        return Ok(build_cloud_remote_status(&state));
    }

    if cfg.account_token.trim().is_empty() {
        return Err("paste a Navbe Cloud account token first".into());
    }

    // Always mint a fresh device when enabling so secrets stay laptop-local.
    let (device_id, device_secret) = register_cloud_device(&cfg)?;
    cfg.device_id = Some(device_id);
    cfg.device_secret = Some(device_secret);
    cfg.enabled = true;
    write_cloud_config(&cfg)?;
    spawn_cloud_agent(&state, &cfg)?;
    // Brief wait so the WSS handshake can complete before status probe.
    thread::sleep(Duration::from_secs(1));
    Ok(build_cloud_remote_status(&state))
}

#[tauri::command]
fn cloud_remote_status(state: State<'_, DaemonState>) -> CloudRemoteStatus {
    build_cloud_remote_status(&state)
}

/// Whether Cursor / Claude Desktop already have a ``navbe`` MCP entry.
#[tauri::command]
fn mcp_client_status() -> McpClientStatus {
    build_mcp_client_status()
}

/// Merge Navbe into Cursor or Claude Desktop MCP config (same shapes as ``navbe mcp configure``).
#[tauri::command]
fn mcp_client_configure(client: String) -> Result<McpClientConfigureResult, String> {
    let client = client.trim().to_lowercase();
    match client.as_str() {
        "cursor" => {
            let path = cursor_mcp_path();
            merge_and_write_mcp_config(&path, "cursor")?;
            Ok(McpClientConfigureResult {
                client: "cursor".into(),
                path: path.display().to_string(),
                message: format!("wrote {}", path.display()),
            })
        }
        "claude" => {
            let path = claude_desktop_config_path()
                .ok_or_else(|| "Claude Desktop config path unavailable on this platform".to_string())?;
            merge_and_write_mcp_config(&path, "claude")?;
            Ok(McpClientConfigureResult {
                client: "claude".into(),
                path: path.display().to_string(),
                message: format!("wrote {}", path.display()),
            })
        }
        _ => Err(format!("unknown client '{client}' (use cursor or claude)")),
    }
}

/// Force reclaim of :8000 and (re)start the owned sidecar. UI "Restart engine".
#[tauri::command]
fn daemon_restart(app: tauri::AppHandle, state: State<'_, DaemonState>) -> DaemonStatus {
    *state.booting.lock().unwrap() = true;
    *state.error.lock().unwrap() = None;
    // Drop our previous child handle without requiring it to be the listener.
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    reclaim_port(&app);
    match spawn_sidecar(&app, &state) {
        Ok(()) => {
            *state.error.lock().unwrap() = None;
        }
        Err(err) => {
            *state.error.lock().unwrap() = Some(err);
        }
    }
    *state.booting.lock().unwrap() = false;
    daemon_status(state)
}

/// Proxy REST to the local daemon from Rust so the webview never hits CORS.
#[tauri::command]
fn api_request(method: String, path: String, body: Option<String>) -> Result<ApiProxyResponse, String> {
    let path = path.trim();
    if !path.starts_with('/') {
        return Err("path must start with /".into());
    }
    let url = format!("{BASE_URL}{path}");
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("http client: {e}"))?;

    let mut builder = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        other => return Err(format!("unsupported method {other}")),
    };

    if let Some(payload) = body {
        builder = builder
            .header("Content-Type", "application/json")
            .body(payload);
    }

    let response = builder.send().map_err(|e| format!("request failed: {e}"))?;
    let status = response.status().as_u16();
    let body = response.text().map_err(|e| format!("read body: {e}"))?;
    Ok(ApiProxyResponse { status, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DaemonState {
            child: Mutex::new(None),
            cloud_agent: Mutex::new(None),
            attached: Mutex::new(false),
            error: Mutex::new(None),
            log_path: Mutex::new(None),
            booting: Mutex::new(true),
        })
        .setup(|app| {
            // Keep setup non-blocking: reqwest::blocking on the UI thread can
            // stall/fail window creation on Windows.
            let handle = app.handle().clone();
            thread::spawn(move || {
                let state = handle.state::<DaemonState>();
                ensure_daemon(&handle, &state);
            });
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            // Keep the daemon running after the window closes (faster relaunch).
            // Uninstall hooks stop navbe.exe via resources/stop-all.cmd.
            if let tauri::WindowEvent::Destroyed = event {}
        })
        .invoke_handler(tauri::generate_handler![
            daemon_status,
            daemon_restart,
            lan_remote_set,
            lan_remote_status,
            cloud_remote_set,
            cloud_remote_status,
            mcp_client_status,
            mcp_client_configure,
            api_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running Navbe Desktop");
}
