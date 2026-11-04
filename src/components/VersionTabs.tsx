'use client';

import { useEffect, useState } from 'react';
import type { TabKey } from '@/lib/labels';

type Tab = { key: TabKey; file: string; count: number; color: string };

/** 본문 스크롤 영역(#main)을 맨 위로. 창이 스크롤되는 경우도 함께 처리 */
function scrollToTop() {
  document.getElementById('main')?.scrollTo({ top: 0 });
  window.scrollTo({ top: 0 });
}

/** 파일 탭 = 카테고리 (css.diff, js.diff, removed.md, origin-trial.md). 해시로 상태 유지 */
export function VersionTabs({
  tabs,
  panels,
  header,
  footer,
}: {
  tabs: Tab[];
  panels: Record<TabKey, React.ReactNode>;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const first = tabs.find((t) => t.count > 0)?.key ?? tabs[0].key;
  const [active, setActive] = useState<TabKey>(first);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as TabKey;
      if (tabs.some((t) => t.key === h)) setActive(h);
    };
    // 본문 링크(예: 경고 배너의 removed.md 탭)로 탭이 바뀔 때도 맨 위로
    const onHashChange = () => {
      fromHash();
      scrollToTop();
    };
    fromHash();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [tabs]);

  const select = (k: TabKey) => {
    setActive(k);
    history.replaceState(null, '', `#${k}`);
    scrollToTop();
  };

  return (
    <>
      <div className="tabbar" role="tablist" aria-label="카테고리">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`panel-${t.key}`}
            className="tab"
            onClick={() => select(t.key)}
          >
            <span className="dot" style={{ background: t.color }} />
            {t.file}
            <span className="count">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="doc">
        {header}
        {tabs.map((t) => (
          <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} hidden={active !== t.key}>
            {panels[t.key]}
          </div>
        ))}
        {footer}
      </div>
    </>
  );
}
