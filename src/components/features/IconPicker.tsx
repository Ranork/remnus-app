'use client';
import React, { useState, useEffect, useRef } from 'react';
import { CURATED_ICONS, ICON_COLORS, ICON_COLOR_HEX } from './PageIcon';
import { X, Smile, Star, Trash2 } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'emoji' | 'lucide'>(
    currentIcon?.startsWith('lucide:') ? 'lucide' : 'emoji'
  );
  const [selectedColor, setSelectedColor] = useState<string>(currentIconColor || 'default');
  const [customEmoji, setCustomEmoji] = useState<string>('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef?.current) return;
    
    const updatePosition = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const pickerHeight = 280; // approximate height
      const pickerWidth = 288;  // w-72 is 288px
      
      let fixedTop = rect.bottom + 4;
      let fixedLeft = rect.left;
      
      // Flip up if there's no room below
      if (fixedTop + pickerHeight > viewportHeight && rect.top - pickerHeight > 0) {
        fixedTop = rect.top - pickerHeight - 4;
      }
      
      // Clamp horizontally
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
    // If a Lucide icon is currently selected, update its color immediately
    if (currentIcon?.startsWith('lucide:')) {
      onSelect(currentIcon, colorKey);
    }
  };

  const handleRemove = () => {
    onSelect(null, null);
    onClose();
  };

  const pickerStyle: React.CSSProperties = coords 
    ? { position: 'fixed', top: coords.top, left: coords.left, zIndex: 100 }
    : {};

  return (
    <div 
      ref={pickerRef}
      style={pickerStyle}
      onClick={(e) => e.stopPropagation()}
      className={`z-50 bg-neutral-900 border border-neutral-800 shadow-2xl p-4 w-72 rounded-lg text-left text-neutral-200 animate-fade-in animate-duration-150 ${coords ? '' : 'absolute'}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Select Icon</span>
        <div className="flex items-center gap-1.5">
          {currentIcon && (
            <button
              onClick={handleRemove}
              className="p-1 hover:bg-neutral-800 text-red-400 hover:text-red-300 rounded transition-colors cursor-pointer"
              title="Remove icon"
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
              ? 'border-blue-500 text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Smile size={13} />
          <span>Emoji</span>
        </button>
        <button
          onClick={() => setActiveTab('lucide')}
          className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-colors font-medium border-b-2 cursor-pointer ${
            activeTab === 'lucide'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Star size={13} />
          <span>Icon</span>
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
              placeholder="Paste custom emoji..."
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
              Add
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
    </div>
  );
}
