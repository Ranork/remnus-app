'use client';
import { AlertCircle, ArrowLeft, FileArchive, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

// Shared pieces of the import flows (Notion in ImportTab, OKF in OkfImport).

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImportHeader({
  icon, title, hint, backLabel, onBack,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label={backLabel} className="-ml-1.5">
        <ArrowLeft />
      </Button>
      <span className="mt-1 shrink-0">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{hint}</p>
      </div>
    </div>
  );
}

/** A file target: click (or Enter) to pick, or drop a .zip on it. */
export function DropZone({
  file, onPick, onDrop, label, hint, children,
}: {
  file: File | null;
  onPick: () => void;
  onDrop: (e: React.DragEvent) => void;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <button
        type="button"
        onClick={onPick}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center gap-2 rounded-surface border border-dashed p-8 text-center transition-colors',
          file ? 'border-signal bg-signal-soft' : 'border-line-strong hover:border-fg-4 hover:bg-hover/40',
        )}
      >
        {file ? (
          <>
            <FileArchive size={24} className="text-fg-2" />
            <span className="max-w-xs truncate text-ui font-medium text-fg">{file.name}</span>
            <span className="text-xs text-fg-3">{formatBytes(file.size)}</span>
          </>
        ) : (
          <>
            <Upload size={24} className="text-fg-4" />
            <span className="text-ui text-fg-2">{label}</span>
            <span className="text-xs text-fg-3">{hint}</span>
          </>
        )}
      </button>
    </>
  );
}

export function Working({ label, hint }: { label: string; hint?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 py-8 text-fg-2">
      <Loader2 size={18} className="animate-spin text-fg-3" />
      <span className="text-ui">{label}</span>
      {hint && <span className="text-xs text-fg-3">{hint}</span>}
    </div>
  );
}

export function ImportError({ title, message }: { title?: string; message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-control bg-red-500/10 p-3">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
      <div className="min-w-0 text-xs leading-relaxed">
        {title && <p className="font-semibold text-red-400">{title}</p>}
        <p className="text-fg-2">{message}</p>
      </div>
    </div>
  );
}
