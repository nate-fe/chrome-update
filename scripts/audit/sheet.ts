// 점검 결과를 Google 스프레드시트 현황판으로 보낸다. 시트 쪽은 Apps Script 웹 앱이 받아서 고친다.
// (Apps Script 코드와 설정 방법은 비공개 저장소 chrome-update-audit의 apps-script/ 에 있다)
//
// 실행: node scripts/audit/sheet.ts <result.json> [--dry-run]
// 환경 변수: SHEET_WEBHOOK_URL(Apps Script 웹 앱 주소), SHEET_SECRET(Apps Script setup()이 만든 비밀값)
//  - 둘 중 하나라도 없으면 건너뛴다.
//  - 검사 오류가 있는 결과는 보내지 않는다 (일부 파일이 빠진 결과로 고치면 '해결'로 잘못 옮겨진다).
//  - --dry-run: 보내지 않고 보낼 내용만 출력한다.
import fs from 'node:fs';
import type { AuditResult } from './scan.ts';
import { itemsOf, kst } from './items.ts';

/** 시트 한 줄: 같은 키(같은 기능·파일·코드)는 줄 번호가 여러 개여도 한 줄로 묶는다 */
export type SheetRow = {
  key: string;
  level: '고쳐야 함' | '확인 필요';
  service: string;
  group: string;
  reason: string;
  file: string;
  lines: string;
  snippet: string;
  pages: string;
};

export type SheetPayload = {
  secret: string;
  checkedAt: string;
  files: number;
  pages: number;
  rows: SheetRow[];
};

function rowsOf(r: AuditResult): SheetRow[] {
  const byKey = new Map<string, SheetRow & { nums: number[] }>();
  for (const it of itemsOf(r)) {
    const prev = byKey.get(it.key);
    if (prev) {
      if (!prev.nums.includes(it.line)) prev.nums.push(it.line);
      continue;
    }
    byKey.set(it.key, {
      key: it.key,
      level: it.level === 'fix' ? '고쳐야 함' : '확인 필요',
      service: it.service,
      group: it.group,
      reason: it.reason,
      file: it.file,
      lines: '',
      snippet: it.snippet ?? '',
      pages: it.pages.join(', '),
      nums: [it.line],
    });
  }
  return [...byKey.values()].map(({ nums, ...row }) => ({ ...row, lines: nums.sort((a, b) => a - b).join(', ') }));
}

const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry-run');
if (!file) {
  console.error('사용법: node scripts/audit/sheet.ts <result.json> [--dry-run]');
  process.exit(1);
}
const result = JSON.parse(fs.readFileSync(file, 'utf8')) as AuditResult;
const url = process.env.SHEET_WEBHOOK_URL;
const secret = process.env.SHEET_SECRET;

if (result.errors.length) {
  console.log('검사 오류가 있어 현황 시트는 고치지 않음');
  process.exit(0);
}

const payload: SheetPayload = {
  secret: secret ?? '',
  checkedAt: kst(result.at),
  files: result.files.length,
  pages: result.targets.length,
  rows: rowsOf(result),
};

if (DRY) {
  console.log(JSON.stringify({ ...payload, secret: payload.secret ? '(있음)' : '(없음)' }, null, 2));
  process.exit(0);
}
if (!url || !secret) {
  console.log('SHEET_WEBHOOK_URL 또는 SHEET_SECRET이 없어 현황 시트는 건너뜀');
  process.exit(0);
}

// Apps Script 웹 앱은 처리한 뒤 결과 페이지로 넘겨 주므로(302) 그대로 따라간다
const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
  redirect: 'follow',
  signal: AbortSignal.timeout(60_000),
});
const text = await res.text();
let reply: { ok?: boolean; error?: string; open?: number; added?: number; resolved?: number } = {};
try {
  reply = JSON.parse(text);
} catch {
  // 로그인 화면 같은 HTML이 오면 웹 앱 '액세스 권한' 설정이 잘못된 것이다
}
if (!res.ok || !reply.ok) {
  console.error(`현황 시트 갱신 실패: ${res.status} ${reply.error ?? text.slice(0, 200)}`);
  process.exit(1);
}
console.log(`현황 시트 갱신: 남은 ${reply.open}건, 새로 ${reply.added}건, 해결 ${reply.resolved}건`);
