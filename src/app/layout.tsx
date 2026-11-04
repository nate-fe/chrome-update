import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BrowserChip,
  Countdown,
  Crumb,
  ScrollReset,
  SidebarNav,
  ThemeToggle,
  type NavGroup,
} from '@/components/ShellClient';
import { THEME_BOOT } from '@/lib/code';
import { getFeatures, getReleases, getSchedule } from '@/lib/content';
import { shortDate } from '@/lib/labels';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Chrome 웹 플랫폼 변경사항', template: '%s · Chrome 변경사항' },
  description: 'Chrome stable·베타의 CSS, JS/Web API, deprecated·제거 변경사항을 한국어로 정리합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const releases = getReleases();
  const features = getFeatures();
  const { stable, beta, nextStableDate } = getSchedule();

  const groups: NavGroup[] = [
    { title: 'Explorer', items: [{ href: '/', label: 'README', ext: '.md' }] },
    {
      title: 'releases/',
      items: releases.map((r) => ({
        href: `/chrome/${r.milestone}`,
        label: `chrome-${r.milestone}`,
        ext: '.json',
        pill: (
          <span className={`badge ${r.status === 'beta' ? 'st-beta' : 'st-shipped'}`} style={{ height: 18 }}>
            {r.status}
          </span>
        ),
      })),
    },
    {
      title: 'tools/',
      items: [
        { href: '/features', label: 'search', ext: '.ts', pill: <span className="muted">{features.length}</span> },
        { href: '/compare', label: 'compare', ext: '.diff' },
      ],
    },
  ];

  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <div className="ide">
          <header className="titlebar">
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <Link href="/" className="brand">
              chrome-update
            </Link>
            <Crumb />
            <span className="spacer" />
            <BrowserChip
              stable={stable?.milestone ?? releases[releases.length - 1].milestone}
              beta={beta?.milestone}
              oldest={releases[releases.length - 1].milestone}
              latest={releases[0].milestone}
            />
            <ThemeToggle />
          </header>
          <SidebarNav groups={groups} />
          <main className="main" id="main" tabIndex={-1}>
            <ScrollReset />
            {children}
            <footer className="footer">
              <div>
                데이터 출처: <a href="https://chromestatus.com/roadmap">ChromeStatus</a> ·{' '}
                <a href="https://github.com/mdn/browser-compat-data">MDN browser-compat-data</a> ·{' '}
                <a href="https://github.com/web-platform-dx/web-features">web-features</a> ·{' '}
                <a href="https://chromiumdash.appspot.com/schedule">Chromium Dash</a>
              </div>
            </footer>
          </main>
          <footer className="statusbar" aria-label="상태 표시줄">
            <span className="seg">⎇ stable {stable?.milestone ?? '-'}</span>
            {beta && (
              <Link className="seg" href={`/chrome/${beta.milestone}`}>
                β {beta.milestone}
              </Link>
            )}
            {nextStableDate && (
              <span className="seg">
                다음 출시 {shortDate(nextStableDate)} (<Countdown date={nextStableDate} />)
              </span>
            )}
            <span className="right hide-sm">UTF-8 · ko</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
