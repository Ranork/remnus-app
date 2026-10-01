'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { User, Download, HardDrive, Crown, SlidersHorizontal, Camera, Loader2, Monitor, AlertTriangle, Mail } from 'lucide-react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
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
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { DangerZone, Field, SettingsList, SettingsPage, SettingsRow, SettingsSection } from '@/components/ui/settings';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Preference row: a label and a segmented choice ──────────────────────────────

function PrefRow<T extends string>({
  label, hint, options, value, onChange,
}: {
  label: string;
  hint?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <SettingsRow label={label} hint={hint}>
      <SegmentedControl value={value} onValueChange={onChange} aria-label={label}>
        {options.map(opt => (
          <SegmentedControlItem key={opt.value} value={opt.value}>{opt.label}</SegmentedControlItem>
        ))}
      </SegmentedControl>
    </SettingsRow>
  );
}

// ── Theme picker: a radio group of swatch strips (desk · sheet · signal) ─────────────

function ThemePicker({ value, onChange }: { value: AppTheme; onChange: (v: AppTheme) => void }) {
  const t = useTranslations('UserSettings');
  return (
    <SettingsSection title={t('prefTheme')} description={t('prefThemeHint')}>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as AppTheme)}
        aria-label={t('prefTheme')}
        className="flex flex-wrap gap-3"
      >
        {APP_THEMES.map(theme => (
          <Radio.Root
            key={theme.value}
            value={theme.value}
            className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-control p-1 select-none"
          >
            <span
              aria-hidden
              className="flex h-9 w-18 overflow-hidden rounded-control shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow group-hover:shadow-[inset_0_0_0_1px_var(--color-fg-4)] group-data-checked:shadow-[0_0_0_2px_var(--color-signal)]"
            >
              {theme.swatches.map((color, i) => (
                <span key={i} className={i === 2 ? 'w-3 shrink-0' : 'flex-1'} style={{ background: color }} />
              ))}
            </span>
            <span className="text-2xs font-medium text-fg-3 group-hover:text-fg-2 group-data-checked:text-fg">
              {theme.label}
            </span>
          </Radio.Root>
        ))}
      </RadioGroup>
    </SettingsSection>
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
].map(l => ({ ...l, icon: <FlagIcon code={l.value} size={16} /> }));

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
    <SettingsSection>
      {cropObjectUrl && (
        <AvatarCropModal
          objectUrl={cropObjectUrl}
          onConfirm={onCropConfirm}
          onCancel={onCropCancel}
        />
      )}

      {/* Avatar + actions */}
      <div className="flex items-center gap-4">
        <div className="group relative shrink-0">
          {image && !avatarError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={name || 'User'}
              className="size-16 rounded-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-hover text-2xl font-semibold text-fg-2">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={t('profileUpload')}
            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {t('profileUpload')}
            </Button>
            {image && (
              <Button size="sm" variant="ghost" onClick={onRemove} disabled={uploading}>
                {t('profileRemove')}
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-fg-3">{t('profilePhotoHint')}</p>
        </div>
      </div>

      <Field label={t('profileName')} htmlFor="settings-profile-name">
        <div className="flex gap-2">
          <Input
            id="settings-profile-name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSaveName(); }}
            maxLength={80}
            placeholder={t('profileNamePlaceholder')}
            className="flex-1"
          />
          <Button variant="primary" onClick={onSaveName} disabled={!nameChanged} loading={savingName}>
            {t('profileSave')}
          </Button>
        </div>
      </Field>

      {currentUser.email && (
        <Field label={t('profileEmail')}>
          <p className="truncate text-ui text-fg-2">{currentUser.email}</p>
        </Field>
      )}

      {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
    </SettingsSection>
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
    <DangerZone
      title={t('dangerZoneTitle')}
      description={t('deleteAccountHint')}
      action={
        <Button variant="danger" size="sm" onClick={() => setShowConfirm(true)}>
          {t('deleteAccountButton')}
        </Button>
      }
    >
      {showConfirm && (
        <Dialog open onOpenChange={(open) => { if (!open) closeConfirm(); }}>
          <DialogContent showCloseButton={false}>
            {sent ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Mail size={16} className="shrink-0 text-fg-3" />
                    {t('deleteAccountEmailSentTitle')}
                  </DialogTitle>
                  <DialogDescription>{t('deleteAccountEmailSentBody', { email: email || '' })}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={closeConfirm}>{t('deleteAccountCancel')}</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0 text-red-400" />
                    {t('deleteAccountConfirmTitle')}
                  </DialogTitle>
                  <DialogDescription>{t('deleteAccountConfirmBody')}</DialogDescription>
                </DialogHeader>
                <Field label={t('deleteAccountConfirmInputLabel')} htmlFor="settings-delete-account" error={error || undefined}>
                  <Input
                    id="settings-delete-account"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRequest(); }}
                    placeholder="DELETE"
                    autoComplete="off"
                    autoFocus
                    className="font-mono"
                  />
                </Field>
                <DialogFooter>
                  <Button onClick={closeConfirm} disabled={sending}>{t('deleteAccountCancel')}</Button>
                  <Button variant="danger" onClick={handleRequest} disabled={!canConfirm} loading={sending}>
                    {t('deleteAccountRequestButton')}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </DangerZone>
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
    { id: 'account', label: t('tabAccount'), icon: <User /> },
    { id: 'preferences', label: t('tabPreferences'), icon: <SlidersHorizontal /> },
    ...(isTauri ? [{ id: 'desktop' as Tab, label: t('tabDesktop'), icon: <Monitor /> }] : []),
    { id: 'import', label: t('tabImport'), icon: <Download /> },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <Tabs
          variant="nav"
          orientation="vertical"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as Tab)}
        >
          <TabsList aria-label={t('title')}>
            {tabs.map(tab => (
              <TabsTab key={tab.id} value={tab.id}>
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </TabsTab>
            ))}
          </TabsList>

          <DialogBody className="sm:px-6 sm:py-5">
            <TabsPanel value="account" className="animate-tab-fade">
              <SettingsPage>
                <ProfileSection currentUser={currentUser} />

                <SettingsSection title={t('planTitle')}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Crown size={16} className="mt-0.5 shrink-0 text-fg-3" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-ui font-medium text-fg">
                          {planTier === null ? '—' : tBilling(`tier_${planTier}` as 'tier_free')}
                          <Badge variant="outline" size="sm">{t('planCurrentBadge')}</Badge>
                        </p>
                        {planTier === 'free' && (
                          <p className="mt-0.5 text-xs text-fg-3">{t('planFreeHint')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => setBilling('details')}>
                        {t('planDetails')}
                      </Button>
                      {planTier !== 'enterprise' && (
                        <Button size="sm" variant="primary" onClick={() => setBilling('upgrade')}>
                          {tBilling('upgrade')}
                        </Button>
                      )}
                    </div>
                  </div>
                </SettingsSection>

                <SettingsSection title={t('storageTitle')}>
                  <div className="flex items-start gap-2.5">
                    <HardDrive size={16} className="mt-0.5 shrink-0 text-fg-3" />
                    <div className="min-w-0">
                      <p className="text-ui text-fg">
                        {storageBytes === null
                          ? t('storageLoading')
                          : t('storageUsed', { size: formatBytes(storageBytes) })}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-3">{t('storageHint')}</p>
                    </div>
                  </div>
                </SettingsSection>

                {!isDemo && <DeleteAccountSection email={currentUser.email} />}
              </SettingsPage>
            </TabsPanel>

            <TabsPanel value="preferences" className="animate-tab-fade">
              <SettingsPage>
                <ThemePicker value={theme} onChange={handleTheme} />
                <SettingsSection>
                  <SettingsList>
                    <SettingsRow label={t('prefLanguage')} hint={t('prefLanguageHint')}>
                      <SimpleSelect
                        value={locale}
                        onValueChange={handleLocale}
                        options={LOCALE_OPTIONS}
                        aria-label={t('prefLanguage')}
                        className="w-44"
                      />
                    </SettingsRow>
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
                  </SettingsList>
                </SettingsSection>
              </SettingsPage>
            </TabsPanel>

            {isTauri && (
              <TabsPanel value="desktop" className="animate-tab-fade">
                <DesktopTab />
              </TabsPanel>
            )}

            <TabsPanel value="import" className="animate-tab-fade">
              <ImportTab workspaceId="" />
            </TabsPanel>
          </DialogBody>
        </Tabs>

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
      </DialogContent>
    </Dialog>
  );
}
