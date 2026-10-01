'use client';
import React, { useState, useEffect, useRef } from 'react';
import { CURATED_ICONS, ICON_COLORS, ICON_COLOR_HEX } from './PageIcon';
import { X, Smile, Star, Trash2, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

const POPULAR_EMOJIS = [
  '😊', '🚀', '📝', '📅', '💻', '🎨',
  '🍕', '💡', '🔒', '🔑', '🏠', '📈',
  '📁', '⚙️', '🔔', '✉️', '🌟', '❤️',
  '👍', '🎉', '🔥', '⚡', '🏆', '☕',
  '🎯', '🗺️', '🎵', '🌐', '💼', '📌',
  '😍', '😎', '🤔', '🥳', '🙌', '👏',
  '🎈', '🎁', '💎', '🛒', '💰', '💵',
  '✏️', '📚', '✂️', '📎', '🔍', '🛠️',
  '🌱', '☘️', '🍃', '☀️', '🌙', '⭐',
  '✈️', '🚗', '🏔️', '🏖️', '🐾', '🍎'
];

interface IconPickerProps {
  currentIcon: string | null | undefined;
  currentIconColor: string | null | undefined;
  onSelect: (icon: string | null, iconColor: string | null) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function IconPicker({
  currentIcon,
  currentIconColor = 'default',
  onSelect,
  onClose,
  anchorRef,
}: IconPickerProps) {
  const t = useTranslations('IconPicker');
  const tUi = useTranslations('UI');

  const initialTab = (): 'emoji' | 'lucide' | 'upload' => {
    if (currentIcon?.startsWith('lucide:')) return 'lucide';
    if (currentIcon?.startsWith('http')) return 'upload';
    return 'emoji';
  };

  const [activeTab, setActiveTab] = useState<'emoji' | 'lucide' | 'upload'>(initialTab());
  const [selectedColor, setSelectedColor] = useState<string>(currentIconColor || 'default');
  const [customEmoji, setCustomEmoji] = useState<string>('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Upload tab state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentIcon?.startsWith('http') ? currentIcon : null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!anchorRef?.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const pickerHeight = 320;
      const pickerWidth = 288;

      let fixedTop = rect.bottom + 4;
      let fixedLeft = rect.left;

      if (fixedTop + pickerHeight > viewportHeight && rect.top - pickerHeight > 0) {
        fixedTop = rect.top - pickerHeight - 4;
      }

      if (fixedLeft + pickerWidth > viewportWidth) {
        fixedLeft = viewportWidth - pickerWidth - 16;
      }
      if (fixedLeft < 16) {
        fixedLeft = 16;
      }

      setCoords({ top: fixedTop, left: fixedLeft });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji, null);
  };

  const handleCustomEmojiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customEmoji.trim();
    if (clean) {
      onSelect(clean, null);
    }
  };

  const handleLucideClick = (iconName: string) => {
    onSelect(`lucide:${iconName}`, selectedColor);
  };

  const handleColorClick = (colorKey: string) => {
    setSelectedColor(colorKey);
    if (currentIcon?.startsWith('lucide:')) {
      onSelect(currentIcon, colorKey);
    }
  };

  const handleRemove = () => {
    onSelect(null, null);
    onClose();
  };

  const resizeImage = (file: File, maxDimension = 512): Promise<File> =>
    new Promise((resolve) => {
      if (file.type === 'image/svg+xml') { resolve(file); return; }

      // Preserve alpha channel for formats that support it
      const hasAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
      const outputType = hasAlpha ? 'image/png' : 'image/jpeg';
      const outputExt  = hasAlpha ? '.png' : '.jpg';
      const quality    = hasAlpha ? undefined : 0.85;

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, outputExt), { type: outputType }));
          },
          outputType,
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;

    // Show local preview immediately (original file, before resize)
    const objectUrl = URL.createObjectURL(raw);
    setPreviewUrl(objectUrl);
    setUploadError(null);
    setIsUploading(true);

    try {
      const file = await resizeImage(raw);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('uploadError'));
      }
      const { url } = await res.json();
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(url);
      onSelect(url, null);
    } catch (err: unknown) {
      URL.revokeObjectURL(objectUrl);
      setUploadError(err instanceof Error ? err.message : t('uploadError'));
      setPreviewUrl(currentIcon?.startsWith('http') ? currentIcon : null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pickerStyle: React.CSSProperties = coords
    ? { position: 'fixed', top: coords.top, left: coords.left, zIndex: 100 }
    : {};

  return (
    <div
      ref={pickerRef}
      style={pickerStyle}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'z-50 w-72 rounded-surface bg-float p-3 text-left text-fg-2 shadow-float animate-fade-in',
        !coords && 'absolute',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 pl-1">
        <span className="text-xs font-medium text-fg-3">{t('title')}</span>
        <div className="flex items-center">
          {currentIcon && (
            <Tooltip content={t('remove')}>
              <Button variant="ghost" size="icon-sm" onClick={handleRemove} aria-label={t('remove')} className="hover:text-red-400">
                <Trash2 />
              </Button>
            </Tooltip>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={tUi('close')}>
            <X />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'emoji' | 'lucide' | 'upload')} className="mb-3">
        <TabsList>
          <TabsTab value="emoji" className="flex-1 justify-center"><Smile className="size-3.5" />{t('tabEmoji')}</TabsTab>
          <TabsTab value="lucide" className="flex-1 justify-center"><Star className="size-3.5" />{t('tabIcon')}</TabsTab>
          <TabsTab value="upload" className="flex-1 justify-center"><Upload className="size-3.5" />{t('tabUpload')}</TabsTab>
        </TabsList>
      </Tabs>

      {/* Emoji Panel */}
      {activeTab === 'emoji' && (
        <div className="flex flex-col gap-3">
          <div className="grid max-h-36 grid-cols-8 gap-1 overflow-y-auto pr-1">
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-sm text-base transition-colors hover:bg-hover"
              >
                {emoji}
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomEmojiSubmit} className="flex gap-2 border-t border-line pt-3">
            <Input
              size="sm"
              placeholder={t('customEmojiPlaceholder')}
              aria-label={t('customEmojiPlaceholder')}
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              maxLength={4}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!customEmoji.trim()}>
              {t('add')}
            </Button>
          </form>
        </div>
      )}

      {/* Lucide Panel */}
      {activeTab === 'lucide' && (
        <div className="flex flex-col gap-3">
          {/* Color Selector */}
          <div className="flex items-center justify-between gap-1 px-0.5 py-1">
            {Object.keys(ICON_COLORS).map((colorKey) => (
              <button
                key={colorKey}
                type="button"
                onClick={() => handleColorClick(colorKey)}
                style={{ backgroundColor: ICON_COLOR_HEX[colorKey] }}
                aria-label={colorKey}
                aria-pressed={selectedColor === colorKey}
                className={cn(
                  'size-4 cursor-pointer rounded-full transition-[box-shadow,scale]',
                  selectedColor === colorKey
                    ? 'scale-110 shadow-[0_0_0_2px_var(--color-float),0_0_0_3.5px_var(--color-fg)]'
                    : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:scale-105',
                )}
                title={colorKey}
              />
            ))}
          </div>

          {/* Icons Grid */}
          <div className="grid max-h-36 grid-cols-8 gap-1 overflow-y-auto pr-1">
            {Object.entries(CURATED_ICONS).map(([name, IconComponent]) => {
              const colorClass = selectedColor === 'default' ? 'text-fg-3 group-hover:text-fg' : ICON_COLORS[selectedColor];
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleLucideClick(name)}
                  className="group flex size-7 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-hover"
                  title={name}
                  aria-label={name}
                >
                  <IconComponent size={14} className={`${colorClass} transition-colors`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Panel */}
      {activeTab === 'upload' && (
        <div className="flex flex-col gap-3">
          {/* Preview / drop zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="relative flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-control border border-dashed border-line-strong transition-colors hover:border-fg-4 hover:bg-hover/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="size-full rounded-control object-cover"
              />
            ) : (
              <>
                <ImageIcon size={22} className="text-fg-4" />
                <span className="text-xs text-fg-3">{t('uploadHint')}</span>
              </>
            )}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-control bg-float/70">
                <Loader2 size={20} className="animate-spin text-fg-2" />
              </div>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />

          {uploadError && (
            <p role="alert" className="text-xs leading-tight text-red-400">{uploadError}</p>
          )}

          <p className="text-xs leading-snug text-fg-3">{t('uploadLimit')}</p>
        </div>
      )}
    </div>
  );
}
