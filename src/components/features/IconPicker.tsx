'use client';
import React, { useState, useEffect, useRef } from 'react';
import { CURATED_ICONS, ICON_COLORS, ICON_COLOR_HEX } from './PageIcon';
import { X, Smile, Star, Trash2, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
      className={`z-50 bg-neutral-850 border border-neutral-800 shadow-2xl p-4 w-72 rounded-lg text-left text-neutral-200 animate-fade-in animate-duration-150 ${coords ? '' : 'absolute'}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
        <span className="text-xs font-medium text-neutral-400">{t('title')}</span>
        <div className="flex items-center gap-1.5">
          {currentIcon && (
            <button
              onClick={handleRemove}
              className="p-1 hover:bg-neutral-800 text-red-400 hover:text-red-300 rounded transition-colors cursor-pointer"
              title={t('remove')}
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 rounded transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-850 mb-3 text-xs">
        <button
          onClick={() => setActiveTab('emoji')}
          className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-colors font-medium border-b-2 cursor-pointer ${
            activeTab === 'emoji'
              ? 'border-signal text-fg'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Smile size={13} />
          <span>{t('tabEmoji')}</span>
        </button>
        <button
          onClick={() => setActiveTab('lucide')}
          className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-colors font-medium border-b-2 cursor-pointer ${
            activeTab === 'lucide'
              ? 'border-signal text-fg'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Star size={13} />
          <span>{t('tabIcon')}</span>
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-colors font-medium border-b-2 cursor-pointer ${
            activeTab === 'upload'
              ? 'border-signal text-fg'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Upload size={13} />
          <span>{t('tabUpload')}</span>
        </button>
      </div>

      {/* Emoji Panel */}
      {activeTab === 'emoji' && (
        <div className="space-y-3">
          <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto pr-1">
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="w-7 h-7 flex items-center justify-center text-base hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomEmojiSubmit} className="flex gap-2 pt-2 border-t border-neutral-850">
            <input
              type="text"
              placeholder={t('customEmojiPlaceholder')}
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              maxLength={4}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700"
            />
            <button
              type="submit"
              disabled={!customEmoji.trim()}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-750 disabled:opacity-40 text-xs font-medium text-white rounded transition-colors cursor-pointer"
            >
              {t('add')}
            </button>
          </form>
        </div>
      )}

      {/* Lucide Panel */}
      {activeTab === 'lucide' && (
        <div className="space-y-3">
          {/* Color Selector */}
          <div className="flex justify-between items-center gap-1 py-1">
            {Object.keys(ICON_COLORS).map((colorKey) => (
              <button
                key={colorKey}
                onClick={() => handleColorClick(colorKey)}
                style={{ backgroundColor: ICON_COLOR_HEX[colorKey] }}
                className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                  selectedColor === colorKey
                    ? 'border-white scale-110 shadow-sm'
                    : 'border-transparent hover:scale-105'
                }`}
                title={colorKey}
              />
            ))}
          </div>

          {/* Icons Grid */}
          <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto pr-1">
            {Object.entries(CURATED_ICONS).map(([name, IconComponent]) => {
              const colorClass = selectedColor === 'default' ? 'text-neutral-400 group-hover:text-neutral-200' : ICON_COLORS[selectedColor];
              return (
                <button
                  key={name}
                  onClick={() => handleLucideClick(name)}
                  className="group w-7 h-7 flex items-center justify-center hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                  title={name}
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
        <div className="space-y-3">
          {/* Preview / drop zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full h-28 border border-dashed border-neutral-700 hover:border-neutral-500 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden relative"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <>
                <ImageIcon size={22} className="text-neutral-600" />
                <span className="text-xs text-neutral-500">{t('uploadHint')}</span>
              </>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-neutral-900/70 flex items-center justify-center rounded-lg">
                <Loader2 size={20} className="text-signal-text animate-spin" />
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
            <p className="text-[11px] text-red-400 leading-tight">{uploadError}</p>
          )}

          <p className="text-[10px] text-neutral-600 leading-tight">{t('uploadLimit')}</p>
        </div>
      )}
    </div>
  );
}
