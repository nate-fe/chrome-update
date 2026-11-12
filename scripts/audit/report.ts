// 점검 결과를 혼자 열어 볼 수 있는 HTML 한 장으로 만든다 (외부 파일·스크립트 없음)
import type { AuditResult, Finding, RuntimeWarning } from './scan.ts';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 백틱으로 감싼 부분만 <code>로 */
const prose = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

const link = (url: string, text = url) => (/^https?:/.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(text)}</a>` : esc(text));

function where(url: string, line: number, col: number): string {
  return `<div class="loc">${link(url)}<span class="pos">:${line}:${col}</span></div>`;
}

function pagesLine(pages: string[]): string {
  return pages.length ? `<div class="pages">불러오는 페이지: ${pages.map((p) => link(p)).join(', ')}</div>` : '';
}

function findingItem(f: Finding): string {
  return `<li>${where(f.url, f.line, f.col)}<pre>${esc(f.snippet)}</pre>${pagesLine(f.pages)}</li>`;
}

function featureGroups(list: Finding[]): string {
  const bySlug = new Map<string, Finding[]>();
  for (const f of list) bySlug.set(f.slug, [...(bySlug.get(f.slug) ?? []), f]);
  return [...bySlug.values()]
    .map((items) => {
      const f = items[0];
      const own = items.filter((x) => x.own);
      const ext = items.filter((x) => !x.own);
      const notes = [...new Set(items.map((x) => x.noteKo))];
      return `<section class="feature">
  <h3><a href="${esc(f.link)}" target="_blank" rel="noreferrer">${prose(f.title)}</a> <span class="ms">${f.milestone ? `Chrome ${f.milestone}` : 'Chrome 경고'}</span></h3>
  ${notes.map((n) => `<p class="note">${prose(n)}</p>`).join('')}
  ${f.guideKo ? `<p class="guide"><b>대응</b> ${prose(f.guideKo)}</p>` : ''}
  ${own.length ? `<h4>네이트 파일 ${own.length}곳</h4><ul>${own.map(findingItem).join('')}</ul>` : '<p class="none">네이트 파일에서는 찾지 못함</p>'}
  ${ext.length ? `<details><summary>외부 파일 ${ext.length}곳 (광고·통계 등, 직접 고칠 수 없음)</summary><ul>${ext.map(findingItem).join('')}</ul></details>` : ''}
</section>`;
    })
    .join('\n');
}

function syncXhrBlock(r: RuntimeWarning): string {
  const rows = [
    r.request ? `<div class="pages">불러온 주소: <code>${esc(r.request)}</code></div>` : '',
    r.via ? `<div class="pages">실제 요청을 연 라이브러리: ${esc(r.via)}</div>` : '',
  ];
  return rows.join('');
}

function runtimeTable(list: RuntimeWarning[]): string {
  if (!list.length) return '<p class="none">경고 없음</p>';
  const row = (r: RuntimeWarning) =>
    `<tr><td><code>${esc(r.type)}</code></td><td>${where(r.url, r.line, r.col)}${r.snippet ? `<pre>${esc(r.snippet)}</pre>` : ''}${syncXhrBlock(r)}${pagesLine(r.pages)}</td></tr>`;
  const own = list.filter((r) => r.own);
  const ext = list.filter((r) => !r.own);
  return `${own.length ? `<h4>네이트 파일 ${own.length}건</h4><table><tr><th>경고 종류</th><th>위치</th></tr>${own.map(row).join('')}</table>` : '<p class="none">네이트 파일에서 나온 경고 없음</p>'}
${ext.length ? `<details><summary>외부 파일 ${ext.length}건</summary><table><tr><th>경고 종류</th><th>위치</th></tr>${ext.map(row).join('')}</table></details>` : ''}`;
}

export function renderReport(r: AuditResult, ruleCount: number): string {
  const fix = r.findings.filter((f) => f.level === 'fix');
  const check = r.findings.filter((f) => f.level === 'check');
  const ownN = (l: { own: boolean }[]) => l.filter((x) => x.own).length;
  const at = new Date(r.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chrome 변경 점검 보고서</title>
<style>
:root{--bg:#fff;--fg:#1d2330;--dim:#5d6676;--line:#dde2ea;--panel:#f5f7fa;--fix:#c62828;--check:#b26a00;--accent:#1f6feb;
--mono:Consolas,ui-monospace,monospace;--sans:'Segoe UI','Malgun Gothic',sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#d5dae3;--dim:#9aa4b5;--line:#2a3140;--panel:#161b25;--fix:#ff7b72;--check:#e3b341;--accent:#5aa9ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 var(--sans)}
main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:36px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
h3{font-size:16px;margin:0 0 6px}h4{font-size:13px;margin:12px 0 6px;color:var(--dim)}
a{color:var(--accent);word-break:break-all}
code,pre{font-family:var(--mono);font-size:12.5px}
code{background:var(--panel);padding:1px 4px;border-radius:4px}
pre{margin:4px 0;padding:8px 10px;background:var(--panel);border:1px solid var(--line);border-radius:6px;white-space:pre-wrap;word-break:break-all}
.meta{color:var(--dim);font-size:13px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:16px}
.card{border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.card b{display:block;font-size:24px}.card span{color:var(--dim);font-size:12px}
.card.fix b{color:var(--fix)}.card.check b{color:var(--check)}
.feature{border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:12px 0}
.ms{font-size:12px;color:var(--dim);font-weight:400}
.note{margin:2px 0}.guide{margin:6px 0;color:var(--dim)}
.none{color:var(--dim);margin:6px 0}
ul{list-style:none;padding:0;margin:0}li{margin:10px 0}
.loc{font-family:var(--mono);font-size:12.5px}.pos{color:var(--dim)}
.pages{font-size:12px;color:var(--dim)}
details{margin-top:10px}summary{cursor:pointer;color:var(--dim)}
table{width:100%;border-collapse:collapse;margin:6px 0;table-layout:fixed}td code{word-break:break-all}th:first-child{width:32%}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--line)}
th{font-size:12px;color:var(--dim)}
.err{color:var(--fix)}
</style></head><body><main>
<h1>Chrome 변경 점검 보고서</h1>
<div class="meta">${esc(at)} · ${r.chromium ? `Chromium ${esc(r.chromium)}` : '파일만 받아 검사 (브라우저 실행 없음)'} · 파일 ${r.files.length}개 · 규칙 ${ruleCount}개</div>
<div class="meta">대상: ${r.targets.map((t) => link(t)).join(', ')}</div>

<div class="cards">
  <div class="card fix"><b>${ownN(fix)}</b><span>고쳐야 함 · 네이트 파일 (외부 ${fix.length - ownN(fix)})</span></div>
  <div class="card check"><b>${ownN(check)}</b><span>확인 필요 · 네이트 파일 (외부 ${check.length - ownN(check)})</span></div>
  ${r.chromium ? `<div class="card"><b>${ownN(r.runtime)}</b><span>Chrome 실행 경고 · 네이트 파일 (외부 ${r.runtime.length - ownN(r.runtime)})</span></div>` : ''}
</div>

<h2>고쳐야 함 <span class="ms">제거되거나 deprecated된 코드</span></h2>
${fix.length ? featureGroups(fix) : '<p class="none">찾지 못함</p>'}

<h2>확인 필요 <span class="ms">동작이 바뀌는 코드 — 화면·성능 확인</span></h2>
${check.length ? featureGroups(check) : '<p class="none">찾지 못함</p>'}

${
  r.chromium
    ? `<h2>Chrome 실행 경고 <span class="ms">페이지를 열 때 Chrome이 낸 deprecation 경고</span></h2>
<p class="meta">이 사이트에 아직 정리되지 않은 오래된 제거 기능도 여기에 나온다. 페이지를 열 때 실행된 코드만 해당한다.</p>
${runtimeTable(r.runtime)}`
    : ''
}

${r.errors.length ? `<h2>검사 오류</h2><ul>${r.errors.map((e) => `<li class="err">${esc(e)}</li>`).join('')}</ul>` : ''}

${
  r.skipped?.length
    ? `<h2>받지 않은 주소 <span class="ms">${r.skipped.length}개 · 광고 응답, 확장자 없는 서버 응답</span></h2>
<details><summary>목록 보기</summary><table><tr><th>이유</th><th>주소</th></tr>
${r.skipped.map((s) => `<tr><td>${esc(s.reason)}</td><td>${esc(s.url)}</td></tr>`).join('')}
</table></details>`
    : ''
}

<h2>검사한 파일 <span class="ms">${r.files.length}개 · 네이트 도메인: ${esc(r.own.join(', '))}</span></h2>
<details><summary>목록 보기</summary><table><tr><th>파일</th><th>종류</th><th>크기</th></tr>
${r.files.map((f) => `<tr><td>${link(f.url)}${f.own ? '' : ' <span class="ms">외부</span>'}</td><td>${f.kind}</td><td>${(f.bytes / 1024).toFixed(1)}KB</td></tr>`).join('')}
</table></details>
</main></body></html>
`;
}
