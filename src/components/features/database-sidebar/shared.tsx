'use client';

import { useState } from 'react';
import { Type, List, Tags, Hash, Calendar, Clock, AlignLeft, CheckSquare, Link, Mail, Phone, ChevronDown } from 'lucide-react';

export function getPropertyIcon(type: string) {
  switch (type) {
    case 'text':         return <Type size={11} className="text-neutral-500 shrink-0" />;
    case 'select':       return <List size={11} className="text-neutral-500 shrink-0" />;
    case 'multi_select': return <Tags size={11} className="text-neutral-500 shrink-0" />;
    case 'number':       return <Hash size={11} className="text-neutral-500 shrink-0" />;
    case 'date':         return <Calendar size={11} className="text-neutral-500 shrink-0" />;
    case 'datetime':     return <Clock size={11} className="text-neutral-500 shrink-0" />;
    case 'checkbox':     return <CheckSquare size={11} className="text-neutral-500 shrink-0" />;
    case 'url':          return <Link size={11} className="text-neutral-500 shrink-0" />;
    case 'email':        return <Mail size={11} className="text-neutral-500 shrink-0" />;
    case 'phone':        return <Phone size={11} className="text-neutral-500 shrink-0" />;
    default:             return <AlignLeft size={11} className="text-neutral-500 shrink-0" />;
  }
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-colors rounded-sm ${
      checked ? 'bg-blue-500 border-blue-500' : 'border-neutral-700'
    }`}>
      {checked && <span className="text-[8px] font-bold text-white leading-none">✓</span>}
    </span>
  );
}

export const selectCls = 'bg-neutral-900 border border-neutral-800 text-neutral-300 outline-none cursor-pointer focus:border-neutral-700 transition-colors rounded text-xs py-1.5 px-2';

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
    <div className="border-b border-neutral-800/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/10 transition-colors cursor-pointer"
      >
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</span>
        <ChevronDown
          size={12}
          className={`text-neutral-600 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && children}
    </div>
  );
}
