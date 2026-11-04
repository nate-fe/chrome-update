import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Quiz, type QuizQuestion } from '@/components/Quiz';
import { SupportScore } from '@/components/SupportScore';
import { FeatureList, Inline, SectionTitle } from '@/components/ui';
import { VersionTabs } from '@/components/VersionTabs';
import { getFeatures, getFeaturesFor, getRelease, getReleases } from '@/lib/content';
import { BASELINE_LABEL, TABS, formatDate, tabOf, type TabKey } from '@/lib/labels';
import type { Feature } from '@/lib/schema';

export const dynamicParams = false;

export function generateStaticParams() {
  return getReleases().map((r) => ({ version: String(r.milestone) }));
}

type Props = { params: Promise<{ version: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { version } = await params;
  const r = getRelease(Number(version));
  return { title: `Chrome ${version}`, description: r?.summaryKo.replace(/`/g, '') };
}

const TAB_COLOR: Record<TabKey, string> = {
  css: 'var(--hl-prop)',
  js: 'var(--hl-fn)',
  deprecation: 'var(--del)',
  'origin-trial': 'var(--purple)',
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h >>> 0;
}

/** 버전별 3문제: 이 버전 기능 2개 + 다른 버전 기능 1개 (빌드마다 같은 결과) */
function makeQuiz(version: number, own: Feature[], all: Feature[], milestones: number[]): QuizQuestion[] {
  const pick = (list: Feature[], n: number) =>
    [...list].filter((f) => f.impact === 'new' && f.status !== 'postponed').sort((a, b) => hash(a.slug + version) - hash(b.slug + version)).slice(0, n);
  const chosen = [...pick(own, 2), ...pick(all.filter((f) => f.milestone !== version), 1)];
  const options = [...milestones].sort((a, b) => a - b);
  return chosen.map((f) => ({
    slug: f.slug,
    title: f.title,
    code: f.exampleCode,
    lang: f.exampleLang,
    answer: f.milestone,
    options,
  }));
}

export default async function VersionPage({ params }: Props) {
  const { version } = await params;
  const v = Number(version);
  const release = getRelease(v);
  if (!release) notFound();

  const features = getFeaturesFor(v);
  const releases = getReleases();
  const idx = releases.findIndex((r) => r.milestone === v);
  const older = releases[idx + 1];
  const warn = features.filter((f) => f.category === 'deprecation');
  const baselineCount = features.filter((f) => f.baseline === 'limited').length;

  const quiz = makeQuiz(v, features, getFeatures(), releases.map((r) => r.milestone));

  const tabs = TABS.map((t) => ({
    key: t.key,
    file: t.file,
    count: features.filter((f) => tabOf(f) === t.key).length,
    color: TAB_COLOR[t.key],
  }));
  const panels = Object.fromEntries(
    TABS.map((t) => [
      t.key,
      <FeatureList
        key={t.key}
        features={features.filter((f) => tabOf(f) === t.key)}
        empty={t.key === 'origin-trial' ? '// 이 버전에서 새로 시작된 오리진 트라이얼 없음' : '// 이 버전에는 해당 변경 없음'}
      />,
    ]),
  ) as Record<TabKey, React.ReactNode>;

  const header = (
    <>
      <header>
        <p className="comment">
          {`// chrome-${v}.json · ${release.status === 'beta' ? `beta · ${formatDate(release.stableDate)} stable 예정` : `stable · ${formatDate(release.stableDate)} 출시`}`}
        </p>
        <h1 className="title">
          Chrome {v} — {release.headlineKo}
        </h1>
        <p className="lede">
          <Inline text={release.summaryKo} />
        </p>
        <div className="badges" style={{ marginTop: 12 }}>
          <span className="badge im-new">{features.length}개 변경</span>
          {older && (
            <Link className="badge im-new" href={`/compare?from=${older.milestone}&to=${v}`}>
              {older.milestone}…{v} 비교
            </Link>
          )}
        </div>
      </header>

      {warn.length > 0 && (
        <div className="banner danger" role="note">
          <span className="prompt" style={{ color: 'var(--del)' }}>
            ⚠ breaking
          </span>
          <span className="grow">
            기존 코드에 영향이 있을 수 있는 변경{' '}
            {warn.map((f, i) => (
              <span key={f.slug}>
                {i > 0 && ', '}
                <Link href={`/features/${f.slug}`}>
                  <Inline text={f.title} />
                </Link>
              </span>
            ))}
            . <a href="#deprecation">removed.md 탭</a>에서 대응 방법을 확인하세요.
          </span>
        </div>
      )}
    </>
  );

  const footer = (
    <>
      <div className="grid2">
        <SupportScore
          label={`chrome-${v}`}
          items={features.map((f) => ({ slug: f.slug, title: f.title, test: f.featureTest, milestone: f.status === 'postponed' ? Infinity : f.milestone }))}
        />
        <Quiz questions={quiz} />
      </div>
      <section>
        <SectionTitle>상태</SectionTitle>
        <dl className="kv">
          <dt>milestone</dt>
          <dd className="mono">{v}</dd>
          <dt>channel</dt>
          <dd>{release.status === 'beta' ? '베타 (stable 승격 시 상태가 자동으로 바뀝니다)' : 'stable'}</dd>
          <dt>stable date</dt>
          <dd>{formatDate(release.stableDate)}</dd>
          <dt>Baseline</dt>
          <dd>
            {baselineCount}/{features.length}개가 &lsquo;{BASELINE_LABEL.limited}&rsquo;
          </dd>
          <dt>원문</dt>
          <dd>
            <a href={`https://chromestatus.com/release-notes/${v}`}>ChromeStatus release notes</a> ·{' '}
            <a href={`https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/${v}`}>Edge 릴리스 노트</a>
          </dd>
        </dl>
      </section>
    </>
  );

  return <VersionTabs tabs={tabs} panels={panels} header={header} footer={footer} />;
}
