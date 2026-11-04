'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { setTheme, useBrowser, useBrowserDetail, useTheme } from '@/lib/client';

/**
 * 페이지 이동 시 본문(#main)을 맨 위로 되돌린다.
 * Next.js는 새 페이지의 첫 요소로 스크롤을 맞추는데, sticky 탭 줄은 건너뛰기 때문에
 * 그 높이만큼 내려간 위치에서 멈춘다. 그 뒤에 다시 0으로 맞춘다.
 */
export function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (location.hash) return; // #앵커 이동은 그대로 둔다
    const reset = () => document.getElementById('main')?.scrollTo({ top: 0 });
    reset();
    const id = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? '밝은 에디터 테마로 바꾸기' : '어두운 테마로 바꾸기'}
    >
      {theme === 'dark' ? '◐ Dark+' : '◑ Light+'}
    </button>
  );
}

export function Crumb() {
  const path = usePathname();
  return <span className="crumb">~{path === '/' ? '/README.md' : path}</span>;
}

export type NavItem = { href: string; label: string; ext?: string; pill?: React.ReactNode };
export type NavGroup = { title: string; items: NavItem[] };

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <nav className="sidebar" aria-label="탐색기">
      {groups.map((g) => (
        <div key={g.title} style={{ display: 'contents' }}>
          <h2>{g.title}</h2>
          {g.items.map((it) => (
            <Link key={it.href} href={it.href} aria-current={path === it.href ? 'page' : undefined}>
              <span>
                {it.label}
                {it.ext && <span className="ext">{it.ext}</span>}
              </span>
              {it.pill && <span className="pill">{it.pill}</span>}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

const DAY = 86_400_000;
const subscribeNoop = () => () => {};

/** 다음 stable 출시까지 남은 날짜 (빌드 시점이 아니라 보는 시점 기준) */
export function Countdown({ date }: { date: string }) {
  const today = useSyncExternalStore(
    subscribeNoop,
    () => new Date().toDateString(),
    () => null,
  );
  if (!today) return null;
  const target = new Date(`${date}T00:00:00`);
  const diff = Math.round((target.getTime() - new Date(today).getTime()) / DAY);
  return <>{diff > 0 ? `D-${diff}` : diff === 0 ? 'D-day' : '출시됨'}</>;
}

type ChipState = 'loading' | 'ahead' | 'latest' | 'behind' | 'other';

/** 우측 상단 "내 브라우저" 칩. 누르면 전체 버전과 상태, 업그레이드 시 바뀌는 것 링크를 보여준다 */
export function BrowserChip({ stable, beta, oldest, latest }: { stable: number; beta?: number; oldest: number; latest: number }) {
  const b = useBrowser();
  const detail = useBrowserDetail();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const v = b.version;
  const state: ChipState = !b.ready ? 'loading' : !b.chromium || v === null ? 'other' : v > stable ? 'ahead' : v === stable ? 'latest' : 'behind';

  const status =
    state === 'other'
      ? 'Chromium 기반이 아닌 브라우저라 버전 비교를 할 수 없습니다.'
      : v === null
        ? ''
        : v > latest
          ? `정리된 최신 버전(${latest})보다 새 버전입니다. Dev·Canary 채널일 수 있습니다.`
          : beta && v === beta
            ? `베타 채널(${beta})과 같은 버전입니다.`
            : v === stable
              ? `최신 stable(${stable})입니다.`
              : `stable(${stable})보다 ${stable - v}버전 뒤에 있습니다. 업데이트를 권장합니다.`;

  const from = v === null ? null : Math.max(v, oldest - 1);

  return (
    <div className="bchip-wrap" ref={ref}>
      <button
        type="button"
        className={`bchip ${state}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title="내 브라우저"
      >
        <i className="dot" aria-hidden />
        {state === 'loading' ? (
          '…'
        ) : state === 'other' ? (
          <>
            <span className="hide-sm">이 브라우저는 </span>
            {b.name}
            <span className="hide-sm">입니다.</span>
          </>
        ) : (
          <>
            <span className="hide-sm">이 브라우저는 </span>
            {b.name} {v}
            <span className="hide-sm"> 버전입니다.</span>
          </>
        )}
      </button>
      {open && (
        <div className="bchip-pop" role="dialog" aria-label="내 브라우저 정보">
          <div className="bchip-head">$ navigator.userAgentData</div>
          <dl>
            <dt>브라우저</dt>
            <dd>{b.name}</dd>
            <dt>버전</dt>
            <dd className="mono">{v ?? '-'}</dd>
            <dt>전체 버전</dt>
            <dd className="mono">{detail === null ? '확인 중…' : (detail.fullVersion ?? '알 수 없음')}</dd>
            {detail?.platform && (
              <>
                <dt>플랫폼</dt>
                <dd className="mono">{detail.platform}</dd>
              </>
            )}
          </dl>
          <p className={`bchip-status ${state}`}>{status}</p>
          {state !== 'other' && from !== null && from < latest && (
            <Link className="icon-btn" href={`/compare?from=${from}&to=${latest}`}>
              내 버전 이후 변경 보기 →
            </Link>
          )}
          {state === 'other' && (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              각 기능의 &lsquo;다른 브라우저 지원&rsquo; 표를 참고하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
