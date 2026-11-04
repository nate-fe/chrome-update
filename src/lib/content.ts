import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { FeatureSchema, ReleaseSchema, type Feature, type Release } from './schema';
import { sortByAttention } from './labels';

const CONTENT = path.join(process.cwd(), 'content');

function readDir<T>(dir: string, parse: (data: unknown, file: string) => T): T[] {
  const full = path.join(CONTENT, dir);
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    .map((file) => parse(JSON.parse(fs.readFileSync(path.join(full, file), 'utf8')), `${dir}/${file}`));
}

// 빌드 시 스키마 검증: 잘못된 콘텐츠 파일이 있으면 빌드가 실패한다
function validate<T>(schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: { message: string } } }) {
  return (data: unknown, file: string): T => {
    const r = schema.safeParse(data);
    if (!r.success) throw new Error(`content/${file} 스키마 오류:\n${r.error.message}`);
    return r.data;
  };
}

// 빌드 때는 한 번만 읽고, 개발 서버에서는 JSON 수정이 바로 보이도록 매번 읽는다
const CACHE = process.env.NODE_ENV === 'production';
let featureCache: Feature[] | null = null;
let releaseCache: Release[] | null = null;

export function getFeatures(): Feature[] {
  if (!CACHE || !featureCache) featureCache = sortByAttention(readDir('features', validate<Feature>(FeatureSchema)));
  return featureCache;
}

export function getFeature(slug: string): Feature | undefined {
  return getFeatures().find((f) => f.slug === slug);
}

/** 최신 버전이 앞에 온다 */
export function getReleases(): Release[] {
  if (!CACHE || !releaseCache) releaseCache = readDir('releases', validate<Release>(ReleaseSchema)).sort((a, b) => b.milestone - a.milestone);
  return releaseCache;
}

export function getRelease(milestone: number): Release | undefined {
  return getReleases().find((r) => r.milestone === milestone);
}

export function getFeaturesFor(milestone: number): Feature[] {
  return getFeatures().filter((f) => f.milestone === milestone);
}

export type Schedule = {
  stable: Release | undefined;
  beta: Release | undefined;
  /** 다음 stable 출시일 (베타 버전의 stable 예정일) */
  nextStableDate: string | undefined;
};

export function getSchedule(): Schedule {
  const rel = getReleases();
  const stable = rel.find((r) => r.status === 'stable');
  const beta = rel.find((r) => r.status === 'beta');
  return { stable, beta, nextStableDate: beta?.stableDate };
}
