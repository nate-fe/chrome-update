'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FeatureTest } from './schema';

// ───────── 지원 감지 (F12) ─────────

export type SupportState = 'pending' | 'yes' | 'no' | 'unknown';

const testCache = new Map<string, Promise<boolean | null>>();

export function runFeatureTest(test: FeatureTest): Promise<boolean | null> {
  const key = JSON.stringify(test);
  let p = testCache.get(key);
  if (!p) {
    p = (async () => {
      try {
        if (test.kind === 'css') return CSS.supports(test.decl);
        if (test.kind === 'media') {
          // 최신 브라우저는 모르는 미디어 기능도 'not all'로 바꾸지 않는다.
          // 아는 기능이면 (X)와 not (X) 중 정확히 하나가 맞고, 모르는 기능이면 둘 다 안 맞는다.
          return window.matchMedia(test.query).matches !== window.matchMedia(`not ${test.query}`).matches;
        }
        // 검수를 거친 콘텐츠 데이터의 감지 식만 평가한다
        const result = await new Function(`return (${test.expr});`)();
        return Boolean(result);
      } catch {
        return false;
      }
    })();
    testCache.set(key, p);
  }
  return p;
}

export function useSupport(test: FeatureTest | null): SupportState {
  const [state, setState] = useState<SupportState>(test ? 'pending' : 'unknown');
  useEffect(() => {
    if (!test) return;
    let alive = true;
    runFeatureTest(test).then((r) => alive && setState(r === null ? 'unknown' : r ? 'yes' : 'no'));
    return () => {
      alive = false;
    };
  }, [test]);
  return state;
}

// ───────── 내 브라우저 버전 (F5) ─────────

export type BrowserInfo = { ready: boolean; chromium: boolean; version: number | null; name: string };

type Brand = { brand: string; version: string };
type UAData = {
  brands?: Brand[];
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ fullVersionList?: Brand[]; platformVersion?: string }>;
};

const uaData = () => (navigator as Navigator & { userAgentData?: UAData }).userAgentData;

const BRAND_NAME: Record<string, string> = {
  'Google Chrome': 'Chrome',
  'Microsoft Edge': 'Edge',
  Opera: 'Opera',
  Brave: 'Brave',
  'Samsung Internet': 'Samsung Internet',
  Whale: 'Whale',
};

/** "Not A;Brand" 같은 가짜 브랜드와 Chromium을 뺀 실제 제품 브랜드 */
function productBrand(brands: Brand[] | undefined): Brand | undefined {
  return brands?.find((b) => b.brand !== 'Chromium' && !/not.?a.?brand/i.test(b.brand));
}

function detect(): BrowserInfo {
  const uad = uaData();
  const brand = uad?.brands?.find((b) => b.brand === 'Chromium');
  const ua = navigator.userAgent;
  const product = productBrand(uad?.brands);
  const name = product
    ? (BRAND_NAME[product.brand] ?? product.brand)
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Whale\//.test(ua)
          ? 'Whale'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : 'Chromium';
  if (brand) return { ready: true, chromium: true, version: Number(brand.version), name };
  const m = ua.match(/Chrom(?:e|ium)\/(\d+)/);
  if (m) return { ready: true, chromium: true, version: Number(m[1]), name };
  const other = /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '알 수 없는 브라우저';
  return { ready: true, chromium: false, version: null, name: other };
}

const SERVER_BROWSER: BrowserInfo = { ready: false, chromium: false, version: null, name: '' };
let browserSnapshot: BrowserInfo | null = null;

export function useBrowser(): BrowserInfo {
  return useSyncExternalStore(
    () => () => {},
    () => (browserSnapshot ??= detect()),
    () => SERVER_BROWSER,
  );
}

// ───────── 판정: 감지 결과 + 내 버전 ─────────

/**
 * included 내 버전이 출시 버전 이상 → 지원 표시를 아예 하지 않는다
 * yes      내 버전보다 새 기능인데 감지 성공 (플래그 등으로 미리 켜진 경우)
 * no       내 버전보다 새 기능이고 감지 실패 (아직 미지원)
 * unknown  감지 식이 없고 버전으로도 판단 불가
 */
export type Verdict = 'pending' | 'included' | 'yes' | 'no' | 'unknown';

export function verdictOf(detected: boolean | null | undefined, hasTest: boolean, b: BrowserInfo, milestone: number): Verdict {
  if (!b.ready) return 'pending';
  if (b.chromium && b.version !== null && b.version >= milestone) return 'included';
  if (!hasTest || detected === null) return 'unknown';
  if (detected === undefined) return 'pending';
  return detected ? 'yes' : 'no';
}

export function useVerdict(test: FeatureTest | null, milestone: number): Verdict {
  const raw = useSupport(test);
  const b = useBrowser();
  const detected = raw === 'pending' ? undefined : raw === 'unknown' ? null : raw === 'yes';
  return verdictOf(detected, !!test, b, milestone);
}

export type BrowserDetail = { fullVersion: string | null; platform: string | null };

let detailPromise: Promise<BrowserDetail> | null = null;

/** Windows는 platformVersion이 내부 번호(예: 19.0.0)라 익숙한 이름으로 바꾼다 */
function platformLabel(platform: string, version?: string): string {
  if (!version) return platform;
  if (platform === 'Windows') {
    const major = Number(version.split('.')[0]);
    if (major >= 13) return 'Windows 11';
    if (major > 0) return 'Windows 10';
    return 'Windows';
  }
  return `${platform} ${version}`;
}

/**
 * 전체 버전(예: 152.0.7212.84). UA 문자열은 개인정보 보호로 "152.0.0.0"까지만 주므로
 * Chromium 전용 User-Agent Client Hints API로 따로 요청한다. 지원하지 않으면 null.
 */
export function useBrowserDetail(): BrowserDetail | null {
  const [detail, setDetail] = useState<BrowserDetail | null>(null);
  useEffect(() => {
    const uad = uaData();
    detailPromise ??= (async () => {
      try {
        const hi = await uad?.getHighEntropyValues?.(['fullVersionList', 'platformVersion']);
        const list = hi?.fullVersionList;
        const full = productBrand(list)?.version ?? list?.find((b) => b.brand === 'Chromium')?.version ?? null;
        const platform = uad?.platform ? platformLabel(uad.platform, hi?.platformVersion) : null;
        return { fullVersion: full, platform };
      } catch {
        return { fullVersion: null, platform: uad?.platform ?? null };
      }
    })();
    let alive = true;
    detailPromise.then((d) => alive && setDetail(d));
    return () => {
      alive = false;
    };
  }, []);
  return detail;
}

// ───────── 테마 (다크 기본, 밝은 에디터 테마 선택) ─────────

export type Theme = 'dark' | 'light';
const THEME_KEY = 'cu-theme';
const themeListeners = new Set<() => void>();

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* 저장 불가 환경은 무시 */
  }
  themeListeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => themeListeners.delete(cb);
    },
    readTheme,
    () => 'dark',
  );
}
