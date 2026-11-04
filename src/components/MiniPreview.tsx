'use client';

import { useEffect, useRef } from 'react';
import { useBrowser, useSupport } from '@/lib/client';
import type { FeatureTest } from '@/lib/schema';

/**
 * 카드용 미니 미리보기. 예시 코드를 실제 HTML에 그대로 적용해 보여준다.
 * Shadow DOM 안에 그려서 페이지 스타일과 섞이지 않는다 (색 변수는 상속되어 테마를 따른다).
 */
export function MiniPreview({
  html,
  css,
  code,
  test,
  milestone,
}: {
  html: string;
  css: string;
  code: string;
  test: FeatureTest | null;
  milestone: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const support = useSupport(test);
  const b = useBrowser();
  // 내 Chrome 버전보다 새 버전의 기능은 아직 적용되지 않으니 미리보기를 숨긴다 (지나간 버전은 그대로 보여준다)
  const hidden = !b.ready || (b.chromium && b.version !== null && b.version < milestone);

  useEffect(() => {
    const host = ref.current;
    if (!host || hidden) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
:host { display: block; position: relative; color: var(--fg); font: 13px/1.5 var(--sans); }
*, *::before, *::after { box-sizing: border-box; }
${css}
/* 예시 코드 */
${code}
</style>${html}`;
  }, [html, css, code, hidden]);

  if (hidden) return null;
  return (
    <figure className="mini-preview">
      <figcaption>
        미리보기
        {support === 'no' && <span className="no"> · 이 브라우저는 미지원(적용 전 모습)</span>}
      </figcaption>
      <div ref={ref} className="stage" />
    </figure>
  );
}
