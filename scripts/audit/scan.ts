// 서비스 코드 점검: 제거·동작 변경 기능을 쓰는 곳을 찾아 위치(파일:줄:열)를 알려 준다.
//
// 검사 대상을 모으는 방법은 셋이다.
//  - 파일 목록(--files 목록.json): 목록의 CSS·JS 파일만 HTTP로 받는다. 페이지를 열지 않고 스크립트도 실행하지 않아
//    PV·광고·통계에 잡히지 않는다. 광고 응답과 확장자 없는 서버 응답은 받지 않는다. (자동 점검은 이 방법만 쓴다)
//  - 폴더: 소스 폴더의 파일을 읽는다.
//  - 페이지 URL: Chromium으로 페이지를 열어 받는 파일을 모으고 Chrome의 deprecation 경고도 모은다.
//    실제 방문이라 PV·광고·통계에 잡힌다. 꼭 필요할 때 로컬에서만 쓴다.
//
// 찾는 규칙: 기능 JSON의 `scan` + legacy-rules.json(사이트에 정리되기 전부터 Chrome이 경고하던 기능)
//
// 실행: node scripts/audit/scan.ts [--files 목록.json] [폴더 또는 URL ...] [--targets 목록.txt] [--own nate.com,nateimg.co.kr] [--out audit-out]
// 결과: <out>/result.json, <out>/report.html  — 점검 결과는 공개 저장소에 올리지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { ScanRuleSchema, type Feature, type Lang, type ScanRule } from '../../src/lib/schema.ts';
import { readFeatures } from '../pipeline/lib.ts';
import { renderReport } from './report.ts';

// ───────── 인자 ─────────

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const FLAGS_WITH_VALUE = new Set(['--targets', '--own', '--out', '--files']);
const filesList = argValue('--files');
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !FLAGS_WITH_VALUE.has(all[i - 1]));
const targetsFile = argValue('--targets');
const targets = [
  ...positional,
  ...(targetsFile
    ? fs
        .readFileSync(targetsFile, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*/, '').trim())
        .filter(Boolean)
    : []),
];
const OWN = (argValue('--own') ?? process.env.AUDIT_OWN ?? 'nate.com,nateimg.co.kr').split(',').map((s) => s.trim()).filter(Boolean);
const OUT = path.resolve(argValue('--out') ?? 'audit-out');
const SITE = (process.env.SITE_URL ?? 'https://nate-fe.github.io/chrome-update').replace(/\/$/, '');

if (targets.length === 0 && !filesList) {
  console.error('사용법: node scripts/audit/scan.ts [--files 목록.json] [폴더 또는 URL ...] [--targets 목록.txt] [--own 도메인,...] [--out 폴더]');
  process.exit(1);
}

// ───────── 결과 형식 (비공개 저장소의 알림 단계도 이 형식을 읽는다) ─────────

export type Source = { url: string; kind: Lang; text: string; pages: Set<string> };

export type Finding = {
  /** 줄 번호가 바뀌어도 같은 문제로 알아보기 위한 키: 기능|주소(쿼리 제외)|걸린 코드 */
  key: string;
  slug: string;
  title: string;
  level: ScanRule['level'];
  noteKo: string;
  guideKo: string | null;
  link: string;
  /** legacy 규칙처럼 특정 버전이 없는 경고는 null */
  milestone: number | null;
  status: Feature['status'];
  url: string;
  own: boolean;
  line: number;
  col: number;
  match: string;
  snippet: string;
  pages: string[];
};

export type RuntimeWarning = {
  key: string;
  type: string;
  url: string;
  own: boolean;
  line: number;
  col: number;
  snippet: string | null;
  pages: string[];
  /** 동기 XHR: 불러온 주소 */
  request: string | null;
  /** 동기 XHR: 실제로 요청을 연 라이브러리 위치 (url·line·col은 그 라이브러리를 부른 코드, 즉 고칠 곳) */
  via: string | null;
};

export type AuditResult = {
  at: string;
  chromium: string | null;
  targets: string[];
  own: string[];
  files: { url: string; kind: Lang; own: boolean; bytes: number }[];
  /** 파일 목록 방식에서 받지 않은 주소와 이유 */
  skipped: { url: string; reason: string }[];
  errors: string[];
  findings: Finding[];
  runtime: RuntimeWarning[];
};

// ───────── 공통 ─────────

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isOwn(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true; // 로컬 파일은 우리 것
  return OWN.some((d) => host === d || host.endsWith(`.${d}`));
}

/** 같은 파일이 ?v=123 같은 쿼리만 바뀌어 다시 배포돼도 같은 키가 되도록 */
function stableUrl(url: string): string {
  return url.replace(/[?#].*$/, '');
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function position(starts: number[], index: number): { line: number; col: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: index - starts[lo] + 1 };
}

/** 걸린 곳 주변 코드. 압축 파일은 한 줄이 길어서 앞뒤 일부만 자른다 */
function snippetAt(text: string, starts: number[], line: number, col: number, length: number): string {
  const start = starts[line - 1];
  const end = line < starts.length ? starts[line] - 1 : text.length;
  const whole = text.slice(start, end).replace(/\r$/, '');
  if (whole.length <= 160) return whole.trim();
  const from = Math.max(0, col - 1 - 60);
  const to = Math.min(whole.length, col - 1 + length + 60);
  return `${from > 0 ? '…' : ''}${whole.slice(from, to)}${to < whole.length ? '…' : ''}`;
}

/** 파일 종류마다 적용할 규칙 언어. HTML에는 인라인 <script>·<style>이 있고, JS에는 CSS 문자열이 들어 있을 수 있다 */
const APPLIES: Record<Lang, Lang[]> = { html: ['html', 'js', 'css'], js: ['js', 'css'], css: ['css'] };

// ───────── 정적 검사 ─────────

/** 규칙의 주인: 사이트의 기능이거나 legacy-rules.json 항목 */
type RuleOwner = {
  slug: string;
  title: string;
  guideKo: string | null;
  link: string;
  milestone: number | null;
  status: Feature['status'];
  /** jQuery 같은 라이브러리 파일에는 적용하지 않는다 (라이브러리 내부 구현이 걸려서 고칠 곳을 가린다) */
  skipLibraries: boolean;
};
type CompiledRule = { feature: RuleOwner; rule: ScanRule; re: RegExp };

/**
 * 라이브러리 파일 (동기 XHR 위치를 찾을 때 건너뛰고, skipLibraries 규칙을 적용하지 않는다)
 * plast는 Sizzle을 품고 있어 jQuery와 같은 unload 등록 코드(iframe 전용, IE 메모리 정리용)가 들어 있다.
 */
const LIBRARY = /(jquery|zepto|prototype|mootools|lodash|underscore|axios|require|swiper|clipboard|kakao|partytown|plast)[\w.-]*\.js/i;

function compileRules(features: Feature[]): CompiledRule[] {
  return features.flatMap((f) => {
    const owner: RuleOwner = {
      slug: f.slug,
      title: f.title,
      guideKo: f.guideKo,
      link: `${SITE}/features/${f.slug}/`,
      milestone: f.milestone,
      status: f.status,
      skipLibraries: false,
    };
    return (f.scan ?? []).map((rule) => ({ feature: owner, rule, re: new RegExp(rule.pattern, 'g') }));
  });
}

/** 사이트에 정리되기 전부터 Chrome이 deprecated로 경고하던 기능의 규칙 (브라우저 실행 검사를 대신한다) */
function legacyRules(): CompiledRule[] {
  const file = new URL('./legacy-rules.json', import.meta.url);
  type Legacy = Omit<RuleOwner, 'skipLibraries'> & { skipLibraries?: boolean; scan: unknown[] };
  const list = JSON.parse(fs.readFileSync(file, 'utf8')) as Legacy[];
  return list.flatMap(({ scan, ...o }) =>
    scan.map((r) => {
      const rule = ScanRuleSchema.parse(r);
      return { feature: { ...o, skipLibraries: o.skipLibraries ?? false }, rule, re: new RegExp(rule.pattern, 'g') };
    }),
  );
}

function scanSource(src: Source, rules: CompiledRule[]): Finding[] {
  const starts = lineStarts(src.text);
  const found = new Map<string, Finding>();
  const isLibrary = LIBRARY.test(stableUrl(src.url));
  for (const { feature, rule, re } of rules) {
    if (!APPLIES[src.kind].includes(rule.lang)) continue;
    if (feature.skipLibraries && isLibrary) continue;
    re.lastIndex = 0;
    for (let m = re.exec(src.text); m; m = re.exec(src.text)) {
      if (m[0].length === 0) re.lastIndex++;
      const { line, col } = position(starts, m.index);
      // 같은 기능이 같은 줄에서 여러 규칙에 걸리면 한 번만
      const dedupe = `${feature.slug}|${line}`;
      if (found.has(dedupe)) continue;
      const match = m[0].length > 80 ? `${m[0].slice(0, 80)}…` : m[0];
      found.set(dedupe, {
        key: `${feature.slug}|${stableUrl(src.url)}|${m[0].replace(/\s+/g, ' ').slice(0, 120)}`,
        slug: feature.slug,
        title: feature.title,
        level: rule.level,
        noteKo: rule.noteKo,
        guideKo: feature.guideKo,
        link: feature.link,
        milestone: feature.milestone,
        status: feature.status,
        url: src.url,
        own: isOwn(src.url),
        line,
        col,
        match,
        snippet: snippetAt(src.text, starts, line, col, m[0].length),
        pages: [...src.pages],
      });
    }
  }
  return [...found.values()];
}

// ───────── 소스 모으기: 폴더 ─────────

const EXT: Record<string, Lang> = {
  '.html': 'html', '.htm': 'html', '.jsp': 'html', '.php': 'html', '.vue': 'html', '.xml': 'html', '.xsl': 'html',
  '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'js', '.ts': 'js', '.tsx': 'js',
  '.css': 'css', '.scss': 'css', '.sass': 'css', '.less': 'css',
};
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.next', 'dist', 'build', 'out', 'coverage']);

function collectDir(dir: string, into: Map<string, Source>, root = path.dirname(path.resolve(dir))) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectDir(full, into, root);
      continue;
    }
    const kind = EXT[path.extname(entry.name).toLowerCase()];
    if (!kind) continue;
    const rel = path.relative(root, path.resolve(full)).replaceAll('\\', '/');
    into.set(rel, { url: rel, kind, text: fs.readFileSync(full, 'utf8'), pages: new Set() });
  }
}

// ───────── 소스 모으기: 페이지 (정적 + 실행 검사) ─────────

const KIND_BY_TYPE: Record<string, Lang> = { document: 'html', script: 'js', stylesheet: 'css' };

type RawIssue = { type: string; url: string; line: number; col: number; page: string };
type Frame = { url: string; line: number; col: number };
type RawStack = { page: string; request: string; frames: Frame[] };

function parseStack(stack: string): Frame[] {
  return [...stack.matchAll(/(https?:\/\/[^\s()]+):(\d+):(\d+)/g)].map((m) => ({ url: m[1], line: Number(m[2]), col: Number(m[3]) }));
}

async function visit(page: Page, target: string, sources: Map<string, Source>, issues: RawIssue[], stacks: RawStack[], errors: string[]) {
  const pending: Promise<void>[] = [];
  page.on('response', (res) => {
    const kind = KIND_BY_TYPE[res.request().resourceType()];
    const url = res.url();
    if (!kind || !/^https?:/.test(url) || res.status() >= 300) return;
    pending.push(
      res
        .text()
        .then((text) => {
          const prev = sources.get(url);
          if (prev) prev.pages.add(target);
          else sources.set(url, { url, kind, text, pages: new Set([target]) });
        })
        .catch(() => {}),
    );
  });

  // Chrome DevTools '문제(Issues)' 탭의 deprecation 경고. 위치가 함께 온다.
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Audits.issueAdded', ({ issue }) => {
    if (issue.code !== 'DeprecationIssue') return;
    const d = issue.details.deprecationIssueDetails;
    if (!d) return;
    const loc = d.sourceCodeLocation;
    issues.push({ type: d.type, url: loc.url, line: loc.lineNumber + 1, col: loc.columnNumber + 1, page: target });
  });
  await cdp.send('Audits.enable');

  // Chrome 경고는 동기 XHR을 실제로 연 곳(대개 jQuery 내부)만 알려 준다. 부른 코드를 찾으려고 호출 스택을 남긴다.
  await page.addInitScript(() => {
    const w = window as unknown as { __auditSyncXhr: { request: string; stack: string }[] };
    w.__auditSyncXhr = [];
    const open = XMLHttpRequest.prototype.open as (...a: unknown[]) => void;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
      if (args[2] === false) w.__auditSyncXhr.push({ request: String(args[1]), stack: new Error().stack ?? '' });
      return open.apply(this, args);
    } as typeof XMLHttpRequest.prototype.open;
  });

  try {
    await page.goto(target, { waitUntil: 'load', timeout: 60_000 });
    // 아래로 내려야 불러오는 파일(지연 로딩 광고·위젯)까지 받는다
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 300));
      }
    });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    for (const frame of page.frames()) {
      const raw = await frame
        .evaluate(() => (window as unknown as { __auditSyncXhr?: { request: string; stack: string }[] }).__auditSyncXhr ?? [])
        .catch(() => []);
      for (const r of raw) stacks.push({ page: target, request: r.request, frames: parseStack(r.stack) });
    }
  } catch (e) {
    errors.push(`${target}: ${(e as Error).message.split('\n')[0]}`);
  }
  await Promise.all(pending);
}

// ───────── 소스 모으기: 파일 목록 (페이지를 열지 않음) ─────────

type FilesList = { pages: { name: string; device: string; files: { type: 'css' | 'js'; url: string }[] }[] };

/** 받지 않을 주소. 광고 응답은 노출로 잡힐 수 있고, 확장자 없는 주소는 서버가 그때그때 만드는 응답이라 기록이 남을 수 있다 */
function skipReason(url: string): string | null {
  const u = new URL(url);
  if (/^cyad\d*\./i.test(u.hostname)) return '광고 응답';
  if (!/\.(js|css)$/i.test(u.pathname)) return '확장자 없는 서버 응답';
  return null;
}

/** 대부분 UTF-8이지만 오래된 파일은 EUC-KR일 수 있다 */
function decode(buf: ArrayBuffer, contentType: string): string {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (declared) {
    try {
      return new TextDecoder(declared).decode(buf);
    } catch {
      // 모르는 이름이면 아래에서 추측
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

async function download(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'chrome-update-audit (static file check)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return decode(await res.arrayBuffer(), res.headers.get('content-type') ?? '');
    } catch (e) {
      if (attempt >= 1 || /HTTP 4\d\d/.test((e as Error).message)) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function collectFiles(file: string, into: Map<string, Source>, skipped: AuditResult['skipped'], errors: string[], pageNames: string[]) {
  const list = JSON.parse(fs.readFileSync(file, 'utf8')) as FilesList;
  const wanted = new Map<string, { kind: Lang; pages: Set<string> }>();
  for (const p of list.pages) {
    const label = `${p.name}(${p.device === 'mobile' ? '모바일' : 'PC'})`;
    pageNames.push(label);
    for (const f of p.files) {
      const reason = skipReason(f.url);
      if (reason) {
        if (!skipped.some((s) => s.url === f.url)) skipped.push({ url: f.url, reason });
        continue;
      }
      const w = wanted.get(f.url) ?? { kind: f.type, pages: new Set<string>() };
      w.pages.add(label);
      wanted.set(f.url, w);
    }
  }
  // 한꺼번에 몰리지 않도록 4개씩
  const queue = [...wanted.entries()];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [url, { kind, pages }] = item;
      try {
        into.set(url, { url, kind, text: await download(url), pages });
      } catch (e) {
        errors.push(`${url}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
}

// ───────── 실행 ─────────

const features = readFeatures();
const rules = [...compileRules(features), ...legacyRules()];
const sources = new Map<string, Source>();
const issues: RawIssue[] = [];
const stacks: RawStack[] = [];
const errors: string[] = [];
const skipped: AuditResult['skipped'] = [];
const pageNames: string[] = [];
let chromiumVersion: string | null = null;

if (filesList) {
  console.log(`파일 목록: ${filesList}`);
  await collectFiles(filesList, sources, skipped, errors, pageNames);
}

const urls = targets.filter((t) => /^https?:\/\//.test(t));
for (const t of targets.filter((t) => !/^https?:\/\//.test(t))) {
  if (fs.existsSync(t) && fs.statSync(t).isDirectory()) collectDir(t, sources);
  else errors.push(`${t}: URL도 폴더도 아님`);
}

if (urls.length > 0) {
  console.warn('⚠ 페이지 URL 검사는 실제 방문이라 PV·광고·통계에 잡힌다.');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  chromiumVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
  for (const url of urls) {
    console.log(`열기: ${url}`);
    const page = await context.newPage();
    await visit(page, url, sources, issues, stacks, errors);
    await page.close();
  }
  await browser.close();
}

const findings = [...sources.values()]
  .flatMap((s) => scanSource(s, rules))
  .sort((a, b) => Number(b.own) - Number(a.own) || a.slug.localeCompare(b.slug) || a.url.localeCompare(b.url) || a.line - b.line);

function snippetOf(url: string, line: number, col: number): string | null {
  const src = sources.get(url);
  if (!src) return null;
  const starts = lineStarts(src.text);
  return line <= starts.length ? snippetAt(src.text, starts, line, col, 1) : null;
}

// 같은 경고가 여러 페이지에서 나오면 하나로 묶는다
const runtimeMap = new Map<string, RuntimeWarning>();
function addRuntime(w: Omit<RuntimeWarning, 'key' | 'own' | 'snippet' | 'pages'>, page: string) {
  const id = `${w.type}|${w.url}|${w.line}|${w.col}`;
  const prev = runtimeMap.get(id);
  if (prev) {
    if (!prev.pages.includes(page)) prev.pages.push(page);
    return;
  }
  runtimeMap.set(id, {
    key: `${w.type}|${stableUrl(w.url)}`,
    own: isOwn(w.url),
    snippet: snippetOf(w.url, w.line, w.col),
    pages: [page],
    ...w,
  });
}

// 동기 XHR은 직접 남긴 호출 스택으로 위치를 잡는다. 라이브러리를 건너뛴 첫 위치가 고칠 곳이다.
// (open을 감싸면 Chrome 경고의 위치가 감싼 코드로 바뀌므로 Chrome 경고는 쓰지 않는다)
const SYNC_XHR = 'XMLHttpRequestSynchronousInNonWorkerOutsideBeforeUnload';
const pagesWithStacks = new Set<string>();
for (const st of stacks) {
  if (st.frames.length === 0) continue;
  pagesWithStacks.add(st.page);
  const opener = st.frames[0];
  const caller = st.frames.find((f) => !LIBRARY.test(f.url)) ?? opener;
  addRuntime(
    { type: SYNC_XHR, url: caller.url, line: caller.line, col: caller.col, request: st.request, via: caller === opener ? null : `${opener.url}:${opener.line}:${opener.col}` },
    st.page,
  );
}
for (const i of issues) {
  if (i.type === SYNC_XHR && pagesWithStacks.has(i.page)) continue;
  addRuntime({ type: i.type, url: i.url || i.page, line: i.line, col: i.col, request: null, via: null }, i.page);
}
const runtime = [...runtimeMap.values()].sort((a, b) => Number(b.own) - Number(a.own) || a.type.localeCompare(b.type));

const result: AuditResult = {
  at: new Date().toISOString(),
  chromium: chromiumVersion,
  targets: [...pageNames, ...targets],
  own: OWN,
  files: [...sources.values()]
    .map((s) => ({ url: s.url, kind: s.kind, own: isOwn(s.url), bytes: Buffer.byteLength(s.text) }))
    .sort((a, b) => a.url.localeCompare(b.url)),
  skipped,
  errors,
  findings,
  runtime,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'report.html'), renderReport(result, rules.length));

// ───────── 요약 ─────────

const count = (list: { own: boolean }[], own: boolean) => list.filter((x) => x.own === own).length;
console.log(`\n검사한 파일 ${result.files.length}개, 받지 않은 주소 ${skipped.length}개 (규칙 ${rules.length}개, ${chromiumVersion ? `Chromium ${chromiumVersion}` : '브라우저 실행 없음'})`);
console.log(`정적 검사: 고쳐야 함 ${findings.filter((f) => f.level === 'fix').length}곳, 확인 필요 ${findings.filter((f) => f.level === 'check').length}곳 (네이트 ${count(findings, true)} · 외부 ${count(findings, false)})`);
console.log(`실행 검사: Chrome deprecation 경고 ${runtime.length}건 (네이트 ${count(runtime, true)} · 외부 ${count(runtime, false)})`);
for (const f of findings.filter((f) => f.own)) console.log(` [${f.level}] ${f.title} — ${f.url}:${f.line}:${f.col}`);
for (const r of runtime.filter((r) => r.own)) {
  console.log(` [실행] ${r.type} — ${r.url}:${r.line}:${r.col}`);
  if (r.request) console.log(`        불러온 주소: ${r.request}`);
}
for (const e of errors) console.warn(` ⚠ ${e}`);
console.log(`\n보고서: ${path.join(OUT, 'report.html')}`);
