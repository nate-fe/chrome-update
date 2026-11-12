// 점검 결과(result.json)를 사람이 볼 항목으로 정리한다. 팀룸 알림(notify.ts)과 현황 시트(sheet.ts)가 함께 쓴다.
import type { AuditResult } from './scan.ts';

/** 네이트 파일에서 찾은 한 건 (외부 파일은 고칠 수 없어 넣지 않는다) */
export type Item = {
  /** 줄 번호가 바뀌어도 같은 문제로 알아보는 키 */
  key: string;
  /** fix = 고쳐야 함, check = 동작이 바뀌니 확인 */
  level: 'fix' | 'check';
  /** 기능 이름 (같은 기능끼리 묶는다) */
  group: string;
  reason: string;
  /** 주소에서 https://와 ?쿼리를 뺀 것 */
  file: string;
  url: string;
  line: number;
  snippet: string | null;
  /** 이 파일을 불러오는 페이지 (예: 뉴스 홈(PC)) */
  pages: string[];
  /** 메인·뉴스·판·공통 */
  service: string;
};

/**
 * Chrome 실행 경고 종류별 설명. 사이트에 정리되지 않은 경고가 많아 자주 나오는 것만 적어 둔다.
 * 제거 일정이 있는지 없는지를 구분해서 쓴다.
 */
const RUNTIME_REASONS: Record<string, { group: string; reason: string }> = {
  XMLHttpRequestSynchronousInNonWorkerOutsideBeforeUnload: {
    group: '동기 XHR',
    reason: '응답이 올 때까지 페이지가 멈춰서 Chrome이 deprecated로 경고하는 기능입니다. 제거 일정은 없지만 비동기로 불러오도록 바꿔야 합니다.',
  },
  UnloadHandler: {
    group: 'unload 이벤트',
    reason: 'Chrome이 unload 이벤트를 단계적으로 없애고 있어 실행되지 않을 수 있습니다. pagehide나 visibilitychange로 바꿔야 합니다.',
  },
  FencedFrame: {
    group: 'Fenced frame',
    reason: 'Chrome 156부터 <fencedframe>과 window.fence가 동작하지 않습니다.',
  },
};

/**
 * legacy-rules.json 항목의 묶음 설명. 규칙마다 noteKo가 달라(예: `async: false`, jQuery `<script>`)
 * 첫 항목의 설명을 쓰면 다른 파일과 맞지 않으므로 묶음 공통 문구를 쓴다.
 */
const GROUP_REASONS: Record<string, string> = {
  'sync-xhr': RUNTIME_REASONS.XMLHttpRequestSynchronousInNonWorkerOutsideBeforeUnload.reason,
  'unload-event': RUNTIME_REASONS.UnloadHandler.reason,
  'document-domain': 'Chrome 115부터 기본적으로 document.domain 설정이 무시되어 서브도메인 사이 접근이 막힙니다. postMessage로 바꿔야 합니다.',
  'mutation-events': 'DOMNodeInserted 같은 Mutation Events는 Chrome 127부터 발생하지 않습니다. MutationObserver로 바꿔야 합니다.',
};

/** 코드 조각: 걸린 코드를 중심으로 100자 안쪽으로 자른다 (압축 파일은 한 줄이 매우 길다) */
export function shortSnippet(snippet: string | null, match?: string): string | null {
  if (!snippet) return null;
  const text = snippet.replace(/\s+/g, ' ').replace(/^…|…$/g, '').trim();
  if (text.length <= 100) return text;
  const at = match ? Math.max(0, text.indexOf(match.slice(0, 20))) : 0;
  const from = Math.max(0, at - 30);
  return `${from > 0 ? '…' : ''}${text.slice(from, from + 100)}…`;
}

export function shortFile(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[?#].*$/, '');
}

/** 페이지 이름(예: '뉴스 기사뷰(PC)')의 첫 낱말, 없으면 주소로 서비스를 정한다 */
function serviceOf(url: string, pages: string[]): string {
  const names = [...new Set(pages.map((p) => p.split(/[\s(]/)[0]).filter(Boolean))];
  if (names.length === 1) return names[0];
  if (names.length > 1) return '공통';
  if (/(^|\/\/)(www\.|m\.)?nate\.com\//.test(url)) return '메인';
  if (/news\.nate\.com/.test(url)) return '뉴스';
  if (/pann\.nate\.com/.test(url)) return '판';
  return '공통';
}

export function itemsOf(r: AuditResult): Item[] {
  const items: Item[] = [];
  for (const f of r.findings) {
    if (!f.own) continue;
    items.push({
      key: f.key,
      level: f.level,
      group: f.title.replace(/`/g, ''),
      reason: GROUP_REASONS[f.slug] ?? f.noteKo.replace(/`/g, ''),
      file: shortFile(f.url),
      url: f.url,
      line: f.line,
      snippet: shortSnippet(f.snippet, f.match),
      pages: f.pages,
      service: serviceOf(f.url, f.pages),
    });
  }
  for (const w of r.runtime) {
    if (!w.own) continue;
    const known = RUNTIME_REASONS[w.type];
    items.push({
      key: w.key,
      level: 'fix',
      group: known?.group ?? w.type,
      reason: known?.reason ?? `Chrome이 deprecation 경고(${w.type})를 냅니다.`,
      file: shortFile(w.url),
      url: w.url,
      line: w.line,
      snippet: shortSnippet(w.snippet),
      pages: w.pages,
      service: serviceOf(w.url, w.pages),
    });
  }
  return items;
}

/** 한국 시간 'YYYY-MM-DD HH:mm' */
export function kst(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}
