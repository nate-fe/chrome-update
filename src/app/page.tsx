import Link from 'next/link';
import { BrowserBanner } from '@/components/BrowserBanner';
import { Countdown } from '@/components/ShellClient';
import { FeatureList, Inline, SectionTitle } from '@/components/ui';
import { getFeatures, getFeaturesFor, getReleases, getSchedule } from '@/lib/content';
import { formatDate, needsAttention } from '@/lib/labels';

export default function Home() {
  const features = getFeatures();
  const releases = getReleases();
  const { stable, beta, nextStableDate } = getSchedule();
  const recent = releases.slice(0, 2);
  const attention = features.filter(needsAttention);
  const latest = releases[0].milestone;
  const oldest = releases[releases.length - 1].milestone;

  return (
    <>
      <div className="tabbar" role="tablist">
        <span className="tab active" role="tab" aria-selected="true">
          README.md
        </span>
      </div>
      <div className="doc">
        <header>
          <h1 className="title">Chrome 웹 플랫폼 변경사항</h1>
        </header>

        <div className="grid3">
          <div className="stat-card">
            <div className="k">stable</div>
            <div className="v">
              {stable ? <Link href={`/chrome/${stable.milestone}`}>{stable.milestone}</Link> : '-'}
            </div>
            <div className="s">{stable && `${formatDate(stable.stableDate)} 출시`}</div>
          </div>
          <div className="stat-card">
            <div className="k">beta</div>
            <div className="v">{beta ? <Link href={`/chrome/${beta.milestone}`}>{beta.milestone}</Link> : '-'}</div>
            <div className="s">{beta ? `${getFeaturesFor(beta.milestone).length}개 변경 예정` : '진행 중인 베타 없음'}</div>
          </div>
          <div className="stat-card">
            <div className="k">next stable</div>
            <div className="v" style={{ color: 'var(--accent)' }}>
              {nextStableDate ? <Countdown date={nextStableDate} /> : '-'}
            </div>
            <div className="s">{nextStableDate && formatDate(nextStableDate)}</div>
          </div>
        </div>

        <BrowserBanner
          features={features
            .filter((f) => f.status !== 'postponed')
            .map((f) => ({ slug: f.slug, milestone: f.milestone, category: f.category }))}
          latest={latest}
          oldest={oldest}
        />

        <section>
          <SectionTitle aside={`${attention.length}개 · 기존 코드가 깨질 수 있는 변경 우선`}>주의가 필요한 변경</SectionTitle>
          <FeatureList features={attention} />
        </section>

        {recent.map((r) => {
          const list = getFeaturesFor(r.milestone).filter((f) => !needsAttention(f));
          return (
            <section key={r.milestone}>
              <SectionTitle
                aside={
                  <Link href={`/chrome/${r.milestone}`}>
                    chrome-{r.milestone} 전체 보기 →
                  </Link>
                }
              >
                Chrome {r.milestone} {r.status === 'beta' ? '베타' : 'stable'} · {r.headlineKo}
              </SectionTitle>
              <p className="muted" style={{ margin: '-4px 0 12px' }}>
                <Inline text={r.summaryKo} />
              </p>
              <FeatureList features={list} />
            </section>
          );
        })}
      </div>
    </>
  );
}
