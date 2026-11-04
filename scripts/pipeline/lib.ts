// 콘텐츠 자동화 파이프라인 공통 모듈 (기획서 4장)
// Node 24의 타입 제거 실행으로 돌린다: `node scripts/pipeline/detect.ts`
import fs from 'node:fs';
import path from 'node:path';
import { FeatureSchema, ReleaseSchema, type Feature, type Release } from '../../src/lib/schema.ts';

export const ROOT = process.cwd();
export const OUT = path.join(ROOT, 'pipeline-out');
const FEATURES = path.join(ROOT, 'content', 'features');
const RELEASES = path.join(ROOT, 'content', 'releases');
const STATE = path.join(ROOT, 'content', 'pipeline-state.json');

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD) */
export function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ───────── 콘텐츠 ─────────

export function readFeatures(): Feature[] {
  return fs
    .readdirSync(FEATURES)
    .filter((f) => f.endsWith('.json'))
    .map((f) => FeatureSchema.parse(readJson(path.join(FEATURES, f))));
}

export function writeFeature(f: Feature) {
  writeJson(path.join(FEATURES, `${f.slug}.json`), FeatureSchema.parse(f));
}

export function featureExists(slug: string): boolean {
  return fs.existsSync(path.join(FEATURES, `${slug}.json`));
}

export function readReleases(): Release[] {
  return fs
    .readdirSync(RELEASES)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ReleaseSchema.parse(readJson(path.join(RELEASES, f))))
    .sort((a, b) => a.milestone - b.milestone);
}

export function writeRelease(r: Release) {
  writeJson(path.join(RELEASES, `${r.milestone}.json`), ReleaseSchema.parse(r));
}

// ───────── 파이프라인 상태: 검토 후 싣지 않기로 한 ChromeStatus 기능 ─────────

export type PipelineState = { ignored: Record<string, string> };

export function readState(): PipelineState {
  return fs.existsSync(STATE) ? (readJson(STATE) as PipelineState) : { ignored: {} };
}

export function writeState(s: PipelineState) {
  const ignored = Object.fromEntries(Object.entries(s.ignored).sort(([a], [b]) => a.localeCompare(b)));
  writeJson(STATE, { ignored });
}

// ───────── 단계 사이에 넘기는 기록 (pipeline-out/) ─────────

/** status: 상태·날짜만 바뀜(자동 병합 가능). content: 사람이 읽어야 하는 변경 */
export type Change = { scope: 'status' | 'content'; text: string };
export type Candidate = { id: number; milestone: number; type: string; name: string };

export type RunLog = {
  changes: Change[];
  candidates: Candidate[];
  drafted: { id: number; slug: string }[];
  skipped: { id: number; name: string; reason: string }[];
  verify: { channel: string; version: string; lines: string[]; warnings: string[] }[];
};

const LOG = path.join(OUT, 'run.json');

export function readLog(): RunLog {
  if (!fs.existsSync(LOG)) return { changes: [], candidates: [], drafted: [], skipped: [], verify: [] };
  return readJson(LOG) as RunLog;
}

export function writeLog(log: RunLog) {
  fs.mkdirSync(OUT, { recursive: true });
  writeJson(LOG, log);
}

// ───────── 외부 데이터 ─────────

const UA = { 'user-agent': 'chrome-update-content-pipeline' };

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) {
      let text = await res.text();
      // ChromeStatus API는 응답 앞에 XSSI 방지 접두어 )]}' 를 붙인다
      if (text.startsWith(")]}'")) text = text.slice(4);
      return JSON.parse(text);
    }
    if (attempt >= 2 || res.status < 500) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

/** Chromium Dash: 지금 Stable·Beta 채널의 마일스톤 */
export async function currentChannels(): Promise<{ stable: number; beta: number }> {
  const pick = async (channel: string) => {
    const list = (await getJson(
      `https://chromiumdash.appspot.com/fetch_releases?channel=${channel}&platform=Windows&num=1`,
    )) as { milestone: number }[];
    return list[0].milestone;
  };
  return { stable: await pick('Stable'), beta: await pick('Beta') };
}

/** Chromium Dash: 마일스톤의 stable 출시일 */
export async function stableDate(milestone: number): Promise<string> {
  const data = (await getJson(
    `https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=${milestone}`,
  )) as { mstones: { stable_date: string }[] };
  return data.mstones[0].stable_date.slice(0, 10);
}

export type CsListed = { id: number; name: string; summary: string; blink_components: string[] };

/** ChromeStatus: 마일스톤별 기능 목록 (종류별: Enabled by default, Deprecated, Removed, Origin trial …) */
export async function milestoneFeatures(milestone: number): Promise<Record<string, CsListed[]>> {
  const data = (await getJson(`https://chromestatus.com/api/v0/features?milestone=${milestone}`)) as {
    features_by_type: Record<string, CsListed[]>;
  };
  return data.features_by_type;
}

export type CsDetail = {
  id: number;
  name: string;
  summary: string;
  motivation?: string;
  spec_link?: string | null;
  explainer_links?: string[];
  doc_links?: string[];
  sample_links?: string[];
  blink_components?: string[];
  breaking_change?: boolean;
  feature_type?: string;
  web_feature?: string | null;
  browsers?: { chrome?: { status?: { text?: string }; desktop?: number | null; flag?: boolean } };
};

export async function featureDetail(id: number): Promise<CsDetail> {
  return (await getJson(`https://chromestatus.com/api/v0/features/${id}`)) as CsDetail;
}

export const csUrl = (id: number) => `https://chromestatus.com/feature/${id}`;

/** 사이트에 싣는 ChromeStatus 목록 종류와 사이트 상태의 대응 */
export const LISTED_TYPES = ['Enabled by default', 'Deprecated', 'Removed', 'Origin trial', 'Stepped rollout'] as const;
