'use client';

import Image from 'next/image';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';

export type ProductTab = { id: string; label: string; body: string; alt: string };

/**
 * Four real screens of one project, one at a time. The sentence under the tabs says what
 * the open screen is for; the image is the product itself (dark or light, by theme).
 */
export default function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  return (
    <Tabs defaultValue={tabs[0].id}>
      <TabsList className="w-fit max-w-full overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => (
          <TabsTab key={tab.id} value={tab.id} className="h-10 px-3 text-sm">
            {tab.label}
          </TabsTab>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsPanel key={tab.id} value={tab.id} className="animate-tab-fade">
          <p className="m-0 mt-5 max-w-[40rem] text-[15px] leading-[1.6] text-fg-2">{tab.body}</p>
          <div className="mt-6 overflow-hidden rounded-[14px] bg-desk shadow-modal ring-1 ring-line-strong">
            {(['dark', 'light'] as const).map((tone) => (
              <Image
                key={tone}
                src={`/marketing/app-${tab.id}-${tone}.webp`}
                alt={tab.alt}
                width={2400}
                height={1500}
                sizes="(min-width: 1240px) 1200px, 100vw"
                className={`site-shot-${tone} h-auto w-full`}
              />
            ))}
          </div>
        </TabsPanel>
      ))}
    </Tabs>
  );
}
