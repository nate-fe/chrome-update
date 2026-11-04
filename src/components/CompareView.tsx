'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useBrowser } from '@/lib/client';
import type { Feature } from '@/lib/schema';

/** F6: from 다음 버전부터 to까지 추가·변경·제거된 기능 */
export function CompareView({
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
  const browser = useBrowser();
  const sorted = [...milestones].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const fromOptions = [min - 1, ...sorted.slice(0, -1)];

  // 기본값: 내 브라우저 버전 이후 (F5), 없으면 정리된 첫 버전 직전부터
  const mine = browser.chromium && browser.version ? Math.min(Math.max(browser.version, min - 1), max - 1) : null;
  const from = Number(sp.get('from')) || mine || min - 1;
  const to = Number(sp.get('to')) || max;

  const set = (k: 'from' | 'to', v: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set(k, String(v));
    if (!next.has(k === 'from' ? 'to' : 'from')) next.set(k === 'from' ? 'to' : 'from', String(k === 'from' ? to : from));
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const inRange = features.filter((f) => f.milestone > from && f.milestone <= to);
  const groups = [
    { key: 'removed', title: '제거 · 대응 필수', sign: '-', color: 'var(--del)', list: inRange.filter((f) => f.impact === 'removed') },
    { key: 'changed', title: '동작 변경 · 확인 필요', sign: '~', color: 'var(--warn)', list: inRange.filter((f) => f.impact === 'changed') },
    { key: 'new', title: '추가 · 신규', sign: '+', color: 'var(--add)', list: inRange.filter((f) => f.impact === 'new') },
  ];
  // 이 구간 안에서 베타 공지와 출시 버전이 달랐던 기능
  const moved = features.filter((f) =>
    f.history.some((h) => h.channel === 'beta' && h.milestone > from && h.milestone <= to && h.milestone !== f.milestone),
  );

  return (
    <>
      <div className="filters">
        <label className="field">
          <span>from</span>
          <select value={from} onChange={(e) => set('from', Number(e.target.value))}>
            {fromOptions.map((m) => (
              <option key={m} value={m}>
                {m}
                {m === min - 1 ? ' (이전)' : ''}
              </option>
            ))}
          </select>
        </label>
        <span className="mono muted">→</span>
        <label className="field">
          <span>to</span>
          <select value={to} onChange={(e) => set('to', Number(e.target.value))}>
            {sorted.map((m) => (
              <option key={m} value={m} disabled={m <= from}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <span className="diff-stat">
          {groups.map((g) => (
            <span key={g.key} style={{ color: g.color, marginRight: 10 }}>
              {g.sign}
              {g.list.length}
            </span>
          ))}
        </span>
      </div>

      {to <= from ? (
        <div className="empty" style={{ marginTop: 16 }}>
          {'// to는 from보다 커야 합니다'}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} style={{ marginTop: 24 }}>
            <h2 className="section-title" style={{ color: g.color }}>
              {g.title} <span className="aside">{g.list.length}개</span>
            </h2>
            {g.list.length ? (
              <div className="flist">
                {g.list.map((f) => (
                  <div key={f.slug} style={{ display: 'contents' }}>
                    {rows[f.slug]}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">{'// 없음'}</div>
            )}
          </section>
        ))
      )}

      {moved.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 className="section-title" style={{ color: 'var(--warn)' }}>
            연기된 기능 <span className="aside">베타 공지 버전 ≠ 실제 출시 버전</span>
          </h2>
          <ul className="mono" style={{ fontSize: 13, margin: 0 }}>
            {moved.map((f) => {
              const b = f.history.find((h) => h.channel === 'beta');
              return (
                <li key={f.slug}>
                  <Link href={`/features/${f.slug}`}>{f.title.replace(/`/g, '')}</Link> — {b?.milestone} 베타 공지 → {f.milestone}{' '}
                  출시
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
