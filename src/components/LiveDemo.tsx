'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSupport, useTheme, type Theme } from '@/lib/client';
import type { Demo, FeatureTest } from '@/lib/schema';

type Src = { html: string; css: string; js?: string };

const PALETTE: Record<Theme, Record<string, string>> = {
  dark: { bg: '#11151d', fg: '#d5dae3', accent: '#5aa9ff', muted: '#6b7587', border: '#2f3a4d' },
  light: { bg: '#ffffff', fg: '#1f2430', accent: '#1f6feb', muted: '#a8b0be', border: '#cfd4dd' },
};

/** sandbox iframe 문서. 슬라이더 값은 postMessage로 CSS 변수에 반영한다 */
function buildDoc(src: Src, vars: Record<string, string>, theme: Theme) {
  const p = PALETTE[theme];
  const style = Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  return `<!doctype html><html style="${style}"><head><meta charset="utf-8"><style>
:root{--demo-bg:${p.bg};--demo-fg:${p.fg};--demo-accent:${p.accent};--demo-muted:${p.muted};--demo-border:${p.border};
--demo-mono:'JetBrains Mono',Consolas,ui-monospace,monospace;--demo-sans:'Pretendard','Segoe UI','Malgun Gothic',sans-serif;color-scheme:${theme}}
body{margin:0;padding:18px;background:var(--demo-bg);color:var(--demo-fg);font-family:var(--demo-sans)}
${src.css}</style></head><body>${src.html}
<script>addEventListener('message',function(e){var d=e.data;if(d&&d.type==='vars'){for(var k in d.vars)document.documentElement.style.setProperty(k,d.vars[k])}});</script>
${src.js ? `<script>${src.js}</script>` : ''}</body></html>`;
}

function Frame({ src, vars, theme, title }: { src: Src; vars: Record<string, string>; theme: Theme; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  // 문서는 소스·테마가 바뀔 때만 다시 만든다. 슬라이더는 메시지로 보낸다
  const initialVars = useRef(vars);
  const doc = useMemo(() => buildDoc(src, initialVars.current, theme), [src, theme]);
  useEffect(() => {
    ref.current?.contentWindow?.postMessage({ type: 'vars', vars }, '*');
  }, [vars]);
  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-scripts"
      srcDoc={doc}
      onLoad={() => ref.current?.contentWindow?.postMessage({ type: 'vars', vars }, '*')}
    />
  );
}

/** F11: 라이브 데모 + 슬라이더. 미지원이면 폴백 화면을 나란히 보여준다 */
export function LiveDemo({ demo, test, name }: { demo: Demo; test: FeatureTest | null; name: string }) {
  const theme = useTheme();
  const support = useSupport(test);
  const [vals, setVals] = useState<Record<string, number>>(() =>
    Object.fromEntries(demo.controls.map((c) => [c.var, c.value])),
  );
  const vars = useMemo(
    () => Object.fromEntries(demo.controls.map((c) => [c.var, `${vals[c.var]}${c.unit}`])),
    [vals, demo.controls],
  );
  const showFallback = support === 'no' && !!demo.fallback;
  const main: Src = useMemo(() => ({ html: demo.html, css: demo.css, js: demo.js }), [demo]);

  return (
    <div className="demo">
      <div className="demo-panes" style={{ '--panes': showFallback ? 2 : 1 } as React.CSSProperties}>
        <div className="demo-pane">
          <div className="label">
            preview · {name}
            {support === 'no' && <span style={{ color: 'var(--del)' }}> · 이 브라우저는 미지원</span>}
          </div>
          <Frame src={main} vars={vars} theme={theme} title={`${name} 라이브 데모`} />
        </div>
        {showFallback && demo.fallback && (
          <div className="demo-pane">
            <div className="label">fallback · 미지원 브라우저용 대체 화면</div>
            <Frame src={demo.fallback} vars={vars} theme={theme} title={`${name} 폴백 데모`} />
          </div>
        )}
      </div>
      {demo.controls.length > 0 && (
        <div className="controls">
          {demo.controls.map((c) => (
            <label key={c.var} className="control">
              <span>{c.label}</span>
              <input
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={vals[c.var]}
                onChange={(e) => setVals((v) => ({ ...v, [c.var]: Number(e.target.value) }))}
              />
              <output>
                {vals[c.var]}
                {c.unit}
              </output>
            </label>
          ))}
        </div>
      )}
      <div className="term">
        <span className="p">❯</span> {demo.hint ?? '미리보기와 상호작용해 보세요.'}
        {support === 'no' && !demo.fallback && <div>⚠ 이 브라우저는 기능을 지원하지 않아 미리보기가 다르게 보일 수 있습니다.</div>}
      </div>
    </div>
  );
}
