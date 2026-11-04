'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { BASELINE_LABEL, CATEGORY_LABEL, STATUS_LABEL } from '@/lib/labels';
import type { Feature } from '@/lib/schema';

/** F7: URL 쿼리와 동기화되는 필터. 목록은 서버에서 그린 행을 slug로 걸러 보여준다 */
export function FeatureExplorer({
  features,
  milestones,
  rows,
}: {
  features: Feature[];
  milestones: number[];
  rows: Record<string, React.ReactNode>;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cat = sp.get('cat') ?? '';
  const status = sp.get('status') ?? '';
  const baseline = sp.get('baseline') ?? '';
  const from = Number(sp.get('from')) || Math.min(...milestones);
  const to = Number(sp.get('to')) || Math.max(...milestones);
  const q = sp.get('q') ?? '';

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return features.filter(
      (f) =>
        (!cat || f.category === cat) &&
        (!status || f.status === status) &&
        (!baseline || f.baseline === baseline) &&
        f.milestone >= from &&
        f.milestone <= to &&
        (!needle || `${f.title} ${f.summaryKo} ${f.slug}`.toLowerCase().includes(needle)),
    );
  }, [features, cat, status, baseline, from, to, q]);

  const sorted = [...milestones].sort((a, b) => a - b);

  return (
    <>
      <div className="filters" role="search">
        <label className="field">
          <span>grep</span>
          <input type="search" value={q} placeholder="이름·요약 검색" onChange={(e) => set('q', e.target.value)} />
        </label>
        <label className="field">
          <span>cat</span>
          <select value={cat} onChange={(e) => set('cat', e.target.value)}>
            <option value="">전체</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>status</span>
          <select value={status} onChange={(e) => set('status', e.target.value)}>
            <option value="">전체</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>baseline</span>
          <select value={baseline} onChange={(e) => set('baseline', e.target.value)}>
            <option value="">전체</option>
            {Object.entries(BASELINE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>M</span>
          <select value={from} onChange={(e) => set('from', e.target.value)} aria-label="시작 버전">
            {sorted.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span>…</span>
          <select value={to} onChange={(e) => set('to', e.target.value)} aria-label="끝 버전">
            {sorted.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <span className="mono muted" style={{ fontSize: 12 }}>
          {list.length}/{features.length} matches
        </span>
      </div>
      <div style={{ marginTop: 16 }}>
        {list.length ? (
          <div className="flist">{list.map((f) => <div key={f.slug} style={{ display: 'contents' }}>{rows[f.slug]}</div>)}</div>
        ) : (
          <div className="empty">{'// 조건에 맞는 기능이 없습니다'}</div>
        )}
      </div>
    </>
  );
}
