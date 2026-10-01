'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { submitContactForm } from '@/lib/actions/contact';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';

const labelCls = 'text-ui font-medium text-fg-2';

export default function ContactForm() {
  const t = useTranslations('Contact');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const startedAtRef = useRef<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setStatus('idle');
    startTransition(async () => {
      const res = await submitContactForm({
        name,
        email,
        message,
        company,
        startedAt: startedAtRef.current ?? Date.now(),
      });
      if (res.ok) {
        setStatus('success');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        setStatus('error');
        setErrorMsg(res.error);
      }
    });
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[14px] bg-sheet p-7 shadow-sheet">
        <span className="flex size-10 items-center justify-center rounded-full bg-green-500/12 text-green-400">
          <CheckCircle2 size={20} />
        </span>
        <h3 className="m-0 text-lg font-semibold text-fg">{t('formSuccessTitle')}</h3>
        <p className="m-0 text-[15px] leading-relaxed text-fg-2">{t('formSuccessBody')}</p>
        <Button variant="outline" onClick={() => setStatus('idle')} className="mt-1 text-fg">
          {t('formSendAnother')}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex flex-col gap-4 rounded-[14px] bg-sheet p-6 shadow-sheet sm:p-7"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-name" className={labelCls}>
            {t('formNameLabel')}
          </label>
          <Input
            id="contact-name"
            name="name"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('formNamePlaceholder')}
            size="lg"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className={labelCls}>
            {t('formEmailLabel')}
          </label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('formEmailPlaceholder')}
            size="lg"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className={labelCls}>
          {t('formMessageLabel')}
        </label>
        <Textarea
          id="contact-message"
          name="message"
          required
          maxLength={5000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('formMessagePlaceholder')}
          className="resize-none text-sm"
        />
      </div>

      {/* Honeypot — hidden from real visitors (visually + from screen readers), left for bots to fill in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      {status === 'error' && <p className="text-sm text-red-400">{errorMsg}</p>}

      <Button type="submit" variant="primary" size="lg" loading={pending} aria-label={pending ? t('formSending') : undefined} className="mt-1 self-start">
        {t('formSubmit')}
      </Button>
    </form>
  );
}
