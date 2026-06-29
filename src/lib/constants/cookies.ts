// Shared cookie names usable from both server and client modules.
// (A constant exported from a 'use client' file becomes a client reference when
//  imported server-side, so cross-boundary constants must live here.)

export const LAST_PATH_COOKIE = 'remnus_last_path';

// Set by the Tauri entry page (`/tauri-app`) so server components can detect the
// desktop shell and let the client `TabHost` own the content area (keep-alive
// tabs). Tauri's WebView has an isolated cookie jar, so this never leaks to a
// normal browser. See `isTauriRequest()`.
export const PLATFORM_COOKIE = 'remnus_platform';
