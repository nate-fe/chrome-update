// 5단계 자동 검사: 실제 Chrome(Stable·Beta)으로
//  1) 기능 감지 식을 돌려 '출시됨' 표시가 맞는지 확인하고
//  2) CSS 미리보기를 예시 코드 적용 전/후로 찍어 실제로 달라 보이는지 확인한다.
// --fix: Stable에서 지원하지 않는 '출시됨' 기능을 '연기됨'으로 바꾼다 (사람이 PR에서 확인).
//
// 실행: node scripts/pipeline/verify.ts [--fix]
// 채널: VERIFY_CHANNELS=chrome,chrome-beta (Playwright 채널 이름)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import type { Feature, FeatureTest } from '../../src/lib/schema.ts';
import { OUT, readFeatures, readLog, today, writeFeature, writeLog } from './lib.ts';

const FIX = process.argv.includes('--fix');
const CHANNELS = (process.env.VERIFY_CHANNELS ?? 'chrome,chrome-beta').split(',').map((s) => s.trim()).filter(Boolean);

// 사이트 다크 테마와 같은 색 변수 (미리보기 바탕 스타일이 쓴다)
const TOKENS = `:root{--bg:#0d1117;--editor:#11151d;--panel:#161b25;--fg:#d5dae3;--fg-dim:#9aa4b5;--muted:#6b7587;
--line:#2a3140;--accent:#5aa9ff;--mono:Consolas,ui-monospace,monospace;--sans:'Segoe UI',sans-serif}
body{margin:0;padding:12px;background:var(--editor);color:var(--fg);font:13px/1.5 var(--sans)}
*,*::before,*::after{box-sizing:border-box}`;

function previewDoc(f: Feature, withCode: boolean): string {
  const p = f.preview!;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${TOKENS}\n${p.css}\n${withCode ? f.exampleCode : ''}</style></head><body><div id="stage" style="display:inline-block;min-width:260px">${p.html}</div></body></html>`;
}

// about:blank은 보안 컨텍스트가 아니라 [SecureContext] API(navigator.install 등)가 안 보인다.
// 가짜 https 주소를 가로채 HTML을 돌려주면 네트워크 없이 보안 컨텍스트에서 검사할 수 있다.
const PAGE_URL = 'https://verify.test/';

async function openDoc(page: Page, html: string): Promise<void> {
  await page.route(PAGE_URL, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(PAGE_URL);
}

async function runTest(browser: Browser, test: FeatureTest): Promise<boolean | null> {
  const page = await browser.newPage();
  try {
    await openDoc(page, '<!doctype html><html><body></body></html>');
    return await page.evaluate(async (t) => {
      try {
        if (t.kind === 'css') return CSS.supports(t.decl);
        if (t.kind === 'media') return matchMedia(t.query).matches !== matchMedia(`not ${t.query}`).matches;
        return Boolean(await new Function(`return (${t.expr})`)());
      } catch {
        return null;
      }
    }, test);
  } finally {
    await page.close();
  }
}

async function shot(browser: Browser, html: string, file: string): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: 480, height: 240 } });
  try {
    await openDoc(page, html);
    const buf = await page.locator('#stage').screenshot({ animations: 'disabled' });
    fs.writeFileSync(file, buf);
    return buf;
  } finally {
    await page.close();
  }
}

const log = readLog();
log.verify = [];
let features = readFeatures();

for (const channel of CHANNELS) {
  let browser: Browser;
  try {
    browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
  } catch (e) {
    console.warn(`${channel}: 실행할 수 없어 건너뜀 (${(e as Error).message.split('\n')[0]})`);
    continue;
  }
  const version = browser.version();
  const major = Number(version.split('.')[0]);
  const isStable = channel === 'chrome';
  const lines: string[] = [];
  const warnings: string[] = [];
  const dir = path.join(OUT, 'screens', channel);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`${channel} ${version}`);

  for (const f of features) {
    const reached = f.milestone <= major;
    let supported: boolean | null = null;

    if (f.featureTest) {
      supported = await runTest(browser, f.featureTest);
      const mark = supported === null ? '오류' : supported ? '지원' : '미지원';
      lines.push(`${f.slug} (M${f.milestone}, ${f.status}): ${mark}`);

      const shouldSupport = reached && f.category !== 'deprecation' && (f.status === 'shipped' || f.status === 'beta');
      if (supported === null) {
        warnings.push(`${f.slug}: 감지 식 실행 오류 — 식을 확인해 주세요`);
      } else if (shouldSupport && !supported) {
        if (isStable && FIX && f.status === 'shipped') {
          const next: Feature = {
            ...f,
            status: 'postponed',
            needsCheck: [...new Set([...f.needsCheck, 'milestone'])],
            history: [
              ...f.history,
              { milestone: f.milestone, channel: 'mention', note: `Chrome ${major} stable에서 기본 비활성 확인 (${today()}, 자동 검사)` },
            ],
          };
          writeFeature(next);
          features = features.map((x) => (x.slug === f.slug ? next : x));
          log.changes.push({ scope: 'content', text: `${f.slug}: Chrome ${major} stable에서 미지원 → '출시 연기'로 변경` });
        } else {
          warnings.push(`${f.slug}: Chrome ${major} ${isStable ? 'stable' : 'beta'}에서 미지원 (사이트 상태: ${f.status}, M${f.milestone})`);
        }
      } else if (f.status === 'postponed' && supported && isStable) {
        warnings.push(`${f.slug}: '출시 연기'지만 Chrome ${major} stable에서 지원됨 — 출시 버전을 확인해 주세요`);
      }
    }

    // 미리보기: 이 브라우저에 들어 있어야 할 기능만, 적용 전/후 비교
    if (f.preview && f.category === 'css' && f.status !== 'postponed' && reached && supported !== false) {
      const before = await shot(browser, previewDoc(f, false), path.join(dir, `${f.slug}-before.png`));
      const after = await shot(browser, previewDoc(f, true), path.join(dir, `${f.slug}-after.png`));
      const same = before.equals(after);
      lines.push(`${f.slug} 미리보기: ${same ? '적용 전후 같음' : '적용됨'}`);
      if (same) warnings.push(`${f.slug}: 미리보기가 예시 코드 적용 전후로 똑같이 보임 — preview HTML/CSS를 확인해 주세요`);
    }
  }

  await browser.close();
  log.verify.push({ channel, version, lines, warnings });
  console.log(lines.map((l) => ` ${l}`).join('\n'));
  for (const w of warnings) console.warn(` ⚠ ${w}`);
}

writeLog(log);
