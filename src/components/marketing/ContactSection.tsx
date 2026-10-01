import { getTranslations } from 'next-intl/server';
import { GitBranch, Mail, MessageSquare } from 'lucide-react';
import PageHead from './site/PageHead';
import ContactForm from './ContactForm';

export default async function ContactSection() {
  const t = await getTranslations('Contact');

  const channels = [
    { icon: GitBranch, title: t('githubTitle'), desc: t('githubDesc'), label: 'github.com/Ranork/remnus-app', href: 'https://github.com/Ranork/remnus-app' },
    { icon: Mail, title: t('emailTitle'), desc: t('emailDesc'), label: t('emailLabel'), href: 'mailto:info@remnus.com' },
    { icon: MessageSquare, title: t('communityTitle'), desc: t('communityDesc'), label: t('communityLabel'), href: null },
  ];

  return (
    <section className="px-4 sm:px-8">
      <div className="mx-auto max-w-[1200px] pt-14 pb-24 sm:pt-20 lg:pb-32">
        <PageHead title={t('title')} lede={t('subtitle')} />

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-12">
          <ul className="m-0 list-none space-y-0 p-0 lg:col-span-5">
            {channels.map(({ icon: Icon, title, desc, label, href }) => (
              <li key={title} className="flex gap-4 border-t border-line-strong py-6">
                <Icon className="mt-0.5 size-5 shrink-0 text-fg-3" aria-hidden />
                <div className="min-w-0">
                  <h2 className="m-0 text-[15px] font-semibold text-fg">{title}</h2>
                  <p className="m-0 mt-1 text-[15px] leading-relaxed text-fg-2">{desc}</p>
                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex text-sm font-medium break-all text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-3"
                    >
                      {label}
                    </a>
                  ) : (
                    <p className="m-0 mt-2 text-sm text-fg-3">{label}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="lg:col-span-7">
            <h2 className="m-0 mb-5 text-lg font-semibold tracking-[-0.015em] text-fg">{t('formHeading')}</h2>
            <ContactForm />
            <p className="m-0 mt-5 text-ui text-fg-3">{t('responseNote')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
