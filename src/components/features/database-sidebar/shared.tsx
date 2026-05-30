import { Type, List, Tags, Hash, Calendar, Clock, AlignLeft } from 'lucide-react';

export function getPropertyIcon(type: string) {
  switch (type) {
    case 'text':         return <Type size={11} className="text-neutral-500 shrink-0" />;
    case 'select':       return <List size={11} className="text-neutral-500 shrink-0" />;
    case 'multi_select': return <Tags size={11} className="text-neutral-500 shrink-0" />;
    case 'number':       return <Hash size={11} className="text-neutral-500 shrink-0" />;
    case 'date':         return <Calendar size={11} className="text-neutral-500 shrink-0" />;
    case 'datetime':     return <Clock size={11} className="text-neutral-500 shrink-0" />;
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
