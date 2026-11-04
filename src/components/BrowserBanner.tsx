'use client';

import Link from 'next/link';
import { useBrowser } from '@/lib/client';

type Lite = { slug: string; milestone: number; category: string };

/** F5: 접속한 브라우저 버전을 읽어 "내 버전 이후 변경"을 보여준다 */
export function BrowserBanner({ features, latest, oldest }: { features: Lite[]; latest: number; oldest: number }) {
  const b = useBrowser();

  if (!b.ready) {
    return (
      <div className="banner">
        <span className="prompt">❯ detect-browser</span>
        <span className="grow muted">브라우저 버전을 확인하는 중…</span>
      </div>
    );
  }

  if (!b.chromium || b.version === null) {
    return (
      <div className="banner warn">
        <span className="prompt">❯ detect-browser</span>
        <span className="grow">
          지금 <strong>{b.name}</strong>로 보고 있습니다. 이 페이지는 Chromium 기반 브라우저의 변경사항을 다룹니다. 각 기능의
          &lsquo;다른 브라우저 지원&rsquo; 표를 참고하세요.
        </span>
        <Link className="icon-btn" href="/features">
          전체 기능 보기
        </Link>
      </div>
    );
  }

  const v = b.version;
  if (v >= latest) {
    return (
      <div className="banner">
        <span className="prompt">❯ detect-browser</span>
        <span className="grow">
          {b.name} <strong className="mono">{v}</strong> — 정리된 최신 버전({latest})까지 모두 들어 있는 브라우저입니다.
        </span>
        <Link className="icon-btn" href={`/chrome/${latest}`}>
          {latest} 변경사항
        </Link>
      </div>
    );
  }

  const from = Math.max(v, oldest - 1);
  const after = features.filter((f) => f.milestone > from && f.milestone <= latest);
  const removed = after.filter((f) => f.category === 'deprecation').length;
  return (
    <div className="banner">
      <span className="prompt">❯ detect-browser</span>
      <span className="grow">
        {b.name} <strong className="mono">{v}</strong>을 쓰고 있습니다. {latest}까지 올리면{' '}
        <strong>{after.length}개</strong>가 바뀌고, 그중 <strong style={{ color: 'var(--del)' }}>{removed}개</strong>는 기존
        코드에 영향이 있을 수 있습니다.
        {v < oldest - 1 && <span className="muted"> ({oldest} 이전 변경은 아직 정리되지 않았습니다)</span>}
      </span>
      <Link className="icon-btn" href={`/compare?from=${from}&to=${latest}`}>
        내 버전 이후 변경 보기
      </Link>
    </div>
  );
}
