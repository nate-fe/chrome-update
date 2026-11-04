'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { runFeatureTest, useBrowser, verdictOf, type Verdict } from '@/lib/client';
import type { FeatureTest } from '@/lib/schema';

export type ScoreItem = { slug: string; title: string; test: FeatureTest | null; milestone: number };

const SIGN: Record<Exclude<Verdict, 'included'>, { s: string; c: string; t?: string }> = {
  pending: { s: '…', c: 'u' },
  yes: { s: '✓', c: 'y' },
  no: { s: '✗', c: 'n' },
  unknown: { s: '?', c: 'u', t: '감지 불가: 점수에서 제외' },
};

/**
 * F12: "내 브라우저 X/Y". 내 버전 이하에서 나온 기능은 목록에서 빼고,
 * 남는 기능이 없으면(이미 다 들어 있는 버전) 패널을 숨긴다.
 */
export function SupportScore({ items, label }: { items: ScoreItem[]; label: string }) {
  const b = useBrowser();
  const [results, setResults] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    let alive = true;
    Promise.all(items.map(async (it) => [it.slug, it.test ? await runFeatureTest(it.test) : null] as const)).then(
      (pairs) => alive && setResults(Object.fromEntries(pairs)),
    );
    return () => {
      alive = false;
    };
  }, [items]);

  const verdicts = items
    .map((it) => ({ it, v: verdictOf(it.slug in results ? results[it.slug] : undefined, !!it.test, b, it.milestone) }))
    .filter((x): x is { it: ScoreItem; v: Exclude<Verdict, 'included'> } => x.v !== 'included');
  if (b.ready && verdicts.length === 0) return null;

  const done = b.ready && verdicts.every((x) => x.v !== 'pending');
  const scored = verdicts.filter((x) => x.v !== 'unknown');
  const ok = scored.filter((x) => x.v === 'yes').length;
  const pct = scored.length ? (ok / scored.length) * 100 : 0;

  return (
    <section className="panel" aria-live="polite">
      <div className="panel-head">
        <span>$ support --check {label}</span>
        <span className="right">감지 결과 + 내 버전</span>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <strong className="mono" style={{ fontSize: 22 }}>
            {done ? `${ok}/${scored.length}` : '…'}
          </strong>
          <span className="muted">내 브라우저에서 바로 쓸 수 있는 기능</span>
        </div>
        <div className="score-meter" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="score-list">
          {verdicts.map(({ it, v }) => (
            <Link key={it.slug} href={`/features/${it.slug}`} title={SIGN[v].t}>
              <span className={SIGN[v].c}>{SIGN[v].s}</span>
              <span>{it.title.replace(/`/g, '')}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
