import { z } from 'zod';

export const CategorySchema = z.enum(['css', 'js', 'deprecation']);
export const StatusSchema = z.enum(['shipped', 'beta', 'postponed', 'origin-trial', 'deprecated', 'removed']);
export const ImpactSchema = z.enum(['new', 'changed', 'removed']);
export const LangSchema = z.enum(['css', 'js', 'html']);
export const TagSchema = z.enum(['buff', 'nerf', 'deleted', 'silent']);

const CodeSchema = z.object({ lang: LangSchema, code: z.string().min(1) });

/** 지원 감지 식 (F12). css = CSS.supports(decl), media = matchMedia, js = 식 평가(Promise 가능) */
export const FeatureTestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('css'), decl: z.string() }),
  z.object({ kind: z.literal('media'), query: z.string() }),
  z.object({ kind: z.literal('js'), expr: z.string() }),
]);

const ControlSchema = z.object({
  var: z.string().startsWith('--'),
  label: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number(),
  unit: z.string(),
  value: z.number(),
});

const DemoSourceSchema = z.object({
  html: z.string(),
  css: z.string(),
  js: z.string().optional(),
});

const DemoSchema = DemoSourceSchema.extend({
  hint: z.string().optional(),
  controls: z.array(ControlSchema),
  fallback: DemoSourceSchema.optional(),
});

/**
 * 점검 규칙: 서비스 코드에서 이 기능의 영향을 받는 곳을 찾는 정규식 (scripts/audit/scan.ts)
 * fix = 고쳐야 함(제거·deprecated), check = 동작이 바뀌니 화면·성능 확인
 */
export const ScanRuleSchema = z.object({
  lang: LangSchema,
  pattern: z.string().refine((p) => {
    try {
      new RegExp(p);
      return true;
    } catch {
      return false;
    }
  }, '올바른 정규식이 아님'),
  level: z.enum(['fix', 'check']),
  /** 이 규칙에 걸렸을 때 보여 줄 한 줄 설명 */
  noteKo: z.string(),
});

export const FeatureSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  chromestatusId: z.number().nullable(),
  title: z.string(),
  category: CategorySchema,
  impact: ImpactSchema,
  status: StatusSchema,
  milestone: z.number().int(),
  tags: z.array(TagSchema),
  history: z.array(
    z.object({ milestone: z.number().int(), channel: z.enum(['beta', 'stable', 'mention']), note: z.string() }),
  ),
  summaryKo: z.string(),
  whyKo: z.string(),
  exampleLang: LangSchema,
  exampleCode: z.string(),
  guideKo: z.string().nullable(),
  support: z.object({ firefox: z.string().nullable(), safari: z.string().nullable() }),
  baseline: z.enum(['widely', 'newly', 'limited']).nullable(),
  featureTest: FeatureTestSchema.nullable(),
  demo: DemoSchema.nullable(),
  /** 카드용 미니 미리보기: exampleCode를 그대로 적용할 HTML과 바탕 스타일 */
  preview: z.object({ html: z.string(), css: z.string().default('') }).optional(),
  before: CodeSchema.nullable(),
  after: CodeSchema.nullable(),
  /** 근거가 부족해 '확인 필요'로 표시할 필드 이름 */
  needsCheck: z.array(z.string()),
  /** 서비스 코드 점검 규칙. 제거·동작 변경 기능에만 쓴다 */
  scan: z.array(ScanRuleSchema).optional(),
  sources: z.array(z.url()).min(1),
  review: z.object({ by: z.string().nullable(), at: z.string().nullable() }),
});

export const ReleaseSchema = z.object({
  milestone: z.number().int(),
  status: z.enum(['stable', 'beta']),
  stableDate: z.iso.date(),
  headlineKo: z.string(),
  summaryKo: z.string(),
});

export type Feature = z.infer<typeof FeatureSchema>;
export type Release = z.infer<typeof ReleaseSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Impact = z.infer<typeof ImpactSchema>;
export type Lang = z.infer<typeof LangSchema>;
export type FeatureTest = z.infer<typeof FeatureTestSchema>;
export type Demo = z.infer<typeof DemoSchema>;
export type ScanRule = z.infer<typeof ScanRuleSchema>;
