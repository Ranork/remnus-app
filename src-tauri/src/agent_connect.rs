// ── Agent auto-connect: detection + config-file writing + CLI shell-out ────
//
// Desktop-only capability the web build can never have: since Tauri gives us a
// real OS process, we can (a) detect which AI coding tools are present on this
// machine and (b) write the Remnus MCP server entry directly into their config
// files (or run their CLI directly), instead of asking the user to copy-paste.
//
// Every write is scoped to a fixed, known set of `editor` ids resolved to a
// path server-side — the frontend never supplies a raw path. Existing config
// content the user hasn't touched must always survive untouched; see the
// upsert helpers below for the "parse failure is a hard error, not `{}`" rule.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use toml_edit::{value, DocumentMut, InlineTable, Item, Table, Value as TomlValue};

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentDetection {
    pub id: String,
    pub detected: bool,
    pub config_path: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteAgentConfigResult {
    pub path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeConnectResult {
    pub success: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Resolve a binary name on PATH, honoring Windows' PATHEXT (so `claude` finds
/// `claude.cmd`, the shape npm-global installs actually produce on Windows).
fn resolve_on_path(bin: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    let exts: Vec<String> = if cfg!(target_os = "windows") {
        std::env::var("PATHEXT")
            .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string())
            .split(';')
            .map(|s| s.to_string())
            .collect()
    } else {
        vec![String::new()]
    };
    std::env::split_paths(&path_var).find_map(|dir| {
        exts.iter()
            .map(|ext| dir.join(format!("{bin}{ext}")))
            .find(|p| p.is_file())
    })
}

/// Which AI coding tools are present on this machine. File-based editors are
/// detected by their config folder existing; CLI-only editors (Claude Code,
/// VS Code) by resolving their binary on PATH. This is a best-effort proxy
/// ("has been used on this machine"), not a guarantee the tool is currently
/// installed — the UI must never claim more than "detected on this device".
#[tauri::command]
pub fn detect_installed_agents(app: tauri::AppHandle) -> Result<Vec<AgentDetection>, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let mut out = Vec::new();

    for (id, rel) in [
        ("cursor", &[".cursor"][..]),
        ("codex", &[".codex"]),
        ("windsurf", &[".codeium", "windsurf"]),
        ("continue", &[".continue"]),
        ("antigravity", &[".gemini"]),
    ] {
        let dir = rel.iter().fold(home.clone(), |p, seg| p.join(seg));
        out.push(AgentDetection {
            id: id.to_string(),
            detected: dir.is_dir(),
            config_path: Some(dir.to_string_lossy().into_owned()),
        });
    }

    out.push(AgentDetection {
        id: "claude".to_string(),
        detected: resolve_on_path("claude").is_some(),
        config_path: None,
    });
    out.push(AgentDetection {
        id: "vscode".to_string(),
        detected: resolve_on_path("code").is_some(),
        config_path: None,
    });

    Ok(out)
}

/// Resolve the real config file path for a file-based editor id. Rust's
/// `home_dir()` already returns the correct OS-native home on every platform,
/// so — unlike the frontend's per-OS `CONFIG_PATHS` table (used only for the
/// manual copy-paste fallback) — no per-OS branching is needed here.
fn config_path_for(home: &Path, editor: &str) -> Option<PathBuf> {
    let rel: &[&str] = match editor {
        "cursor" => &[".cursor", "mcp.json"],
        "windsurf" => &[".codeium", "windsurf", "mcp_config.json"],
        "continue" => &[".continue", "config.json"],
        "antigravity" => &[".gemini", "config", "mcp_config.json"],
        "codex" => &[".codex", "config.toml"],
        _ => return None,
    };
    Some(rel.iter().fold(home.to_path_buf(), |p, seg| p.join(seg)))
}

/// Upsert the `remnus` MCP server entry into a JSON config (cursor / windsurf /
/// continue / antigravity — shape mirrors `buildJsonConfig` in deeplinks.ts).
/// Any other keys/entries in the file are preserved untouched. A parse failure
/// on an EXISTING file is a hard error — we never silently replace a user's
/// malformed-but-real config with an empty one.
fn upsert_json_config(editor: &str, existing: &str, mcp_url: &str, token: Option<&str>) -> Result<String, String> {
    let mut root: serde_json::Value = if existing.trim().is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_str(existing)
            .map_err(|e| format!("existing config is not valid JSON — fix it manually first: {e}"))?
    };
    let obj = root
        .as_object_mut()
        .ok_or_else(|| "top-level config value is not a JSON object".to_string())?;
    let servers = obj
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));
    let servers_obj = servers
        .as_object_mut()
        .ok_or_else(|| "`mcpServers` is not a JSON object".to_string())?;

    let mut entry = serde_json::Map::new();
    let key = if editor == "antigravity" { "serverUrl" } else { "url" };
    entry.insert(key.to_string(), mcp_url.into());
    if let Some(tok) = token {
        let mut headers = serde_json::Map::new();
        headers.insert("Authorization".to_string(), format!("Bearer {tok}").into());
        entry.insert("headers".to_string(), serde_json::Value::Object(headers));
    }
    servers_obj.insert("remnus".to_string(), serde_json::Value::Object(entry));

    serde_json::to_string_pretty(&root).map_err(|e| e.to_string())
}

/// Upsert `[mcp_servers.remnus]` into Codex's `config.toml` (shape mirrors
/// `buildCodexToml` in deeplinks.ts) via `toml_edit`, which preserves comments,
/// formatting, and unrelated keys — the plain `toml` crate would silently drop
/// comments and reorder the whole file, unacceptable for a user's real dotfile.
fn upsert_codex_toml(existing: &str, mcp_url: &str, token: Option<&str>) -> Result<String, String> {
    let mut doc: DocumentMut = if existing.trim().is_empty() {
        DocumentMut::new()
    } else {
        existing
            .parse()
            .map_err(|e| format!("existing config.toml is not valid TOML: {e}"))?
    };

    if doc.get("mcp_servers").is_none() {
        let mut t = Table::new();
        t.set_implicit(true); // parent-only table: no redundant standalone [mcp_servers] header
        doc.insert("mcp_servers", Item::Table(t));
    }
    let mcp_servers = doc["mcp_servers"]
        .as_table_mut()
        .ok_or_else(|| "`mcp_servers` in config.toml is not a table".to_string())?;

    let mut remnus = Table::new(); // implicit = false (default) → renders its own [mcp_servers.remnus] header
    remnus.insert("url", value(mcp_url));
    if let Some(tok) = token {
        let mut headers = InlineTable::new();
        headers.insert("Authorization", format!("Bearer {tok}").into());
        remnus.insert("http_headers", Item::Value(TomlValue::InlineTable(headers)));
    }
    mcp_servers.insert("remnus", Item::Table(remnus));

    Ok(doc.to_string())
}

/// Write the Remnus MCP entry into a file-based editor's real config file.
/// `editor` is a fixed id, never a raw path — the actual filesystem path is
/// always resolved here, server-side. Writes a best-effort `.bak` copy first.
#[tauri::command]
pub fn write_agent_config(
    app: tauri::AppHandle,
    editor: String,
    mcp_url: String,
    token: Option<String>,
) -> Result<WriteAgentConfigResult, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let path = config_path_for(&home, &editor).ok_or_else(|| format!("unsupported editor: {editor}"))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let existing = fs::read_to_string(&path).unwrap_or_default();
    if path.is_file() {
        let _ = fs::copy(&path, format!("{}.bak", path.display()));
    }

    let new_contents = if editor == "codex" {
        upsert_codex_toml(&existing, &mcp_url, token.as_deref())?
    } else {
        upsert_json_config(&editor, &existing, &mcp_url, token.as_deref())?
    };

    fs::write(&path, new_contents).map_err(|e| e.to_string())?;
    Ok(WriteAgentConfigResult {
        path: path.to_string_lossy().into_owned(),
    })
}

/// Build the subprocess for running the Claude Code CLI. On Windows, an
/// npm-global install produces a `.cmd` shim — `CreateProcessW` cannot execute
/// those directly, so shims are re-routed through `cmd /C`. `CREATE_NO_WINDOW`
/// keeps a console window from flashing (this app has no console of its own).
fn build_command(resolved_path: &Path, args: &[String]) -> std::process::Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let is_shim = matches!(
            resolved_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_ascii_lowercase())
                .as_deref(),
            Some("cmd") | Some("bat")
        );
        let mut cmd = if is_shim {
            let mut c = std::process::Command::new("cmd");
            c.arg("/C").arg(resolved_path);
            c
        } else {
            std::process::Command::new(resolved_path)
        };
        cmd.args(args).creation_flags(CREATE_NO_WINDOW);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = std::process::Command::new(resolved_path);
        cmd.args(args);
        cmd
    }
}

fn run_claude_connect_blocking(mcp_url: &str, token: Option<&str>) -> Result<ClaudeConnectResult, String> {
    let claude_path = resolve_on_path("claude").ok_or_else(|| "claude CLI not found on PATH".to_string())?;

    let mut args: Vec<String> = vec![
        "mcp".to_string(),
        "add".to_string(),
        "--transport".to_string(),
        "http".to_string(),
        "--scope".to_string(),
        "user".to_string(),
        "remnus".to_string(),
        mcp_url.to_string(),
    ];
    if let Some(tok) = token {
        args.push("--header".to_string());
        args.push(format!("Authorization: Bearer {tok}"));
    }

    let mut cmd = build_command(&claude_path, &args);
    let output = cmd.output().map_err(|e| format!("failed to launch claude: {e}"))?;

    Ok(ClaudeConnectResult {
        success: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

/// Run `claude mcp add ...` directly instead of asking the user to copy a
/// command into their own terminal. `async fn` + `spawn_blocking`: a plain
/// sync command would run inline on the IPC-dispatch thread with no offload,
/// but a subprocess wait has unpredictable duration, so it belongs on tokio's
/// blocking-thread pool (mirrors the async pattern already used for the
/// updater check in `lib.rs`, just the blocking sibling of it).
#[tauri::command]
pub async fn run_claude_connect(mcp_url: String, token: Option<String>) -> Result<ClaudeConnectResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_claude_connect_blocking(&mcp_url, token.as_deref()))
        .await
        .map_err(|e| format!("connect task panicked: {e}"))?
}
