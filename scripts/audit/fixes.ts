// Claude가 쓴 '해결 방법' 제안을 다룬다.
//
//  input: 아직 제안이 없는 '고쳐야 함' 위치를 골라, 그 파일의 앞뒤 코드와 함께 fix-input.json으로 쓴다.
//         같은 내용을 GITHUB_OUTPUT data로도 내보내 워크플로가 Claude 지시문에 바로 넣는다.
//         node scripts/audit/fixes.ts input <result.json> <fixes.json> [--max 10]
//         → <result.json과 같은 폴더>/fix-input.json, GITHUB_OUTPUT count=<개수>, data=<JSON>
//  merge: Claude Code Action의 structured_output(환경 변수 FIXES)을 fixes.json에 더한다.
//         node scripts/audit/fixes.ts merge <fixes.json>
//         → GITHUB_OUTPUT updated=true|false
//
// fixes.json은 비공개 저장소의 state/에 쌓인다. 한 번 받은 위치는 다시 묻지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import type { AuditResult } from './scan.ts';
import { itemsOf, readFixes } from './items.ts';
import { download } from './fetch.ts';

/** Claude에게 넘기는 한 위치 */
type FixInput = { key: string; problem: string; reason: string; file: string; lines: number[]; snippet: string; context: string };

/** 걸린 줄의 앞뒤 코드. 압축 파일처럼 한 줄이 긴 경우 그 줄에서 걸린 곳 앞뒤만 자른다 */
function contextOf(text: string, line: number, col: number): string {
  const lines = text.split('\n');
  const target = lines[line - 1] ?? '';
  if (target.length > 300) {
    const from = Math.max(0, col - 1 - 500);
    return `(압축된 ${line}번째 줄의 ${from + 1}~${from + 1000}번째 글자)\n${target.slice(from, col - 1 + 500)}`;
  }
  const start = Math.max(1, line - 12);
  const end = Math.min(lines.length, line + 12);
  const out: string[] = [];
  for (let n = start; n <= end; n++) {
    const text = lines[n - 1].replace(/\r$/, '');
    // 걸린 줄은 그대로, 앞뒤 줄은 길면 자른다 (Claude 사용량을 아끼려고)
    const shown = n === line || text.length <= 200 ? text : `${text.slice(0, 200)}…`;
    out.push(`${n === line ? '>' : ' '}${n}: ${shown}`);
  }
  return out.join('\n');
}

function setOutput(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'input') {
  const [resultFile, fixesFile] = rest.filter((a) => !a.startsWith('--'));
  const maxAt = rest.indexOf('--max');
  const MAX = maxAt >= 0 ? Number(rest[maxAt + 1]) : 10;
  const result = JSON.parse(fs.readFileSync(resultFile, 'utf8')) as AuditResult;
  const store = readFixes(fixesFile);

  // 같은 키(같은 기능·파일·코드)는 한 번만, 줄 번호는 모아서
  const byKey = new Map<string, { item: ReturnType<typeof itemsOf>[number]; lines: number[]; col: number }>();
  for (const it of itemsOf(result)) {
    if (it.level !== 'fix' || store[it.key]) continue;
    const prev = byKey.get(it.key);
    if (prev) prev.lines.push(it.line);
    else byKey.set(it.key, { item: it, lines: [it.line], col: 1 });
  }
  // 열 번호는 결과의 원래 항목에서 찾는다 (압축 파일에서 앞뒤를 자를 때 필요)
  for (const f of result.findings) {
    const e = byKey.get(f.key);
    if (e && e.lines[0] === f.line) e.col = f.col;
  }

  const picked = [...byKey.values()].slice(0, MAX);
  const cache = new Map<string, string>();
  const inputs: FixInput[] = [];
  for (const { item, lines, col } of picked) {
    let text = cache.get(item.url);
    if (text === undefined) {
      try {
        text = await download(item.url);
      } catch (e) {
        console.warn(`${item.url}: ${(e as Error).message} — 앞뒤 코드 없이 넘김`);
        text = '';
      }
      cache.set(item.url, text);
    }
    inputs.push({
      key: item.key,
      problem: item.group,
      reason: item.reason,
      file: item.file,
      lines: lines.sort((a, b) => a - b),
      snippet: item.snippet ?? '',
      context: text ? contextOf(text, lines[0], col) : '',
    });
  }
  const out = path.join(path.dirname(resultFile), 'fix-input.json');
  fs.writeFileSync(out, JSON.stringify(inputs, null, 2) + '\n');
  setOutput('count', String(inputs.length));
  // 워크플로가 이 내용을 Claude 지시문에 바로 넣는다 (파일을 읽는 단계를 없애 주고받기를 한 번으로 줄이려고)
  if (process.env.GITHUB_OUTPUT && inputs.length) {
    const end = `FIX_INPUT_${Math.random().toString(36).slice(2)}`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `data<<${end}\n${JSON.stringify(inputs)}\n${end}\n`);
  }
  console.log(`해결 방법을 물을 위치 ${inputs.length}곳 (이미 받은 곳 ${Object.keys(store).length}곳, 최대 ${MAX}곳) → ${out}`);
} else if (cmd === 'merge') {
  const [fixesFile] = rest;
  const raw = process.env.FIXES;
  if (!raw) {
    console.log('FIXES가 비어 있어 더할 제안 없음');
    setOutput('updated', 'false');
    process.exit(0);
  }
  const parsed = JSON.parse(raw) as { fixes?: { key: string; fix: string }[] };
  const store = readFixes(fixesFile);
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  let added = 0;
  for (const { key, fix } of parsed.fixes ?? []) {
    const text = String(fix ?? '').trim();
    if (!key || !text) continue;
    store[key] = { fix: text.length > 500 ? `${text.slice(0, 500)}…` : text, at: today };
    added++;
  }
  fs.mkdirSync(path.dirname(fixesFile), { recursive: true });
  fs.writeFileSync(fixesFile, JSON.stringify(store, null, 2) + '\n');
  setOutput('updated', added > 0 ? 'true' : 'false');
  console.log(`해결 방법 제안 ${added}개 저장 → ${fixesFile}`);
} else {
  console.error('사용법: node scripts/audit/fixes.ts input <result.json> <fixes.json> [--max 10] | merge <fixes.json>');
  process.exit(1);
}
