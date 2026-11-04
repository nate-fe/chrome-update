import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FeatureExplorer } from '@/components/FeatureExplorer';
import { FeatureList, FeatureRow } from '@/components/ui';
import { getFeatures, getReleases } from '@/lib/content';

export const metadata: Metadata = { title: '검색·필터' };

export default function FeaturesPage() {
  const features = getFeatures();
  const milestones = getReleases().map((r) => r.milestone);
  const rows = Object.fromEntries(features.map((f) => [f.slug, <FeatureRow key={f.slug} f={f} />]));
  return (
    <>
      <div className="tabbar" role="tablist">
        <span className="tab active" role="tab" aria-selected="true">
          search.ts
        </span>
      </div>
      <div className="doc">
        <header>
          <h1 className="title">기능 검색</h1>
        </header>
        <Suspense fallback={<FeatureList features={features} />}>
          <FeatureExplorer features={features} milestones={milestones} rows={rows} />
        </Suspense>
      </div>
    </>
  );
}
