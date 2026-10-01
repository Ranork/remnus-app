'use client';

import { useState } from 'react';
import { Type, List, Tags, Hash, Calendar, Clock, AlignLeft, CheckSquare, CircleDashed, User, Users, Link, Mail, Phone, ChevronDown, Fingerprint } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';

export function getPropertyIcon(type: string) {
  const cls = 'text-fg-3 shrink-0';
  switch (type) {
    case 'id':           return <Fingerprint size={12} className={cls} />;
    case 'text':         return <Type size={12} className={cls} />;
    case 'select':       return <List size={12} className={cls} />;
    case 'multi_select': return <Tags size={12} className={cls} />;
    case 'status':       return <CircleDashed size={12} className={cls} />;
    case 'user':         return <User size={12} className={cls} />;
    case 'multi_user':   return <Users size={12} className={cls} />;
    case 'number':       return <Hash size={12} className={cls} />;
    case 'date':         return <Calendar size={12} className={cls} />;
    case 'datetime':     return <Clock size={12} className={cls} />;
    case 'checkbox':     return <CheckSquare size={12} className={cls} />;
    case 'url':          return <Link size={12} className={cls} />;
    case 'email':        return <Mail size={12} className={cls} />;
    case 'phone':        return <Phone size={12} className={cls} />;
    default:             return <AlignLeft size={12} className={cls} />;
  }
}

/**
 * One on/off row of the view settings (a column to show, a group to hide, a card
 * property): the whole row is the label, the box is the shared `Checkbox`.
 */
export function ToggleRow({
  checked,
  onToggle,
  disabled,
  children,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 text-xs transition-colors',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-hover/60',
        className,
      )}
    >
      {children}
      <Checkbox size="sm" checked={checked} onCheckedChange={() => onToggle()} disabled={disabled} className="ml-auto" />
    </label>
  );
}

// A compact field-shaped control (the sort direction toggle); matches SimpleSelect sm.
export const selectCls = 'h-7 rounded-control border border-line bg-raised px-2 text-xs text-fg-2 outline-none cursor-pointer transition-colors hover:border-line-strong hover:text-fg focus-visible:border-focus';

export function CollapsibleSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer text-ui font-medium text-fg-2 transition-colors hover:text-fg"
      >
        <span>{label}</span>
        <ChevronDown
          size={14}
          className={`text-fg-4 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && children}
    </div>
  );
}
