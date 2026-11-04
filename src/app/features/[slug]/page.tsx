import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LiveDemo } from '@/components/LiveDemo';
import {
  BrowserSupportTable,
  TaggedTitle,
  CodeBlock,
  DiffBlock,
  FeatureBadges,
  Inline,
  Journey,
  NeedsCheck,
  SectionTitle,
} from '@/components/ui';
import { getFeature, getFeatures, getRelease } from '@/lib/content';
import { IMPACT_LABEL, STATUS_LABEL, formatDate, postponedFrom } from '@/lib/labels';

export const dynamicParams = false;

export function generateStaticParams() {
  return getFeatures().map((f) => ({ slug: f.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const f = getFeature(slug);
  return { title: f?.title.replace(/`/g, ''), description: f?.summaryKo.replace(/`/g, '') };
}

function hostLabel(url: string) {
  const u = new URL(url);
  if (u.hostname === 'chromestatus.com') return `ChromeStatus ${u.pathname}`;
  if (u.hostname.endsWith('mozilla.org')) return `MDN 검색: ${u.searchParams.get('q')}`;
  return u.hostname + u.pathname;
}

export default async function FeaturePage({ params }: Props) {
  const { slug } = await params;
  const f = getFeature(slug);
  if (!f) notFound();
  const release = getRelease(f.milestone);
  const from = postponedFrom(f);
  const plain = f.title.replace(/`/g, '');

  return (
    <>
      <div className="tabbar" role="tablist">
        <Link className="tab" href={`/chrome/${f.milestone}`}>
          chrome-{f.milestone}.json
        </Link>
        <span className="tab active" role="tab" aria-selected="true">
          {f.slug}.md
        </span>
      </div>
      <article className="doc">
        <header>
          <p className="comment">
            {`// Chrome ${f.milestone}${release ? ` (${formatDate(release.stableDate)} ${release.status === 'beta' ? 'stable 예정' : 'stable'})` : ''}`}
          </p>
          <h1 className="title">
            <TaggedTitle f={f} />
          </h1>
          <p className="lede">
            <Inline text={f.summaryKo} />
          </p>
          <div className="badges" style={{ marginTop: 12 }}>
            <FeatureBadges f={f} />
            <NeedsCheck fields={f.needsCheck} />
          </div>
        </header>

        {from && (
          <div className="banner warn" role="note">
            <span className="prompt" style={{ color: 'var(--warn)' }}>
              ⏸ postponed
            </span>
            <span className="grow">
              {from} 베타 공지에 있었지만 실제 출시는 {f.milestone}입니다. 출시 버전은 ChromeStatus 마일스톤 기준입니다.
            </span>
          </div>
        )}

        <section className="prose">
          <SectionTitle>왜 중요한가</SectionTitle>
          <p>
            <Inline text={f.whyKo} />
          </p>
        </section>

        {f.demo && (
          <section>
            <SectionTitle aside="sandbox iframe에서 실행">라이브 데모</SectionTitle>
            <LiveDemo demo={f.demo} test={f.featureTest} name={plain} />
          </section>
        )}

        {f.before && f.after && (
          <section>
            <SectionTitle aside="- 예전 방식 / + 이제 방식">Before / After</SectionTitle>
            <DiffBlock before={f.before} after={f.after} />
          </section>
        )}

        <section>
          <SectionTitle aside={f.needsCheck.includes('exampleCode') ? '⚠ 문법 확인 필요' : undefined}>예제 코드</SectionTitle>
          <CodeBlock code={f.exampleCode} lang={f.exampleLang} file={`${f.slug}.${f.exampleLang}`} />
        </section>

        <div className="grid2">
          <section>
            <SectionTitle aside={f.needsCheck.includes('support') ? '⚠ 확인 필요' : 'BCD · web-features'}>
              다른 브라우저 지원
            </SectionTitle>
            <div className="panel">
              <BrowserSupportTable f={f} />
            </div>
          </section>
          <section>
            <SectionTitle>대응 가이드</SectionTitle>
            <div className="panel panel-body prose">
              <p style={{ margin: 0 }}>{f.guideKo ? <Inline text={f.guideKo} /> : <span className="muted">확인 필요</span>}</p>
            </div>
          </section>
        </div>

        <section>
          <SectionTitle aside="베타 공지 → 실제 출시">기능의 여정</SectionTitle>
          <div className="panel panel-body">
            <Journey f={f} />
          </div>
        </section>

        <section>
          <SectionTitle>메타</SectionTitle>
          <dl className="kv">
            <dt>status</dt>
            <dd>{STATUS_LABEL[f.status]}</dd>
            <dt>impact</dt>
            <dd>{IMPACT_LABEL[f.impact]}</dd>
            <dt>milestone</dt>
            <dd className="mono">
              <Link href={`/chrome/${f.milestone}`}>{f.milestone}</Link>
            </dd>
            {f.chromestatusId && (
              <>
                <dt>chromestatus</dt>
                <dd className="mono">{f.chromestatusId}</dd>
              </>
            )}
            <dt>원문 링크</dt>
            <dd>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {f.sources.map((s) => (
                  <li key={s}>
                    <a href={s} rel="noreferrer">
                      {hostLabel(s)}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
            <dt>검수</dt>
            <dd>{f.review.by ? `${f.review.by} · ${f.review.at}` : <span className="muted">검수 전 초안 (LLM 초안 + 사람 검수 예정)</span>}</dd>
          </dl>
        </section>
      </article>
    </>
  );
}
