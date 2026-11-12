// 점검 결과를 지난 결과와 비교해 팀룸 알림 메시지를 만들고, 바뀐 게 있으면 보낸다.
//
// 실행: node scripts/audit/notify.ts <이번 result.json> [지난 result.json] [--send]
//  - 메시지를 표준 출력과 <이번 결과 폴더>/message.txt에 쓴다.
//  - --send: 새로 생기거나 해결된 '수정 필요'가 있을 때만 TEAMROOM_WEBHOOK_URL로 보낸다.
//  - 검사 오류(페이지 접속 실패 등)가 있으면 비교하지 않고 실패 알림을 보낸 뒤 종료 코드 2로 끝낸다.
//    (일부 페이지가 빠진 결과로 비교하면 '해결됨'으로 잘못 나오기 때문)
// 환경 변수: TEAMROOM_WEBHOOK_URL(네이트온 팀룸 인커밍 웹훅), REPORT_URL(보고서 링크, 선택)
import fs from 'node:fs';
import path from 'node:path';
import type { AuditResult } from './scan.ts';

/** 팀룸에 올릴 '수정 필요' 한 건: 네이트 파일의 '고쳐야 함' + 네이트 파일의 Chrome 실행 경고 */
type Item = { key: string; group: string; reason: string; file: string; line: number };

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

function shortFile(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[?#].*$/, '');
}

function itemsOf(r: AuditResult): Item[] {
  const items: Item[] = [];
  for (const f of r.findings) {
    if (!f.own || f.level !== 'fix') continue;
    items.push({
      key: f.key,
      group: f.title.replace(/`/g, ''),
      reason: GROUP_REASONS[f.slug] ?? f.noteKo.replace(/`/g, ''),
      file: shortFile(f.url),
      line: f.line,
    });
  }
  for (const w of r.runtime) {
    if (!w.own) continue;
    const known = RUNTIME_REASONS[w.type];
    items.push({
      key: w.key,
      group: known?.group ?? w.type,
      reason: known?.reason ?? `Chrome이 deprecation 경고(${w.type})를 냅니다. 자세한 내용은 보고서를 확인해 주세요.`,
      file: shortFile(w.url),
      line: w.line,
    });
  }
  return items;
}

function kst(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function buildMessage(cur: AuditResult, items: Item[], fresh: Set<string>, resolved: Item[]): string {
  const lines = [`[Chrome 변경 점검] deprecated 관련 수정 필요 - ${items.length}건 · ${kst(cur.at)}`];

  const groups = new Map<string, Item[]>();
  for (const it of items) groups.set(it.group, [...(groups.get(it.group) ?? []), it]);
  for (const [group, list] of groups) {
    lines.push('', `${group}: ${list[0].reason}`);
    // 같은 파일의 여러 줄은 한 줄로
    const byFile = new Map<string, { lines: number[]; fresh: boolean }>();
    for (const it of list) {
      const e = byFile.get(it.file) ?? { lines: [], fresh: false };
      if (!e.lines.includes(it.line)) e.lines.push(it.line);
      e.fresh ||= fresh.has(it.key);
      byFile.set(it.file, e);
    }
    for (const [file, e] of byFile) {
      lines.push(`· ${file} ${e.lines.sort((a, b) => a - b).join(', ')}줄${e.fresh ? ' (새로)' : ''}`);
    }
  }

  if (resolved.length) {
    lines.push('', `해결됨 ${resolved.length}건`);
    for (const it of resolved) lines.push(`· ${it.group} — ${it.file}`);
  }

  const external = cur.findings.filter((f) => !f.own && f.level === 'fix').length + cur.runtime.filter((w) => !w.own).length;
  if (external) lines.push('', `외부 파일(광고·통계) ${external}건은 보고서를 참고해 주세요.`);

  lines.push('', `검사: 페이지 ${cur.targets.length}개 · 파일 ${cur.files.length}개 · ${cur.chromium ? `Chromium ${cur.chromium}` : '파일만 받아 검사'}`);
  if (process.env.REPORT_URL) lines.push(`자세히: ${process.env.REPORT_URL}`);
  return lines.join('\n');
}

async function send(text: string) {
  const url = process.env.TEAMROOM_WEBHOOK_URL;
  if (!url) throw new Error('TEAMROOM_WEBHOOK_URL이 없습니다');
  // 네이트온 팀룸 인커밍 웹훅: form 형식 POST, 메시지는 content 필드
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: new URLSearchParams({ content: text }),
  });
  if (!res.ok) throw new Error(`팀룸 전송 실패: ${res.status} ${(await res.text()).slice(0, 200)}`);
  console.log('팀룸으로 보냄');
}

// ───────── 실행 ─────────

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SEND = process.argv.includes('--send');
const [curFile, prevFile] = args;
if (!curFile) {
  console.error('사용법: node scripts/audit/notify.ts <이번 result.json> [지난 result.json] [--send]');
  process.exit(1);
}
const cur = JSON.parse(fs.readFileSync(curFile, 'utf8')) as AuditResult;
const prev = prevFile && fs.existsSync(prevFile) ? (JSON.parse(fs.readFileSync(prevFile, 'utf8')) as AuditResult) : null;
const outFile = path.join(path.dirname(curFile), 'message.txt');

if (cur.errors.length) {
  const text = [`[Chrome 변경 점검] 점검 실패 · ${kst(cur.at)}`, '', ...cur.errors.map((e) => `· ${e}`), '', '배포로 파일 주소가 바뀌었거나(files.json 수정 필요) 일시적인 접속 문제일 수 있습니다. 이번 결과는 비교에 쓰지 않습니다.']
    .concat(process.env.REPORT_URL ? [`자세히: ${process.env.REPORT_URL}`] : [])
    .join('\n');
  fs.writeFileSync(outFile, text + '\n');
  console.log(text);
  if (SEND) await send(text);
  process.exit(2);
}

const items = itemsOf(cur);
const prevItems = prev ? itemsOf(prev) : [];
const prevKeys = new Set(prevItems.map((i) => i.key));
const curKeys = new Set(items.map((i) => i.key));
const fresh = new Set(items.filter((i) => !prevKeys.has(i.key)).map((i) => i.key));
const resolved = prevItems.filter((i) => !curKeys.has(i.key));

const text = buildMessage(cur, items, fresh, resolved);
fs.writeFileSync(outFile, text + '\n');
console.log(text);

// Actions에서 '지난 결과'를 새로 저장할지 알려 준다 (바뀐 게 없으면 커밋하지 않도록)
const changed = !prev || fresh.size > 0 || resolved.length > 0;
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);

if (fresh.size === 0 && resolved.length === 0) {
  console.log('\n지난 결과와 같아 보내지 않음');
} else if (SEND) {
  await send(text);
} else {
  console.log(`\n(새로 ${fresh.size}건, 해결 ${resolved.length}건 — --send를 주면 팀룸으로 보냄)`);
}
