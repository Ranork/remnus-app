import { getTranslations } from 'next-intl/server';
import ProjectMap, { type ProjectMapData } from './ProjectMap';
import { Section, SectionHead } from './parts';

export default async function NextMap() {
  const t = await getTranslations('LandingNext.map');

  const data: ProjectMapData = {
    tabs: {
      decisions: t('tabDecisions'),
      architecture: t('tabArchitecture'),
      backlog: t('tabBacklog'),
      risks: t('tabRisks'),
    },
    cols: { decision: t('colDecision'), source: t('colSource'), status: t('colStatus') },
    statuses: {
      reviewed: t('statusReviewed'),
      needsReview: t('statusNeedsReview'),
      superseded: t('statusSuperseded'),
    },
    decisions: t.raw('decisions') as ProjectMapData['decisions'],
    archTitle: t('archTitle'),
    archIntro: t('archIntro'),
    archNodes: t.raw('archNodes') as string[],
    archNote: t('archNote'),
    backlogCols: t.raw('backlogCols') as string[],
    backlog: t.raw('backlog') as string[][],
    risks: t.raw('risks') as ProjectMapData['risks'],
    footnote: t('footnote'),
  };

  return (
    <Section id="map">
      <SectionHead kicker={t('kicker')} pre={t('titlePre')} accent={t('titleAccent')} body={t('body')} />
      <ProjectMap data={data} />
    </Section>
  );
}
