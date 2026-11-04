// 1단계 감지: 버전 일정, 베타→stable 전환, 출시 연기, 새 기능 후보를 찾는다.
// LLM을 쓰지 않으므로 비용이 들지 않는다.
import {
  LISTED_TYPES,
  currentChannels,
  milestoneFeatures,
  readFeatures,
  readReleases,
  readState,
  stableDate,
  writeFeature,
  writeLog,
  writeRelease,
  type Candidate,
  type Change,
  type CsListed,
} from './lib.ts';

const changes: Change[] = [];
const { stable, beta } = await currentChannels();
console.log(`Chromium Dash: stable ${stable}, beta ${beta}`);

// ───────── 1. 버전(릴리스) 파일 ─────────
const releases = readReleases();
const oldest = releases[0].milestone;
const dates = new Map<number, string>();

for (let m = oldest; m <= beta; m++) {
  const status = m <= stable ? 'stable' : 'beta';
  const date = await stableDate(m);
  dates.set(m, date);
  const r = releases.find((x) => x.milestone === m);
  if (!r) {
    // 머리말은 draft 단계가 채운다. LLM이 없으면 이 문구가 그대로 남는다
    writeRelease({ milestone: m, status, stableDate: date, headlineKo: '', summaryKo: '' });
    changes.push({ scope: 'content', text: `Chrome ${m} 버전 추가 (${status}, stable ${date})` });
  } else if (r.status !== status || r.stableDate !== date) {
    const what = [
      r.status !== status && `${r.status} → ${status}`,
      r.stableDate !== date && `stable 날짜 ${r.stableDate} → ${date}`,
    ]
      .filter(Boolean)
      .join(', ');
    writeRelease({ ...r, status, stableDate: date });
    changes.push({ scope: 'status', text: `Chrome ${m}: ${what}` });
  }
}

// ───────── 2. ChromeStatus 목록 (마일스톤별) ─────────
const listings = new Map<number, Record<string, CsListed[]>>();
for (let m = oldest; m <= beta + 1; m++) listings.set(m, await milestoneFeatures(m));

/** 기능 id가 '실리는 종류'로 올라 있는 마일스톤들 */
function listedAt(id: number): number[] {
  const out: number[] = [];
  for (const [m, byType] of listings) {
    if (LISTED_TYPES.some((t) => byType[t]?.some((f) => f.id === id))) out.push(m);
  }
  return out;
}

// ───────── 3. 사이트 기능 상태 ─────────
for (const f of readFeatures()) {
  let next = f;

  // 출시 버전이 바뀌었는가 (예: 157 → 158로 미뤄짐)
  if (f.chromestatusId && f.status !== 'postponed') {
    const ms = listedAt(f.chromestatusId);
    if (ms.length && !ms.includes(f.milestone)) {
      const later = ms.filter((m) => m > f.milestone);
      if (later.length) {
        const to = Math.min(...later);
        const history = next.history.some((h) => h.milestone === f.milestone && h.channel === 'beta')
          ? next.history
          : [...next.history, { milestone: f.milestone, channel: 'beta' as const, note: `${f.milestone} 출시 예정으로 공지` }];
        next = { ...next, milestone: to, status: to <= stable ? 'shipped' : 'beta', history };
        changes.push({ scope: 'content', text: `${f.slug}: 출시 버전 ${f.milestone} → ${to} (ChromeStatus 목록 기준)` });
      } else {
        changes.push({
          scope: 'content',
          text: `${f.slug}: ChromeStatus 목록에는 ${ms.join(', ')}에 있음 (사이트: ${f.milestone}) — 확인 필요`,
        });
      }
    }
  }

  // 베타였던 버전이 stable이 되면 '출시됨'으로
  if (next.status === 'beta' && next.milestone <= stable) {
    const date = dates.get(next.milestone);
    next = {
      ...next,
      status: 'shipped',
      history: next.history.some((h) => h.milestone === next.milestone && h.channel === 'stable')
        ? next.history
        : [...next.history, { milestone: next.milestone, channel: 'stable', note: `${date ?? ''} stable 출시`.trim() }],
    };
    changes.push({ scope: 'status', text: `${f.slug}: 베타 → 출시됨 (Chrome ${next.milestone} stable)` });
  }

  if (next !== f) writeFeature(next);
}

// ───────── 4. 새 기능 후보 (현재 stable·beta 버전) ─────────
const known = new Set(readFeatures().flatMap((f) => (f.chromestatusId ? [f.chromestatusId] : [])));
const { ignored } = readState();
const candidates: Candidate[] = [];
for (const m of [stable, beta]) {
  const byType = listings.get(m) ?? {};
  for (const type of LISTED_TYPES) {
    for (const f of byType[type] ?? []) {
      if (known.has(f.id) || ignored[String(f.id)] || candidates.some((c) => c.id === f.id)) continue;
      candidates.push({ id: f.id, milestone: m, type, name: f.name.trim() });
    }
  }
}

writeLog({ changes, candidates, drafted: [], skipped: [], verify: [] });
console.log(`변경 ${changes.length}건, 새 기능 후보 ${candidates.length}건`);
for (const c of changes) console.log(` [${c.scope}] ${c.text}`);
for (const c of candidates) console.log(` 후보 ${c.milestone} ${c.type}: ${c.name}`);
