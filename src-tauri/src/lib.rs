mod agent_connect;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    webview::DownloadEvent,
    Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
#[cfg(not(debug_assertions))]
use tauri_plugin_updater::UpdaterExt;

use agent_connect::{detect_installed_agents, run_claude_connect, write_agent_config};

const ZOOM_INIT: &str = "(function(){try{var z=parseFloat(localStorage.getItem('remnus_desktop_zoom'));if(z&&z>=0.5&&z<=2.0){var el=document.documentElement;el.style.zoom=String(z);if(z<1){var p=(100/z).toFixed(2)+'%';el.style.width=p;el.style.height=p;el.style.overflow='hidden';}}}catch(e){}})();";

/// Holds the user-chosen download directory (None ⇒ the platform default
/// Downloads folder). Persisted to a small text file in the app config dir so
/// it survives restarts; loaded into this state on startup.
#[derive(Default)]
struct DownloadConfig {
    dir: Mutex<Option<PathBuf>>,
}

/// Path of the file that persists the chosen download directory.
fn download_config_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("download-dir.txt"))
}

/// Persist (or clear) the chosen download directory to disk.
fn persist_download_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>, dir: &Option<PathBuf>) {
    if let Some(cfg) = download_config_path(app) {
        match dir {
            Some(p) => {
                if let Some(parent) = cfg.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&cfg, p.to_string_lossy().as_bytes());
            }
            None => {
                let _ = fs::remove_file(&cfg);
            }
        }
    }
}

/// Return the currently configured custom download directory, if any.
#[tauri::command]
fn get_download_dir(state: State<DownloadConfig>) -> Option<String> {
    state
        .dir
        .lock()
        .ok()?
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
}

/// Open a native folder picker, store the chosen directory (in memory + on
/// disk) and return it. Returns `None` if the user cancels.
#[tauri::command]
fn pick_download_dir(app: tauri::AppHandle, state: State<DownloadConfig>) -> Option<String> {
    let folder = app.dialog().file().blocking_pick_folder()?;
    let path = folder.into_path().ok()?;
    if let Ok(mut guard) = state.dir.lock() {
        *guard = Some(path.clone());
    }
    persist_download_dir(&app, &Some(path.clone()));
    Some(path.to_string_lossy().to_string())
}

/// Clear the custom download directory, reverting to the platform default.
#[tauri::command]
fn reset_download_dir(app: tauri::AppHandle, state: State<DownloadConfig>) {
    if let Ok(mut guard) = state.dir.lock() {
        *guard = None;
    }
    persist_download_dir(&app, &None);
}

/// Reveal a downloaded file in the OS file manager.
///
/// On Windows, `SHOpenFolderAndSelectItems` (used by `reveal_item_in_dir`) requires
/// an STA COM apartment, but Tauri command handlers run on MTA Tokio threads — the
/// call silently fails. `explorer.exe /select` is equally unreliable on Windows 11:
/// it routes through the existing Explorer instance via DDE; if that handoff fails
/// the process spawns and exits without opening any window, but `spawn().is_ok()`
/// returns true so we would incorrectly report success. Opening the parent folder
/// directly with `ShellExecuteW` (what `open_path` uses for directories) has no
/// COM-apartment restriction and always opens Explorer to that folder.
///
/// On Windows we use `explorer /select,` to select the file in its folder.
/// On macOS/Linux `reveal_item_in_dir` works correctly; we fall back to opening
/// the parent folder if it doesn't.
#[tauri::command]
fn reveal_download(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Use `explorer /select,` to open the folder and select (highlight) the
        // file — plain `open_path` on the parent folder opens it but doesn't
        // select the file, so the user can't find what just downloaded.
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", &path))
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let parent = PathBuf::from(&path)
            .parent()
            .map(|p| p.to_path_buf())
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| PathBuf::from(&path));

        if app.opener().reveal_item_in_dir(&path).is_ok() {
            return Ok(());
        }
        app.opener()
            .open_path(parent.to_string_lossy().to_string(), None::<&str>)
            .map_err(|e| e.to_string())
    }
}

/// Exit the application cleanly. Called from the UpdateBanner after an
/// update has been downloaded and installed — the user clicks "Quit & Reopen"
/// which triggers this command instead of the tray-hide CloseRequested path.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Bring the existing main window to the foreground (used when a second
/// instance is launched or the tray icon is clicked).
fn focus_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Handle a `remnus://auth?token=<jwt>` deep-link URL by navigating the main
/// webview to the client-activate endpoint. Shared between the macOS
/// `on_open_url` handler and the Windows/Linux single-instance argv path.
fn handle_deep_link_url<R: tauri::Runtime>(app: &tauri::AppHandle<R>, url: &url::Url) {
    if url.scheme() != "remnus" {
        return;
    }
    let token = url
        .query_pairs()
        .find(|(k, _)| k == "token")
        .map(|(_, v)| v.into_owned());
    if let Some(token) = token {
        #[cfg(not(debug_assertions))]
        let base = "https://remnus.com/api/auth/client-activate";
        #[cfg(debug_assertions)]
        let base = "http://localhost:3000/api/auth/client-activate";
        // Build a parsed URL and navigate via the typed API instead of
        // interpolating the token into a JS string (eval) — avoids code
        // injection from a crafted remnus:// deep-link (argv on Windows/Linux).
        // The token is set via the URL API so it is properly percent-encoded and
        // cannot inject extra query params / fragments.
        if let Ok(mut target) = url::Url::parse(base) {
            target.query_pairs_mut().append_pair("token", &token);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
                let _ = w.navigate(target);
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // MUST be the first plugin. When a second instance is launched, this
        // callback runs in the already-running (primary) instance and the new
        // process exits immediately — preventing duplicate windows/processes.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Windows/Linux deliver deep-link URLs as a process argument to the
            // second instance; forward any remnus:// URL to the primary window.
            for arg in &argv {
                if let Ok(url) = url::Url::parse(arg) {
                    if url.scheme() == "remnus" {
                        handle_deep_link_url(app, &url);
                    }
                }
            }
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DownloadConfig::default())
        .setup(|app| {
            // Restore the persisted custom download directory (if any) into state.
            if let Some(cfg) = download_config_path(app.handle()) {
                if let Ok(saved) = fs::read_to_string(&cfg) {
                    let trimmed = saved.trim().to_string();
                    if !trimmed.is_empty() {
                        if let Ok(mut guard) = app.state::<DownloadConfig>().dir.lock() {
                            *guard = Some(PathBuf::from(trimmed));
                        }
                    }
                }
            }

            #[cfg(debug_assertions)]
            let url = "http://localhost:3000/tauri-app";
            #[cfg(not(debug_assertions))]
            let url = "https://remnus.com/tauri-app";

            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(url.parse().unwrap()),
            )
            .title("Remnus")
            .inner_size(1280.0, 800.0)
            .min_inner_size(900.0, 600.0)
            .center()
            .decorations(false)
            .shadow(true)
            // Disable Tauri's OS-level drag-and-drop interception so the WebView
            // receives native HTML5 dragover/drop events. Without this, kanban/
            // calendar card dragging and the Notion-import file drop silently fail
            // in the desktop app (they work in the browser).
            .disable_drag_drop_handler()
            .additional_browser_args("--disable-spell-checking --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection")
            .initialization_script(ZOOM_INIT)
            // Handle file downloads triggered from the WebView so the user gets a
            // clear "download finished" toast and downloads honor the configured
            // download folder. Without this the WebView silently dropped files in
            // the OS default location with no in-app feedback.
            .on_download(|webview, event| {
                match event {
                    DownloadEvent::Requested { destination, .. } => {
                        // Redirect the download into the user-chosen folder, if set,
                        // keeping the original filename the WebView picked.
                        let app = webview.app_handle();
                        if let Ok(guard) = app.state::<DownloadConfig>().dir.lock() {
                            if let Some(dir) = guard.as_ref() {
                                if let Some(filename) = destination.file_name() {
                                    *destination = dir.join(filename);
                                }
                            }
                        }
                    }
                    DownloadEvent::Finished { path, success, .. } => {
                        let path_str = path.as_ref().map(|p| p.to_string_lossy().to_string());
                        let name = path
                            .as_ref()
                            .and_then(|p| p.file_name())
                            .map(|f| f.to_string_lossy().to_string());
                        let _ = webview.app_handle().emit(
                            "download-finished",
                            serde_json::json!({
                                "success": success,
                                "path": path_str,
                                "name": name,
                            }),
                        );
                    }
                    _ => {}
                }
                // Always allow the download to proceed.
                true
            })
            .build()?;

            // Hide to tray on window close instead of quitting.
            let win = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win.hide();
                }
            });

            // Handle OAuth deep-link callbacks: remnus://auth?token=<jwt>
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_deep_link_url(&handle, &url);
                }
            });

            // Check for updates in the background after a short delay.
            // Emits "update-available" with { version, body } when an update is found.
            #[cfg(not(debug_assertions))]
            {
                let update_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    if let Ok(updater) = update_handle.updater() {
                        if let Ok(Some(update)) = updater.check().await {
                            let version = update.version.clone();
                            let body = update.body.clone().unwrap_or_default();
                            let _ = update_handle.emit(
                                "update-available",
                                serde_json::json!({ "version": version, "body": body }),
                            );
                        }
                    }
                });
            }

            let quit = MenuItem::with_id(app, "quit", "Quit Remnus", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Remnus")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => focus_main_window(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        focus_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            quit_app,
            get_download_dir,
            pick_download_dir,
            reset_download_dir,
            reveal_download,
            detect_installed_agents,
            write_agent_config,
            run_claude_connect
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
