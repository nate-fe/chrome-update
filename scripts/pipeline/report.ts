// PR 본문(pipeline-out/pr-body.md)과 워크플로가 읽을 요약(pipeline-out/meta.json)을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, readLog } from './lib.ts';

const log = readLog();
const runUrl = process.env.RUN_URL;
const site = process.env.SITE_URL;

const status = log.changes.filter((c) => c.scope === 'status');
const content = log.changes.filter((c) => c.scope === 'content');
const warnings = log.verify.flatMap((v) => v.warnings.map((w) => `${v.channel} ${v.version.split('.')[0]}: ${w}`));

// 상태·날짜만 바뀌었고 경고가 없으면 사람 검수 없이 병합한다 (기획서 4장 "상태만 바뀌는 경우")
const statusOnly = status.length > 0 && content.length === 0 && log.drafted.length === 0 && warnings.length === 0;
const hasChanges = log.changes.length > 0 || log.drafted.length > 0 || log.skipped.length > 0;

const done = new Set([...log.drafted.map((d) => d.id), ...log.skipped.map((d) => d.id)]);
const remaining = log.candidates.filter((c) => !done.has(c.id));

const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- 없음');

const body = `## Chrome 콘텐츠 자동 업데이트

${statusOnly ? '> 상태·날짜만 바뀐 PR이라 자동 검사 통과 후 자동으로 병합됩니다.' : '> **사람 검수가 필요합니다.** 아래 항목을 확인한 뒤 승인해 주세요. LLM이 쓴 초안은 원문과 대조해 주세요.'}

### 상태 변경
${list(status.map((c) => c.text))}

### 내용 변경 (검수 필요)
${list(content.map((c) => c.text))}

### 새 기능 초안 (${log.drafted.length})
${list(log.drafted.map(({ slug }) => `\`content/features/${slug}.json\`${site ? ` — [미리보기](${site}/features/${slug})` : ''}`))}

### 싣지 않기로 한 기능 (${log.skipped.length})
${list(log.skipped.map((s) => `${s.name} — ${s.reason}`))}

${remaining.length ? `### 아직 정리하지 않은 후보 (${remaining.length})
${list(remaining.map((c) => `${c.milestone} ${c.type}: [${c.name}](https://chromestatus.com/feature/${c.id})`))}
` : ''}
### 실제 Chrome 검사
${log.verify.length ? log.verify.map((v) => `- ${v.channel} ${v.version}: 경고 ${v.warnings.length}건`).join('\n') : '- 실행하지 않음'}

${warnings.length ? `#### 경고\n${list(warnings)}\n` : ''}
<details><summary>검사 상세</summary>

${log.verify.map((v) => `**${v.channel} ${v.version}**\n\n${list(v.lines)}`).join('\n\n')}

</details>

${runUrl ? `미리보기 스크린샷(적용 전/후)은 [워크플로 실행 결과](${runUrl})의 \`preview-screens\` 아티팩트에 있습니다.` : ''}

> 참고: 자동 검사는 새 프로필의 Chrome으로 돌리므로, Google이 서버 설정(Finch)으로 단계적으로 켜는 기능은 실제 사용자 Chrome과 결과가 다를 수 있습니다.
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'pr-body.md'), body);
// 팀룸 알림(notify-pr.ts)이 읽는 요약: 이번에 새로 추가된 버전
const newVersions = content.map((c) => /^Chrome (\d+) 버전 추가/.exec(c.text)?.[1]).filter((m): m is string => Boolean(m)).map(Number);
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ statusOnly, hasChanges, newVersions }, null, 2));
console.log(JSON.stringify({ statusOnly, hasChanges, status: status.length, content: content.length, drafted: log.drafted.length }));
