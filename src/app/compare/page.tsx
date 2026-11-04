import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CompareView } from '@/components/CompareView';
import { FeatureRow } from '@/components/ui';
import { getFeatures, getReleases } from '@/lib/content';

export const metadata: Metadata = { title: '버전 비교' };

export default function ComparePage() {
  const features = getFeatures();
  const milestones = getReleases().map((r) => r.milestone);
  const rows = Object.fromEntries(features.map((f) => [f.slug, <FeatureRow key={f.slug} f={f} />]));
  return (
    <>
      <div className="tabbar" role="tablist">
        <span className="tab active" role="tab" aria-selected="true">
          compare.diff
        </span>
      </div>
      <div className="doc">
        <header>
          <h1 className="title">버전 비교</h1>
        </header>
        <Suspense fallback={<div className="empty">{'// 불러오는 중…'}</div>}>
          <CompareView features={features} milestones={milestones} rows={rows} />
        </Suspense>
      </div>
    </>
  );
}
