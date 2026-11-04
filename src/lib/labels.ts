import type { Category, Feature, Impact, Status } from './schema';

export const STATUS_LABEL: Record<Status, string> = {
  shipped: '출시됨',
  beta: '곧 나옴',
  postponed: '연기됨',
  'origin-trial': '오리진 트라이얼',
  deprecated: 'Deprecated',
  removed: '제거됨',
};

export const IMPACT_LABEL: Record<Impact, string> = {
  new: '신규 · 안전',
  changed: '동작 변경 · 확인 필요',
  removed: '제거 · 대응 필수',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  css: 'CSS',
  js: 'JS · API',
  deprecation: 'Deprecated · 제거',
};

export const BASELINE_LABEL = {
  widely: '널리 사용 가능',
  newly: '새로 사용 가능',
  limited: '제한적',
} as const;

export const FIELD_LABEL: Record<string, string> = {
  exampleCode: '예제 코드',
  support: '다른 브라우저 지원',
  featureTest: '지원 감지 식',
  whyKo: '왜 중요한가',
  summaryKo: '한 줄 요약',
  milestone: '출시 버전',
};

/** 버전 페이지 탭 = 에디터 파일 탭 */
export type TabKey = Category | 'origin-trial';
export const TABS: { key: TabKey; file: string; label: string }[] = [
  { key: 'css', file: 'css.diff', label: 'CSS' },
  { key: 'js', file: 'js.diff', label: 'JS · API' },
  { key: 'deprecation', file: 'removed.md', label: 'Deprecated · 제거' },
  { key: 'origin-trial', file: 'origin-trial.md', label: '오리진 트라이얼' },
];

export function tabOf(f: Feature): TabKey {
  return f.status === 'origin-trial' ? 'origin-trial' : f.category;
}

/** 연기 이력: 베타 공지 버전과 실제 출시 버전이 다른가 (F4) */
export function postponedFrom(f: Feature): number | null {
  const beta = f.history.find((h) => h.channel === 'beta');
  return beta && beta.milestone < f.milestone ? beta.milestone : null;
}

const IMPACT_RANK: Record<Impact, number> = { removed: 0, changed: 1, new: 2 };

/** F3: 기존 코드가 깨질 수 있는 변경을 맨 위로 */
export function sortByAttention(list: Feature[]): Feature[] {
  return [...list].sort(
    (a, b) =>
      (a.category === 'deprecation' ? 0 : 1) - (b.category === 'deprecation' ? 0 : 1) ||
      IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] ||
      b.milestone - a.milestone ||
      a.slug.localeCompare(b.slug),
  );
}

export function needsAttention(f: Feature): boolean {
  return f.category === 'deprecation' || f.impact !== 'new';
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

/** `code` 표기를 <code>로 바꾸기 위한 분할 */
export function splitInlineCode(text: string): { code: boolean; text: string }[] {
  return text.split(/(`[^`]+`)/g).filter(Boolean).map((t) =>
    t.startsWith('`') && t.endsWith('`') ? { code: true, text: t.slice(1, -1) } : { code: false, text: t },
  );
}
