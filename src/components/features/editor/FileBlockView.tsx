'use client';
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Download, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { deleteUploadedAsset } from './assetClient';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import { createSignedDownloadUrl } from '@/lib/actions/download';

function formatSize(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function FileBlockView({
  node,
  deleteNode,
  updateAttributes,
  editor,
}: {
  node: any;
  deleteNode: () => void;
  updateAttributes: (attrs: Record<string, any>) => void;
  editor: any;
}) {
  const t = useTranslations('Editor');
  const workspaceId: string | null =
    editor?.extensionManager?.extensions?.find((e: any) => e.name === 'fileBlock')?.options?.workspaceId ?? null;
  const { url, name, size } = node.attrs as { url: string | null; name: string; size: number };
  // Only ever put an http(s) URL into the download href (attributes may be tampered/synced).
  const safeUrl = /^https?:\/\//i.test(url || '') ? (url as string) : '';
  // Cross-origin `download` attribute is ignored by browsers. Proxy through our own
  // API route so the server can set Content-Disposition with the correct filename.
  const downloadUrl = safeUrl
    ? `/api/upload/download?url=${encodeURIComponent(safeUrl)}&name=${encodeURIComponent(name || 'download')}`
    : '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isTauri = useIsTauri();

  const handleDownload = async () => {
    if (!downloadUrl || downloading) return;

    // Desktop: hand the download to the system browser, which has a working
    // download UI + "show in folder" (the in-app `reveal_download` command is
    // blocked by the ACL because the webview loads a remote origin). We point the
    // browser at OUR proxy — not the raw Cloudinary URL — because only the proxy
    // sends `Content-Disposition: attachment; filename="…"`, so the saved file
    // keeps its real name and extension. Cloudinary can't do that for a `raw`
    // asset, which is why the browser download previously arrived with no
    // extension. The system browser has no session cookie, so the proxy URL is
    // signed with a short-lived HMAC that authorizes just this one request.
    if (isTauri && safeUrl) {
      try {
        const signedPath = await createSignedDownloadUrl(safeUrl, name || 'download');
        if (signedPath) {
          const { openUrl } = await import('@tauri-apps/plugin-opener');
          await openUrl(new URL(signedPath, window.location.origin).toString());
          return;
        }
      } catch {
        // Signing or opener unavailable — fall through to the in-app download.
      }
    }

    // Web (and desktop fallback): fetch with the session cookie and save via a
    // blob. A plain `<a href download>` is cross-origin-ignored and is also
    // swallowed by the Tauri WebView, so we materialize the bytes ourselves.
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = name || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
    } catch {
      // Best-effort web fallback — open the proxy route in a new tab.
      if (safeUrl) window.open(downloadUrl, '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!url) fileRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'file');
      if (workspaceId) fd.append('workspaceId', workspaceId);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      updateAttributes({ url: data.url, name: data.name || file.name, size: data.size || file.size });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <NodeViewWrapper>
      <div contentEditable={false} className="group/file relative my-2 select-none">

        {url ? (
          <div className="relative flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-neutral-100 truncate">{name || t('fileUntitled')}</div>
              {size > 0 && <div className="text-xs text-neutral-500">{formatSize(size)}</div>}
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading || !downloadUrl}
              className="shrink-0 p-1.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
              title={t('fileDownload')}
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            </button>
            <button
              onClick={() => {
                deleteUploadedAsset(url);
                deleteNode();
              }}
              className="shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity text-neutral-500 hover:text-red-400 cursor-pointer text-base leading-none"
              title={t('fileRemove')}
            >
              ×
            </button>
          </div>
        ) : (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2.5"
          >
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm text-neutral-300 hover:text-neutral-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {t('fileUpload')}
            </button>
            {error && <span className="text-xs text-red-400">{t('fileError')}</span>}
            <input ref={fileRef} type="file" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
