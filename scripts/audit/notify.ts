// 점검 결과를 지난 결과와 비교해 팀룸 알림 메시지를 만들고, 바뀐 게 있으면 보낸다.
//
// 실행: node scripts/audit/notify.ts <이번 result.json> [지난 result.json] [--send] [--force]
//  - 메시지를 표준 출력과 <이번 결과 폴더>/message.txt에 쓴다.
//  - --send: 새로 생기거나 해결된 '수정 필요'가 있을 때만 TEAMROOM_WEBHOOK_URL로 보낸다.
//  - --force: 결과가 같아도 보낸다 (확인용). 제목 앞에 (TEST)를 붙인다.
//  - 검사 오류(페이지 접속 실패 등)가 있으면 비교하지 않고 실패 알림을 보낸 뒤 종료 코드 2로 끝낸다.
//    (일부 페이지가 빠진 결과로 비교하면 '해결됨'으로 잘못 나오기 때문)
// 환경 변수: TEAMROOM_WEBHOOK_URL(네이트온 팀룸 인커밍 웹훅), SHEET_URL(현황 시트 주소, 선택)
// 점검 저장소(GitHub) 링크는 넣지 않는다. 비공개라 팀원 대부분이 열 수 없으므로 고칠 곳의 코드 조각을 메시지에 직접 넣고,
// 링크는 회사 계정으로 보는 현황 시트만 넣는다.
import fs from 'node:fs';
import path from 'node:path';
import type { AuditResult } from './scan.ts';
import { itemsOf as allItems, kst, type Item } from './items.ts';

/** 팀룸에 올리는 '수정 필요': 네이트 파일의 '고쳐야 함' (동작 변경 '확인 필요'는 현황 시트에만) */
const itemsOf = (r: AuditResult): Item[] => allItems(r).filter((i) => i.level === 'fix');

function buildMessage(cur: AuditResult, items: Item[], resolved: Item[]): string {
  const lines = [`[Chrome 변경 점검] deprecated 관련 수정 필요 - ${items.length}건 · ${kst(cur.at)}`];

  const groups = new Map<string, Item[]>();
  for (const it of items) groups.set(it.group, [...(groups.get(it.group) ?? []), it]);
  for (const [group, list] of groups) {
    lines.push('', `${group}: ${list[0].reason}`);
    // 같은 파일의 여러 줄은 한 줄로 묶고, 그 아래에 코드 조각을 (같은 조각은 한 번만) 붙인다
    const byFile = new Map<string, { nums: number[]; snippets: string[] }>();
    for (const it of list) {
      const e = byFile.get(it.file) ?? { nums: [], snippets: [] };
      if (!e.nums.includes(it.line)) e.nums.push(it.line);
      if (it.snippet && !e.snippets.includes(it.snippet)) e.snippets.push(it.snippet);
      byFile.set(it.file, e);
    }
    for (const [file, e] of byFile) {
      lines.push(`· ${file} ${e.nums.sort((a, b) => a - b).join(', ')}줄`);
      for (const sn of e.snippets.slice(0, 3)) lines.push(`   ${sn}`);
    }
  }

  if (resolved.length) {
    // 같은 파일의 여러 줄이 함께 해결되면 한 줄로
    const done = [...new Set(resolved.map((it) => `${it.group} — ${it.file}`))];
    lines.push('', `해결됨 ${done.length}건`);
    for (const d of done) lines.push(`· ${d}`);
  }

  const external = cur.findings.filter((f) => !f.own && f.level === 'fix').length + cur.runtime.filter((w) => !w.own).length;
  if (external) lines.push('', `외부 파일(광고·통계) ${external}건은 직접 고칠 수 없어 건수에서 뺐습니다.`);

  lines.push('', `검사: 페이지 ${cur.targets.length}개 · 파일 ${cur.files.length}개 · ${cur.chromium ? `Chromium ${cur.chromium}` : '파일만 받아 검사'}`);
  // 현황 시트(Google 스프레드시트). 권한이 없는 사람은 '액세스 요청' 화면이 뜬다
  if (process.env.SHEET_URL) lines.push(`현황: ${process.env.SHEET_URL}`);
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
/** 결과가 같아도 보낸다 (Run workflow의 '변화가 없어도 보내기') */
const FORCE = process.argv.includes('--force');
/** 확인용으로 보낸 메시지는 제목 앞에 (TEST)를 붙여 평소 알림과 구분한다 */
const PREFIX = FORCE ? '(TEST) ' : '';
const [curFile, prevFile] = args;
if (!curFile) {
  console.error('사용법: node scripts/audit/notify.ts <이번 result.json> [지난 result.json] [--send] [--force]');
  process.exit(1);
}
const cur = JSON.parse(fs.readFileSync(curFile, 'utf8')) as AuditResult;
const prev = prevFile && fs.existsSync(prevFile) ? (JSON.parse(fs.readFileSync(prevFile, 'utf8')) as AuditResult) : null;
const outFile = path.join(path.dirname(curFile), 'message.txt');

if (cur.errors.length) {
  const text = [`${PREFIX}[Chrome 변경 점검] 점검 실패 · ${kst(cur.at)}`, '', ...cur.errors.map((e) => `· ${e}`), '', '배포로 파일 주소가 바뀌었거나(files.json 수정 필요) 일시적인 접속 문제일 수 있습니다. 이번 결과는 비교에 쓰지 않습니다.']
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

const unchanged = fresh.size === 0 && resolved.length === 0;
const text = PREFIX + buildMessage(cur, items, resolved);
fs.writeFileSync(outFile, text + '\n');
console.log(text);

// Actions에서 '지난 결과'를 새로 저장할지 알려 준다 (바뀐 게 없으면 커밋하지 않도록)
const changed = !prev || !unchanged;
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);

if (unchanged && !FORCE) {
  console.log('\n지난 결과와 같아 보내지 않음');
} else if (SEND) {
  await send(text);
} else {
  console.log(`\n(새로 ${fresh.size}건, 해결 ${resolved.length}건 — --send를 주면 팀룸으로 보냄)`);
}
