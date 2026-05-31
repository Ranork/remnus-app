use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;

const ZOOM_INIT: &str = "(function(){try{var z=parseFloat(localStorage.getItem('remnus_desktop_zoom'));if(z&&z>=0.5&&z<=2.0){var el=document.documentElement;el.style.zoom=String(z);if(z<1){var p=(100/z).toFixed(2)+'%';el.style.width=p;el.style.height=p;el.style.overflow='hidden';}}}catch(e){}})();";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
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
            .initialization_script(ZOOM_INIT)
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
                    if url.scheme() == "remnus" {
                        let token = url
                            .query_pairs()
                            .find(|(k, _)| k == "token")
                            .map(|(_, v)| v.into_owned());
                        if let Some(token) = token {
                            #[cfg(not(debug_assertions))]
                            let activate_url = format!(
                                "https://remnus.com/api/auth/client-activate?token={}",
                                token
                            );
                            #[cfg(debug_assertions)]
                            let activate_url = format!(
                                "http://localhost:3000/api/auth/client-activate?token={}",
                                token
                            );
                            if let Some(w) = handle.get_webview_window("main") {
                                let _ = w.eval(&format!(
                                    "window.location.replace('{}')",
                                    activate_url
                                ));
                            }
                        }
                    }
                }
            });

            let quit = MenuItem::with_id(app, "quit", "Quit Remnus", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Remnus")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
