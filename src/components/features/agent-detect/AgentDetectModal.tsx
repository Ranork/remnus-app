'use client';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import { VscodeMark } from '@/components/features/agents/AgentMark';
import { EDITORS } from '@/lib/mcp/deeplinks';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
function DetectedIcon({ id, size = 20 }: { id: string; size?: number }) {
  const meta = EDITORS.find(e => e.id === id);
  if (id === 'vscode' || !meta?.aiMark) return <VscodeMark size={size} />;
  return <AIMark name={meta.aiMark} size={size} />;
}

interface Props {
  /** Editor ids Tauri detected on this device. */
  detected: { id: string }[];
  onConnect: () => void;
  onDismiss: () => void;
}

/**
 * One-time, Tauri-only "we found these on your device" modal. Shown after the
 * onboarding {@link WelcomeModal} has already been resolved, so the two never
 * stack on a brand-new user's very first launch. Dismissing hands off to the
 * persistent {@link AgentDetectNotice} sidebar pill — this modal itself never
 * reappears once dismissed (see AgentDetectGuide's localStorage flag).
 */
export default function AgentDetectModal({ detected, onConnect, onDismiss }: Props) {
  const t = useTranslations('Onboarding');

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent size="md" className="items-center text-center sm:max-w-md">
        <span className="flex size-11 items-center justify-center rounded-surface bg-signal-soft">
          <Sparkles size={20} className="text-signal-text" />
        </span>
        <DialogHeader className="items-center in-dialog-compact:px-8">
          <DialogTitle className="text-lg">{t('agentDetectTitle')}</DialogTitle>
          <DialogDescription className="max-w-xs">{t('agentDetectBody')}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-wrap justify-center gap-2">
          {detected.map(({ id }) => {
            const meta = EDITORS.find(e => e.id === id);
            return (
              <li key={id}>
                <Badge className="h-7 gap-1.5 px-2.5 text-xs">
                  <DetectedIcon id={id} size={14} />
                  {meta?.label ?? id}
                </Badge>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="w-full flex-col items-stretch">
          <Button variant="primary" size="lg" onClick={onConnect}>
            {t('agentDetectConnect')}
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            {t('agentDetectMaybeLater')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
