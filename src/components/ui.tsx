import Link from 'next/link';
import { diffLines, lineCount, tokenize } from '@/lib/code';
import {
  BASELINE_LABEL,
  CATEGORY_LABEL,
  FIELD_LABEL,
  IMPACT_LABEL,
  postponedFrom,
  splitInlineCode,
} from '@/lib/labels';
import type { Feature, Impact, Lang } from '@/lib/schema';
import { MiniPreview } from './MiniPreview';

/** `code` 표기가 섞인 문장을 렌더링 */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((p, i) => (p.code ? <code key={i}>{p.text}</code> : <span key={i}>{p.text}</span>))}
    </>
  );
}

function Highlighted({ code, lang }: { code: string; lang: Lang }) {
  return (
    <>
      {tokenize(code, lang).map((tk, i) =>
        tk.c ? (
          <span key={i} className={`hl-${tk.c}`}>
            {tk.t}
          </span>
        ) : (
          tk.t
        ),
      )}
    </>
  );
}

export function CodeBlock({ code, lang, file, right }: { code: string; lang: Lang; file?: string; right?: React.ReactNode }) {
  return (
    <figure className="code">
      <figcaption className="code-head">
        <span>{file ?? `example.${lang}`}</span>
        <span className="right">{right ?? lang}</span>
      </figcaption>
      <pre>
        <code>
          {code.split('\n').map((line, i) => (
            <span key={i} className="ln" data-n={i + 1}>
              <Highlighted code={line || ' '} lang={lang} />
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

/** F13: Before / After를 diff로 (- 예전, + 지금) */
export function DiffBlock({ before, after }: { before: { code: string; lang: Lang }; after: { code: string; lang: Lang } }) {
  const sameLang = before.lang === after.lang;
  const lines: { op: ' ' | '-' | '+'; text: string; lang: Lang }[] = sameLang
    ? diffLines(before.code, after.code).map((l) => ({ ...l, lang: after.lang }))
    : [
        ...before.code.split('\n').map((text) => ({ op: '-' as const, text, lang: before.lang })),
        ...after.code.split('\n').map((text) => ({ op: '+' as const, text, lang: after.lang })),
      ];
  const b = lineCount(before.code);
  const a = lineCount(after.code);
  const adds = lines.filter((l) => l.op === '+').length;
  const dels = lines.filter((l) => l.op === '-').length;
  return (
    <figure className="code">
      <figcaption className="code-head">
        <span>
          before.{before.lang} → after.{after.lang}
        </span>
        <span className="right diff-stat">
          <span className="a">+{adds}</span> <span className="d">-{dels}</span> ·{' '}
          <strong style={{ color: 'var(--fg)' }}>
            {b}줄 → {a}줄
          </strong>
        </span>
      </figcaption>
      <pre>
        <code>
          {lines.map((l, i) => (
            <span key={i} className={`ln ${l.op === '+' ? 'add' : l.op === '-' ? 'del' : ''}`} data-n={i + 1}>
              <span className="op">{l.op}</span>
              <Highlighted code={l.text || ' '} lang={l.lang} />
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

export function ImpactBadge({ impact }: { impact: Impact }) {
  return <span className={`badge im-${impact}`}>{IMPACT_LABEL[impact]}</span>;
}

/** 제목 앞 말머리: [CSS] [JS · API] [Deprecated · 제거] */
export function CategoryTag({ category }: { category: Feature['category'] }) {
  return <span className={`cat-tag cat-${category}`}>{CATEGORY_LABEL[category]}</span>;
}

/** 말머리 + 제목. 제목이 'CSS …'로 시작하면 말머리와 겹치므로 앞부분을 뺀다 */
export function TaggedTitle({ f }: { f: Feature }) {
  const title = f.category === 'css' ? f.title.replace(/^CSS\s+/, '') : f.title;
  return (
    <>
      <CategoryTag category={f.category} />
      <Inline text={title} />
    </>
  );
}

export function FeatureBadges({ f }: { f: Feature }) {
  const from = postponedFrom(f);
  return (
    <div className="badges">
      {f.status === 'postponed' && (
        <span className="badge st-postponed" title={`Chrome ${f.milestone} 출시 예정이었지만 아직 기본으로 켜지지 않았습니다`}>
          출시 연기 · 아직 기본 비활성
        </span>
      )}
      {from && (
        <span className="badge st-postponed" title={`${from} 베타 공지 → ${f.milestone} 출시`}>
          연기 이력 {from}→{f.milestone}
        </span>
      )}
      <ImpactBadge impact={f.impact} />
    </div>
  );
}

export function NeedsCheck({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <span className="badge check" title="근거가 부족한 필드: 원문 확인 필요">
      확인 필요: {fields.map((f) => FIELD_LABEL[f] ?? f).join(', ')}
    </span>
  );
}

const OP: Record<Impact, { cls: string; sign: string }> = {
  new: { cls: 'op-add', sign: '+' },
  changed: { cls: 'op-mod', sign: '~' },
  removed: { cls: 'op-del', sign: '-' },
};

/** 목록용 기능 카드: diff 한 줄처럼 보인다 */
export function FeatureRow({ f }: { f: Feature }) {
  const op = OP[f.impact];
  return (
    <article className={`frow ${op.cls}`}>
      <span className="op" aria-hidden>
        {op.sign}
      </span>
      <Link className="name" href={`/features/${f.slug}`}>
        <TaggedTitle f={f} />
      </Link>
      <p className="summary">
        <Inline text={f.summaryKo} />
      </p>
      {(f.category === 'css' || f.category === 'js') && f.status !== 'postponed' && (
        <div className="ex">
          <pre className={`mini-code${f.category === 'js' ? ' wide' : ''}`} aria-label="예시 코드">
            <code>
              <Highlighted code={f.exampleCode} lang={f.exampleLang} />
            </code>
          </pre>
          {f.preview && <MiniPreview html={f.preview.html} css={f.preview.css} code={f.exampleCode} test={f.featureTest} milestone={f.milestone} />}
        </div>
      )}
      <div className="meta">
        <FeatureBadges f={f} />
      </div>
    </article>
  );
}

export function FeatureList({ features, empty }: { features: Feature[]; empty?: string }) {
  if (!features.length) return <div className="empty">{empty ?? '// 해당 항목 없음'}</div>;
  return (
    <div className="flist">
      {features.map((f) => (
        <FeatureRow key={f.slug} f={f} />
      ))}
    </div>
  );
}

/** F15: 기능의 여정 */
export function Journey({ f }: { f: Feature }) {
  const steps = [...f.history].sort((a, b) => a.milestone - b.milestone);
  const from = postponedFrom(f);
  // 베타 공지와 실제 출시 사이에 건너뛴 버전을 '연기'로 표시
  const skipped: number[] = [];
  if (from) for (let v = from + 1; v < f.milestone; v++) skipped.push(v);
  const all = [
    ...steps.map((s) => ({ ...s, kind: s.channel as 'beta' | 'stable' | 'mention' | 'skip' })),
    ...skipped
      .filter((v) => !steps.some((s) => s.milestone === v))
      .map((v) => ({ milestone: v, channel: 'beta' as const, note: '이 버전에서는 나오지 않음 (연기)', kind: 'skip' as const })),
  ].sort((a, b) => a.milestone - b.milestone || (a.kind === 'beta' ? -1 : 1));
  return (
    <div className="journey">
      {all.map((s, i) => (
        <div key={i} className={`jstep ${s.kind}`}>
          <div className="node" />
          <div className="v">
            {s.kind === 'beta'
              ? `${s.milestone} 베타 공지`
              : s.kind === 'mention'
                ? `${s.milestone} 소개`
                : s.kind === 'skip'
                  ? `${s.milestone} ⏸`
                  : `${s.milestone} stable`}
          </div>
          <div className="n">{s.note}</div>
        </div>
      ))}
    </div>
  );
}

export function BrowserSupportTable({ f }: { f: Feature }) {
  return (
    <table className="t">
      <thead>
        <tr>
          <th>브라우저</th>
          <th>지원 버전</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Chrome · Edge</td>
          <td className="mono">{f.milestone}</td>
        </tr>
        <tr>
          <td>Firefox</td>
          <td className="mono">{f.support.firefox ?? <span className="muted">미지원 / 확인 필요</span>}</td>
        </tr>
        <tr>
          <td>Safari</td>
          <td className="mono">{f.support.safari ?? <span className="muted">미지원 / 확인 필요</span>}</td>
        </tr>
        <tr>
          <td>Baseline</td>
          <td>{f.baseline ? BASELINE_LABEL[f.baseline] : <span className="muted">해당 없음</span>}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <h2 className="section-title">
      {children}
      {aside && <span className="aside">{aside}</span>}
    </h2>
  );
}
