// 4단계 한국어 초안: 새 기능 후보를 Claude API로 정리해 content/features/*.json 초안을 만든다.
// ANTHROPIC_API_KEY가 없으면 건너뛰고, 후보 목록만 PR 본문에 남긴다.
// 결과는 반드시 사람이 PR에서 검수한다 (기획서 4장 5단계).
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Feature, FeatureTest } from '../../src/lib/schema.ts';
import {
  csUrl,
  currentChannels,
  featureDetail,
  featureExists,
  readFeatures,
  readLog,
  readReleases,
  readState,
  writeFeature,
  writeLog,
  writeRelease,
  writeState,
  type Candidate,
  type CsDetail,
} from './lib.ts';

const MODEL = process.env.DRAFT_MODEL ?? 'claude-opus-5-5';
const MAX_DRAFTS = Number(process.env.MAX_DRAFTS ?? 20);

const log = readLog();
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// ───────── 출력 형식 ─────────

const DraftSchema = z.object({
  include: z.boolean().describe('프론트엔드 개발자가 알아야 할 웹 플랫폼 변경이면 true'),
  skipReason: z.string().describe('include가 false일 때 이유 (한국어 한 문장). true면 빈 문자열'),
  slug: z.string().describe('영문 소문자·숫자·하이픈만. 예: css-random, html-in-canvas'),
  title: z.string().describe('짧은 제목. 코드 이름은 백틱으로 감싼다. 예: CSS `random()`'),
  category: z.enum(['css', 'js', 'deprecation']),
  impact: z.enum(['new', 'changed', 'removed']),
  summaryKo: z.string(),
  whyKo: z.string(),
  exampleLang: z.enum(['css', 'js', 'html']),
  exampleCode: z.string(),
  guideKo: z.string().nullable(),
  featureTest: z.object({
    kind: z.enum(['css', 'media', 'js', 'none']),
    value: z.string().describe('css: CSS.supports에 넣을 선언, media: 미디어 쿼리, js: true/false를 내는 식. none이면 빈 문자열'),
  }),
  preview: z
    .object({ html: z.string(), css: z.string() })
    .nullable()
    .describe('category가 css일 때만. 그 외에는 null'),
  needsCheck: z.array(z.enum(['summaryKo', 'whyKo', 'exampleCode', 'featureTest'])),
});
type Draft = z.infer<typeof DraftSchema>;

const ReleaseTextSchema = z.object({ headlineKo: z.string(), summaryKo: z.string() });

// ───────── 프롬프트 ─────────

const SYSTEM = `당신은 한국 프론트엔드 개발자를 위한 "Chrome 웹 플랫폼 변경사항" 사이트의 편집자다.
ChromeStatus 원문을 읽고 사이트의 기능 항목 초안을 JSON으로 쓴다. 초안은 사람이 검수한 뒤 게시된다.

## 싣는 기준
- 싣는다: 웹 페이지 코드(HTML, CSS, JS, Web API)를 쓰는 개발자가 알아야 할 새 기능, 동작 변경, deprecated·제거.
- 싣지 않는다(include=false): 엔터프라이즈 정책, 확장 프로그램 API, 브라우저 UI, 내부 구현, 특정 OS 전용, 일반 웹 개발자가 거의 쓰지 않는 저수준 API(예: WebTransport 세부 옵션, WebGPU 셰이더 세부 기능, Direct Sockets).

## 쓰는 규칙
- 원문에 근거가 있는 내용만 쓴다. 원문에 없는 메서드 이름, 옵션, 값을 지어내지 않는다. 확실하지 않은 부분은 needsCheck에 그 필드를 넣는다.
- 한국어는 짧고 평이한 평서문(~한다)으로 쓴다. 코드 이름은 백틱으로 감싼다.
- summaryKo: 무엇이 바뀌는지 한 문장.
- whyKo: 개발자에게 왜 중요한지, 예전에는 어떻게 해야 했는지 한두 문장.
- guideKo: 미지원 브라우저 대응이나 기존 코드 대응 방법. 할 말이 없으면 null.
- impact: new = 새 기능이라 기존 코드에 영향 없음, changed = 기존 동작이 바뀜, removed = 기능이 사라지거나 막힘.
- category: css, js(HTML·JS·Web API 포함), deprecation(제거·지원 중단).
- exampleCode: 3~8줄의 최소 예시. 한 줄은 60자 이내. exampleLang과 맞춘다.
- featureTest: 브라우저가 이 기능을 지원하는지 확인하는 식. 기능이 없는 브라우저에서 false, 있는 브라우저에서 true가 되어야 한다. 정확한 식을 만들 수 없으면 kind=none.
- preview(category가 css일 때만): exampleCode를 그대로 적용해 효과가 눈에 보이는 작은 HTML과 바탕 CSS.
  - html은 exampleCode의 선택자와 맞는 요소를 쓴다. <a>에는 href를 넣지 않는다.
  - css는 크기·테두리·색 같은 바탕 스타일만 쓴다. 기능 자체의 선언은 exampleCode가 적용하므로 넣지 않는다.
  - 색은 var(--accent), var(--fg), var(--fg-dim), var(--line), var(--panel)을, 글꼴은 var(--mono), var(--sans)를 쓴다.
  - 전체 높이 120px 이내.

## 이 사이트의 기존 항목 예시
${JSON.stringify(sample('css-random'))}
${JSON.stringify(sample('html-insertion-streaming'))}`;

function sample(slug: string) {
  const f = readFeatures().find((x) => x.slug === slug);
  if (!f) return null;
  const { slug: s, title, category, impact, summaryKo, whyKo, exampleLang, exampleCode, guideKo, featureTest, preview } = f;
  return { slug: s, title, category, impact, summaryKo, whyKo, exampleLang, exampleCode, guideKo, featureTest, preview };
}

function sourceText(c: Candidate, d: CsDetail): string {
  return [
    `마일스톤: Chrome ${c.milestone}`,
    `ChromeStatus 종류: ${c.type}`,
    `이름: ${d.name}`,
    `기능 유형: ${d.feature_type ?? ''}`,
    `Blink 컴포넌트: ${(d.blink_components ?? []).join(', ')}`,
    `호환성을 깨는 변경: ${d.breaking_change ? '예' : '아니오'}`,
    `요약:\n${d.summary}`,
    d.motivation ? `동기:\n${d.motivation}` : '',
    d.spec_link ? `스펙: ${d.spec_link}` : '',
    (d.explainer_links ?? []).length ? `설명 문서: ${d.explainer_links!.join(' ')}` : '',
    (d.sample_links ?? []).length ? `샘플: ${d.sample_links!.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ───────── Claude 호출 ─────────

const client = hasKey ? new Anthropic() : null;

async function ask<T extends z.ZodType>(schema: T, user: string): Promise<z.infer<T> | null> {
  const res = await client!.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도한다
    cache_control: { type: 'ephemeral' },
    system: SYSTEM,
    output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
    messages: [{ role: 'user', content: user }],
  });
  if (res.stop_reason === 'refusal') {
    console.warn(`  거절됨: ${res.stop_details?.category ?? ''}`);
    return null;
  }
  return res.parsed_output ?? null;
}

function toTest(t: Draft['featureTest']): FeatureTest | null {
  if (!t.value.trim()) return null;
  if (t.kind === 'css') return { kind: 'css', decl: t.value };
  if (t.kind === 'media') return { kind: 'media', query: t.value };
  if (t.kind === 'js') return { kind: 'js', expr: t.value };
  return null;
}

function uniqueSlug(raw: string): string {
  const base = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'feature';
  let slug = base;
  for (let i = 2; featureExists(slug); i++) slug = `${base}-${i}`;
  return slug;
}

function toFeature(c: Candidate, d: CsDetail, draft: Draft, stable: number): Feature {
  const status: Feature['status'] =
    c.type === 'Deprecated' ? 'deprecated'
    : c.type === 'Removed' ? 'removed'
    : c.type === 'Origin trial' ? 'origin-trial'
    : c.milestone <= stable ? 'shipped'
    : 'beta';
  const links = [csUrl(c.id), d.spec_link, ...(d.doc_links ?? [])].filter(
    (u): u is string => !!u && URL.canParse(u) && /^https?:/.test(u),
  );
  return {
    slug: uniqueSlug(draft.slug),
    chromestatusId: c.id,
    title: draft.title,
    category: c.type === 'Deprecated' || c.type === 'Removed' ? 'deprecation' : draft.category,
    impact: draft.impact,
    status,
    milestone: c.milestone,
    tags: [],
    history: [
      { milestone: c.milestone, channel: c.milestone <= stable ? 'stable' : 'beta', note: `ChromeStatus: ${c.type}` },
    ],
    summaryKo: draft.summaryKo,
    whyKo: draft.whyKo,
    exampleLang: draft.exampleLang,
    exampleCode: draft.exampleCode,
    guideKo: draft.guideKo,
    support: { firefox: null, safari: null },
    baseline: null,
    featureTest: toTest(draft.featureTest),
    demo: null,
    ...(draft.category === 'css' && draft.preview ? { preview: draft.preview } : {}),
    before: null,
    after: null,
    needsCheck: [...new Set(['support', ...draft.needsCheck])],
    sources: [...new Set(links)],
    review: { by: null, at: null },
  };
}

// ───────── 실행 ─────────

const placeholder = (m: number, status: string) => ({
  // 화면 제목이 "Chrome 158 — <headlineKo>" 형태라 버전 번호는 넣지 않는다
  headlineKo: `${status === 'beta' ? '베타 ' : ''}변경사항 정리 중`,
  summaryKo: '새 기능을 ChromeStatus 기준으로 정리하고 있습니다.',
});

if (!client) {
  console.log('ANTHROPIC_API_KEY가 없어 초안 단계를 건너뜁니다. 후보 목록만 PR에 남깁니다.');
} else {
  const { stable } = await currentChannels();
  const state = readState();
  for (const c of log.candidates.slice(0, MAX_DRAFTS)) {
    console.log(`초안: ${c.milestone} ${c.name}`);
    try {
      const d = await featureDetail(c.id);
      const draft = await ask(DraftSchema, `다음 ChromeStatus 항목의 초안을 써라.\n\n${sourceText(c, d)}`);
      if (!draft) continue; // 다음 실행에서 다시 시도
      if (!draft.include) {
        state.ignored[String(c.id)] = `${c.milestone} 자동 제외: ${c.name} — ${draft.skipReason}`;
        log.skipped.push({ id: c.id, name: c.name, reason: draft.skipReason });
        continue;
      }
      const f = toFeature(c, d, draft, stable);
      writeFeature(f);
      log.drafted.push({ id: c.id, slug: f.slug });
    } catch (e) {
      console.warn(`  실패: ${(e as Error).message}`);
    }
  }
  writeState(state);
}

// 새 버전 머리말: 실린 기능을 바탕으로 쓰고, 쓸 수 없으면 '정리 중' 문구를 넣는다
const features = readFeatures();
for (const r of readReleases()) {
  if (r.headlineKo && !r.headlineKo.endsWith('정리 중')) continue;
  const list = features.filter((f) => f.milestone === r.milestone);
  let text = placeholder(r.milestone, r.status);
  if (client && list.length) {
    const out = await ask(
      ReleaseTextSchema,
      `Chrome ${r.milestone} 버전 페이지의 머리말을 써라. headlineKo는 핵심 두세 가지를 담은 짧은 구절(예: "여백은 잘라내고, 파일은 문자열로"), summaryKo는 주요 변경을 나열하는 한 문장.\n\n` +
        list.map((f) => `- ${f.title}: ${f.summaryKo}`).join('\n'),
    ).catch(() => null);
    if (out) text = out;
  }
  if (text.headlineKo !== r.headlineKo || text.summaryKo !== r.summaryKo) {
    writeRelease({ ...r, ...text });
    if (client && list.length) log.changes.push({ scope: 'content', text: `Chrome ${r.milestone} 머리말 초안 작성` });
  }
}

writeLog(log);
console.log(`초안 ${log.drafted.length}건, 제외 ${log.skipped.length}건`);
