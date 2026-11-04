import { getFeatures, getReleases } from '@/lib/content';
import { STATUS_LABEL } from '@/lib/labels';

export const dynamic = 'force-static';

// 배포 주소가 정해지면 SITE_URL 환경 변수로 지정한다
const SITE = process.env.SITE_URL ?? 'https://chrome-update.example.com';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`/g, '');

export function GET() {
  const releases = getReleases();
  const features = getFeatures();
  const items = [
    ...releases.map((r) => ({
      title: `Chrome ${r.milestone} ${r.status === 'beta' ? '베타' : 'stable'} — ${r.headlineKo}`,
      link: `${SITE}/chrome/${r.milestone}`,
      description: r.summaryKo,
      date: r.stableDate,
    })),
    ...features.map((f) => ({
      title: `[${STATUS_LABEL[f.status]}] ${f.title} (Chrome ${f.milestone})`,
      link: `${SITE}/features/${f.slug}`,
      description: f.summaryKo,
      date: releases.find((r) => r.milestone === f.milestone)?.stableDate ?? '1970-01-01',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Chrome 웹 플랫폼 변경사항</title>
<link>${SITE}</link>
<description>Chrome stable·베타의 CSS, JS/Web API, deprecated·제거 변경사항 (한국어)</description>
<language>ko</language>
${items
  .map(
    (i) => `<item>
<title>${esc(i.title)}</title>
<link>${i.link}</link>
<guid>${i.link}</guid>
<pubDate>${new Date(`${i.date}T00:00:00Z`).toUTCString()}</pubDate>
<description>${esc(i.description)}</description>
</item>`,
  )
  .join('\n')}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
