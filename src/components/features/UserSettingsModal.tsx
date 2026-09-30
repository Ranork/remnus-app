'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { X, User, Download, HardDrive, Crown, SlidersHorizontal, Camera, Loader2, Monitor, ChevronDown, Check, AlertTriangle, Mail } from 'lucide-react';
import AvatarCropModal from './AvatarCropModal';
import FlagIcon from './FlagIcon';
import ImportTab from './workspace-settings/ImportTab';
import DesktopTab from './workspace-settings/DesktopTab';
import { getCurrentUserStorageBytes } from '@/lib/actions/workspace';
import { updateMyProfile } from '@/lib/actions/auth';
import { requestAccountDeletion } from '@/lib/actions/account';
import { getMyTier } from '@/lib/actions/billing';
import type { PlanTier } from '@/lib/billing/plans';
import BillingModal from './BillingModal';
import {
  setEditorFontSize, setSidebarDensity, setDefaultPageWidth, setTheme,
  type EditorFontSize, type SidebarDensity, type DefaultPageWidth,
} from '@/lib/actions/preferences';
import { APP_THEMES } from '@/lib/themes';
import type { AppTheme } from '@/lib/themes';
import { setLocale } from '@/lib/actions/locale';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Preference row ─────────────────────────────────────────────────────────────

function PrefRow<T extends string>({
  label, hint, options, value, onChange, wrap = false,
}: {
  label: string;
  hint?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`py-4 border-b border-neutral-800 last:border-b-0 ${wrap ? '' : 'flex items-start justify-between gap-6'}`}>
      <div className={`min-w-0 ${wrap ? 'mb-3' : ''}`}>
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        {hint && <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>}
      </div>
      <div className={wrap ? 'flex flex-wrap gap-1.5' : 'flex gap-1 shrink-0'}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium border rounded-md transition-colors cursor-pointer ${
              value === opt.value
                ? 'bg-neutral-700 border-neutral-600 text-neutral-100'
                : 'bg-transparent border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Theme picker ──────────────────────────────────────────────────────────────

function ThemePicker({ value, onChange }: { value: AppTheme; onChange: (v: AppTheme) => void }) {
  const t = useTranslations('UserSettings');
  return (
    <div className="py-4 border-b border-neutral-800">
      <div className="mb-3">
        <p className="text-sm font-medium text-neutral-200">{t('prefTheme')}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">{t('prefThemeHint')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {APP_THEMES.map(theme => (
          <button
            key={theme.value}
            onClick={() => onChange(theme.value)}
            title={theme.label}
            className={`group flex flex-col items-center gap-1.5 cursor-pointer transition-opacity ${
              value === theme.value ? 'opacity-100' : 'opacity-60 hover:opacity-90'
            }`}
          >
            {/* Swatch strip — extra outline ensures visibility on light and dark bg */}
            <div
              className={`flex h-8 w-16 overflow-hidden border rounded-md transition-all ${
                value === theme.value
                  ? 'border-signal ring-1 ring-signal/50'
                  : 'border-neutral-700 group-hover:border-neutral-500'
              }`}
              style={theme.dark ? undefined : { outline: '1px solid #d1d5db', outlineOffset: '-1px' }}
            >
              {theme.swatches.map((color, i) => (
                <div key={i} className="flex-1 h-full" style={{ background: color }} />
              ))}
            </div>
            <span className={`text-[10px] font-medium leading-none ${
              value === theme.value ? 'text-neutral-100' : 'text-neutral-500'
            }`}>
              {theme.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Locale names ───────────────────────────────────────────────────────────────

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'zh', label: '中文' },
  { value: 'ru', label: 'Русский' },
] as const;

// ── Flag-based language select ───────────────────────────────────────────────────

function LocaleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOCALE_OPTIONS.find(l => l.value === value) ?? LOCALE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative w-48 shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center gap-2.5 bg-neutral-950 border rounded-md px-3 py-2 text-sm text-neutral-100 transition-colors cursor-pointer ${
          open ? 'border-signal/60' : 'border-neutral-700 hover:border-neutral-600'
        }`}
      >
        <FlagIcon code={current.value} size={18} />
        <span className="flex-1 text-left truncate">{current.label}</span>
        <ChevronDown size={15} className={`shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-1.5 left-0 right-0 z-10 bg-neutral-900 border border-neutral-800 rounded-md py-1 modal-shadow max-h-64 overflow-y-auto"
        >
          {LOCALE_OPTIONS.map(lang => {
            const selected = lang.value === value;
            return (
              <button
                key={lang.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(lang.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                  selected ? 'text-signal-text bg-signal/10' : 'text-neutral-300 hover:bg-neutral-800/60'
                }`}
              >
                <FlagIcon code={lang.value} size={18} />
                <span className="flex-1 truncate">{lang.label}</span>
                {selected && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Language preference row ───────────────────────────────────────────────────────

function LanguagePrefRow({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="py-4 border-b border-neutral-800 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        {hint && <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>}
      </div>
      <LocaleSelect value={value} onChange={onChange} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}

interface UserSettingsModalProps {
  currentUser: CurrentUser;
  onClose: () => void;
}

type Tab = 'account' | 'preferences' | 'desktop' | 'import';

// ── Editable profile (avatar + display name) ────────────────────────────────────

function ProfileSection({ currentUser }: { currentUser: CurrentUser }) {
  const t = useTranslations('UserSettings');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(currentUser.image ?? null);
  const [name, setName] = useState(currentUser.name ?? '');
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [err, setErr] = useState('');
  const [cropObjectUrl, setCropObjectUrl] = useState<string | null>(null);

  const initials = (name || currentUser.email || 'U').trim().charAt(0).toUpperCase();
  const nameTrim = name.trim();
  const nameChanged = nameTrim.length > 0 && nameTrim !== (currentUser.name ?? '').trim();

  async function uploadBlob(blob: Blob) {
    setErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      fd.append('kind', 'icon');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('profileUploadError'));
      await updateMyProfile({ image: data.url });
      setImage(data.url);
      setAvatarError(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('profileUploadError'));
    } finally {
      setUploading(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Show crop dialog before uploading
    const url = URL.createObjectURL(file);
    setCropObjectUrl(url);
  }

  function onCropConfirm(blob: Blob) {
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    setCropObjectUrl(null);
    uploadBlob(blob);
  }

  function onCropCancel() {
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    setCropObjectUrl(null);
  }

  async function onRemove() {
    setErr('');
    setUploading(true);
    try {
      await updateMyProfile({ image: null });
      setImage(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('profileUploadError'));
    } finally {
      setUploading(false);
    }
  }

  async function onSaveName() {
    if (!nameChanged || savingName) return;
    setErr('');
    setSavingName(true);
    try {
      await updateMyProfile({ name: nameTrim });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('profileSaveError'));
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="space-y-5">
      {cropObjectUrl && (
        <AvatarCropModal
          objectUrl={cropObjectUrl}
          onConfirm={onCropConfirm}
          onCancel={onCropCancel}
        />
      )}

      {/* Avatar + actions */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0 group">
          {image && !avatarError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={name || 'User'}
              className="w-16 h-16 rounded-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center text-2xl font-semibold text-neutral-200">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={t('profileUpload')}
            className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 disabled:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs font-medium px-3 py-1.5 border border-neutral-700 rounded-md text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {t('profileUpload')}
            </button>
            {image && (
              <button
                onClick={onRemove}
                disabled={uploading}
                className="text-xs font-medium px-3 py-1.5 border border-neutral-800 rounded-md text-neutral-400 hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('profileRemove')}
              </button>
            )}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">{t('profilePhotoHint')}</p>
        </div>
      </div>

      {/* Display name */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">
          {t('profileName')}
        </label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSaveName(); }}
            maxLength={80}
            placeholder={t('profileNamePlaceholder')}
            className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700 rounded-md text-neutral-100 px-3 py-2 text-sm outline-none focus:border-signal/60 transition-colors"
          />
          <button
            onClick={onSaveName}
            disabled={!nameChanged || savingName}
            className="shrink-0 text-xs font-semibold px-4 py-2 rounded-md bg-ink hover:bg-ink/88 text-ink-fg disabled:opacity-40 disabled:hover:bg-ink transition-colors cursor-pointer"
          >
            {savingName ? t('profileSaving') : t('profileSave')}
          </button>
        </div>
      </div>

      {/* Email (read-only) */}
      {currentUser.email && (
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">
            {t('profileEmail')}
          </label>
          <p className="text-sm text-neutral-400 truncate">{currentUser.email}</p>
        </div>
      )}

      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  );
}

// ── Danger zone: GDPR self-service account deletion ─────────────────────────────

function DeleteAccountSection({ email }: { email?: string | null }) {
  const t = useTranslations('UserSettings');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const canConfirm = confirmText.trim().toUpperCase() === 'DELETE';

  async function handleRequest() {
    if (!canConfirm || sending) return;
    setSending(true);
    setError('');
    const result = await requestAccountDeletion();
    setSending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  }

  function closeConfirm() {
    if (sending) return;
    setShowConfirm(false);
    setConfirmText('');
    setError('');
    setSent(false);
  }

  return (
    <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-lg space-y-3">
      <h4 className="text-xs font-medium text-red-400">{t('dangerZoneTitle')}</h4>
      <p className="text-xs text-neutral-400 leading-relaxed">{t('deleteAccountHint')}</p>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-xs bg-red-400 hover:bg-red-500 text-white font-semibold py-1.5 px-3 rounded-md transition-colors cursor-pointer"
      >
        {t('deleteAccountButton')}
      </button>

      {showConfirm && (
        <>
          <div className="fixed inset-0 z-300 bg-black/60" onClick={closeConfirm} />
          <div className="fixed z-300 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm bg-neutral-850 border border-neutral-800 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            {sent ? (
              <>
                <div className="flex items-start gap-2.5">
                  <Mail size={16} className="text-signal-text shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-100 mb-1.5">{t('deleteAccountEmailSentTitle')}</p>
                    <p className="text-xs text-neutral-400 leading-relaxed">{t('deleteAccountEmailSentBody', { email: email || '' })}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={closeConfirm}
                    className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {t('deleteAccountCancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-100 mb-1.5">{t('deleteAccountConfirmTitle')}</p>
                    <p className="text-xs text-neutral-400 leading-relaxed">{t('deleteAccountConfirmBody')}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                    {t('deleteAccountConfirmInputLabel')}
                  </label>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRequest(); }}
                    placeholder="DELETE"
                    autoFocus
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-md text-neutral-100 px-3 py-2 text-sm outline-none focus:border-red-500/60 transition-colors"
                  />
                </div>
                {error && <p className="text-xs text-red-400 leading-relaxed">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={closeConfirm}
                    disabled={sending}
                    className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {t('deleteAccountCancel')}
                  </button>
                  <button
                    onClick={handleRequest}
                    disabled={!canConfirm || sending}
                    className="px-4 py-2 text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {sending ? t('deleteAccountSending') : t('deleteAccountRequestButton')}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function UserSettingsModal({ currentUser, onClose }: UserSettingsModalProps) {
  const t = useTranslations('UserSettings');
  const tBilling = useTranslations('Billing');
  const router = useRouter();
  const currentLocale = useLocale();

  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier | null>(null);
  const [billing, setBilling] = useState<null | 'details' | 'upgrade'>(null);
  const [isTauri, setIsTauri] = useState(false);

  const isDemo = currentUser.role === 'demo';

  // Detect the desktop shell — the Desktop tab (zoom + download folder) only
  // makes sense (and its Tauri commands only resolve) inside Tauri.
  useEffect(() => {
    setIsTauri('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  }, []);

  // Preference states — read from cookie-derived data attributes on <html>
  const [locale, setLocaleState] = useState(currentLocale);
  const [editorSize, setEditorSizeState] = useState<EditorFontSize>(() => {
    if (typeof document === 'undefined') return 'md';
    return (document.documentElement.dataset.editorSize as EditorFontSize) ?? 'md';
  });
  const [density, setDensityState] = useState<SidebarDensity>('comfortable');
  const [defaultWidth, setDefaultWidthState] = useState<DefaultPageWidth>(() => {
    if (typeof document === 'undefined') return 'narrow';
    return (document.documentElement.dataset.defaultWidth as DefaultPageWidth) ?? 'narrow';
  });
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof document === 'undefined') return 'remnus';
    return (document.documentElement.dataset.theme as AppTheme) ?? 'remnus';
  });

  useEffect(() => {
    getCurrentUserStorageBytes().then(setStorageBytes).catch(() => setStorageBytes(0));
    getMyTier().then(setPlanTier).catch(() => setPlanTier('free'));
  }, []);

  // Apply editor size immediately via data attribute + refresh for SSR components
  async function handleEditorSize(v: EditorFontSize) {
    setEditorSizeState(v);
    document.documentElement.dataset.editorSize = v;
    await setEditorFontSize(v);
  }

  async function handleDensity(v: SidebarDensity) {
    setDensityState(v);
    await setSidebarDensity(v);
    router.refresh();
  }

  async function handleDefaultWidth(v: DefaultPageWidth) {
    setDefaultWidthState(v);
    document.documentElement.dataset.defaultWidth = v;
    await setDefaultPageWidth(v);
  }

  async function handleLocale(v: string) {
    setLocaleState(v);
    await setLocale(v);
    router.refresh();
  }

  async function handleTheme(v: AppTheme) {
    setThemeState(v);
    document.documentElement.dataset.theme = v;
    await setTheme(v);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: t('tabAccount'), icon: <User size={13} /> },
    { id: 'preferences', label: t('tabPreferences'), icon: <SlidersHorizontal size={13} /> },
    ...(isTauri ? [{ id: 'desktop' as Tab, label: t('tabDesktop'), icon: <Monitor size={13} /> }] : []),
    { id: 'import', label: t('tabImport'), icon: <Download size={13} /> },
  ];

  return (
    <>
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '92vh', minHeight: 'min(480px, 85vh)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
          <span className="text-sm font-semibold text-neutral-100 shrink-0">{t('title')}</span>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mobile tab strip */}
        <div className="flex sm:hidden border-b border-neutral-800 bg-neutral-900/50 shrink-0 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs whitespace-nowrap border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'border-signal text-neutral-100 font-medium'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Body: left nav + content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Desktop left nav */}
          <div className="hidden sm:flex w-44 shrink-0 border-r border-neutral-800 flex-col bg-neutral-900/50">
            <nav className="flex-1 p-2 space-y-0.5 pt-3">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer rounded ${
                    activeTab === tab.id
                      ? 'bg-neutral-800 text-neutral-100 font-medium'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div key={activeTab} className="flex-1 overflow-y-auto p-4 sm:p-6 animate-tab-fade">

          {/* Account */}
          {activeTab === 'account' && (
              <div className="space-y-6">
                <ProfileSection currentUser={currentUser} />

                <div className="border-t border-neutral-800 pt-5 space-y-4">
                  <p className="text-xs font-medium text-neutral-500">{t('planTitle')}</p>
                  <div className="py-3 border-b border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Crown size={14} className="text-amber-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-neutral-200">
                            {planTier === null ? '—' : tBilling(`tier_${planTier}` as 'tier_free')}
                          </p>
                          {planTier === 'free' && (
                            <p className="text-[11px] text-neutral-500 mt-0.5">{t('planFreeHint')}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-neutral-800 text-neutral-500 border border-neutral-700 rounded-md shrink-0">
                        {t('planCurrentBadge')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBilling('details')}
                        className="text-xs font-medium px-3 py-1.5 border border-neutral-700 rounded-md text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        {t('planDetails')}
                      </button>
                      {planTier !== 'enterprise' && (
                        <button
                          onClick={() => setBilling('upgrade')}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-ink hover:bg-ink/88 text-ink-fg transition-colors cursor-pointer"
                        >
                          {tBilling('upgrade')}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-medium text-neutral-500 pt-1">{t('storageTitle')}</p>
                  <div className="flex items-center gap-3 py-3 border-b border-neutral-800">
                    <HardDrive size={14} className="text-neutral-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-300">
                        {storageBytes === null
                          ? t('storageLoading')
                          : t('storageUsed', { size: formatBytes(storageBytes) })}
                      </p>
                      <p className="text-[11px] text-neutral-600 mt-0.5">{t('storageHint')}</p>
                    </div>
                  </div>
                </div>

                {!isDemo && <DeleteAccountSection email={currentUser.email} />}
          </div>
          )}

          {/* Preferences */}
          {activeTab === 'preferences' && (
            <div>
              <ThemePicker value={theme} onChange={handleTheme} />
              <LanguagePrefRow
                label={t('prefLanguage')}
                hint={t('prefLanguageHint')}
                value={locale}
                onChange={handleLocale}
              />
              <PrefRow
                label={t('prefEditorSize')}
                hint={t('prefEditorSizeHint')}
                options={[
                  { value: 'sm', label: t('prefSizeSmall') },
                  { value: 'md', label: t('prefSizeMedium') },
                  { value: 'lg', label: t('prefSizeLarge') },
                ]}
                value={editorSize}
                onChange={handleEditorSize}
              />
              <PrefRow
                label={t('prefSidebarDensity')}
                hint={t('prefSidebarDensityHint')}
                options={[
                  { value: 'compact', label: t('prefDensityCompact') },
                  { value: 'comfortable', label: t('prefDensityComfortable') },
                ]}
                value={density}
                onChange={handleDensity}
              />
              <PrefRow
                label={t('prefDefaultWidth')}
                hint={t('prefDefaultWidthHint')}
                options={[
                  { value: 'narrow', label: t('prefWidthNarrow') },
                  { value: 'wide', label: t('prefWidthWide') },
                  { value: 'full', label: t('prefWidthFull') },
                ]}
                value={defaultWidth}
                onChange={handleDefaultWidth}
              />
            </div>
          )}

          {/* Desktop (Tauri only) */}
          {activeTab === 'desktop' && isTauri && (
            <DesktopTab />
          )}

          {/* Import */}
          {activeTab === 'import' && (
            <ImportTab workspaceId="" />
          )}
          </div>
        </div>
      </div>
    </div>

    {billing && (
      <BillingModal
        isDemo={isDemo}
        initialPickerOpen={billing === 'upgrade'}
        onClose={() => {
          setBilling(null);
          getMyTier().then(setPlanTier).catch(() => {});
        }}
      />
    )}
    </>
  );
}
