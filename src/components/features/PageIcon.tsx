'use client';
import React from 'react';
import * as LucideIcons from 'lucide-react';

// Curated list of popular Lucide icons for the picker
export const CURATED_ICONS: Record<string, React.ComponentType<any>> = {
  Heart: LucideIcons.Heart,
  Smile: LucideIcons.Smile,
  Star: LucideIcons.Star,
  Book: LucideIcons.Book,
  Compass: LucideIcons.Compass,
  Briefcase: LucideIcons.Briefcase,
  Gift: LucideIcons.Gift,
  Bell: LucideIcons.Bell,
  Target: LucideIcons.Target,
  Code: LucideIcons.Code,
  Flame: LucideIcons.Flame,
  Zap: LucideIcons.Zap,
  Award: LucideIcons.Award,
  HelpCircle: LucideIcons.HelpCircle,
  Activity: LucideIcons.Activity,
  FileText: LucideIcons.FileText,
  Database: LucideIcons.Database,
  Calendar: LucideIcons.Calendar,
  Layers: LucideIcons.Layers,
  Map: LucideIcons.Map,
  ShoppingBag: LucideIcons.ShoppingBag,
  Music: LucideIcons.Music,
  Globe: LucideIcons.Globe,
  Coffee: LucideIcons.Coffee,
  Bookmark: LucideIcons.Bookmark,
  CheckSquare: LucideIcons.CheckSquare,
  TrendingUp: LucideIcons.TrendingUp,
  Mail: LucideIcons.Mail,
  User: LucideIcons.User,
  Users: LucideIcons.Users,
  Settings: LucideIcons.Settings,
  Lock: LucideIcons.Lock,
  Key: LucideIcons.Key,
  Shield: LucideIcons.Shield,
  Laptop: LucideIcons.Laptop,
  Cpu: LucideIcons.Cpu,
  Folder: LucideIcons.Folder,
  Link: LucideIcons.Link,
  Hash: LucideIcons.Hash,
  Sun: LucideIcons.Sun,
  Moon: LucideIcons.Moon,
  Cloud: LucideIcons.Cloud,
  Flag: LucideIcons.Flag,
  Tag: LucideIcons.Tag,
  Sparkles: LucideIcons.Sparkles,
  Lightbulb: LucideIcons.Lightbulb,
  MapPin: LucideIcons.MapPin,
  DollarSign: LucideIcons.DollarSign,
  Tv: LucideIcons.Tv,
  Headphones: LucideIcons.Headphones,
  Camera: LucideIcons.Camera,
  Video: LucideIcons.Video,
  Phone: LucideIcons.Phone,
  CreditCard: LucideIcons.CreditCard,
  ShoppingCart: LucideIcons.ShoppingCart,
  Package: LucideIcons.Package,
  Truck: LucideIcons.Truck,
  Wand2: LucideIcons.Wand2,
  Umbrella: LucideIcons.Umbrella,
  Wind: LucideIcons.Wind,
  Droplet: LucideIcons.Droplet,
  Terminal: LucideIcons.Terminal,
  MessageSquare: LucideIcons.MessageSquare,
  Send: LucideIcons.Send,
  PieChart: LucideIcons.PieChart,
  BarChart2: LucideIcons.BarChart2,
  LineChart: LucideIcons.LineChart,
  Trophy: LucideIcons.Trophy,
  Eye: LucideIcons.Eye,
  Search: LucideIcons.Search,
  Trash2: LucideIcons.Trash2,
  HeartHandshake: LucideIcons.HeartHandshake,
};

// Map of friendly color keys to tailwind color classes
export const ICON_COLORS: Record<string, string> = {
  default: 'text-neutral-500',
  red: 'text-red-400',
  orange: 'text-amber-500',
  yellow: 'text-yellow-400',
  green: 'text-green-400',
  teal: 'text-teal-400',
  blue: 'text-blue-500',
  purple: 'text-purple-400',
  pink: 'text-pink-400',
};

// Inline color values for styling when Tailwind classes don't cover everything
export const ICON_COLOR_HEX: Record<string, string> = {
  default: '#80838a',
  red: '#cd4d55',
  orange: '#cc7d45',
  yellow: '#e0af68',
  green: '#7fc36d',
  teal: '#2ac3a2',
  blue: '#445c95',
  purple: '#9d7cd8',
  pink: '#f7768e',
};

interface PageIconProps {
  icon: string | null | undefined;
  iconColor?: string | null | undefined;
  size?: number;
  className?: string;
  fallbackType?: 'page' | 'database';
  hideFallback?: boolean;
}

export default function PageIcon({
  icon,
  iconColor = 'default',
  size = 16,
  className = '',
  fallbackType = 'page',
  hideFallback = false,
}: PageIconProps) {
  const activeColor = iconColor || 'default';
  const colorClass = ICON_COLORS[activeColor] || ICON_COLORS.default;

  if (!icon) {
    if (hideFallback) return null;
    
    // Default fallback icons if no icon is specified
    if (fallbackType === 'database') {
      return <LucideIcons.Database size={size} className={`${colorClass} shrink-0 ${className}`} />;
    }
    return <LucideIcons.FileText size={size} className={`${colorClass} shrink-0 ${className}`} />;
  }

  // Check if it's a Lucide icon
  if (icon.startsWith('lucide:')) {
    const iconName = icon.replace('lucide:', '');
    const IconComp = CURATED_ICONS[iconName] || (fallbackType === 'database' ? LucideIcons.Database : LucideIcons.FileText);
    return <IconComp size={size} className={`${colorClass} shrink-0 ${className}`} />;
  }

  // Otherwise treat as Emoji
  return (
    <span 
      className={`shrink-0 leading-none flex items-center justify-center select-none ${className}`}
      style={{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }}
    >
      {icon}
    </span>
  );
}
