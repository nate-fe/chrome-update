// 새 Chrome 버전이 들어간 콘텐츠 PR이 열리면 네이트온 팀룸으로 짧게 알린다.
// 새 버전이 없는 PR(상태만 바뀐 PR, 출시 버전 변경 등)은 알리지 않는다.
// 워크플로가 'PR이 새로 열렸을 때'만 이 스크립트를 부른다.
//
// 실행: node scripts/pipeline/notify-pr.ts [--dry-run]
// 읽는 것: pipeline-out/meta.json (report.ts가 만든다)
// 환경 변수: TEAMROOM_WEBHOOK_URL
import fs from 'node:fs';
import path from 'node:path';
import { sendTeamroom } from '../audit/teamroom.ts';
import { OUT } from './lib.ts';

const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8')) as { newVersions?: number[] };
const versions = meta.newVersions ?? [];

if (versions.length === 0) {
  console.log('새 버전이 없는 PR이라 팀룸에 알리지 않음');
  process.exit(0);
}

const text = `[Chrome 변경 정리]\nChrome ${versions.join(', ')} 버전이 나와 정리가 필요합니다.`;
console.log(text);
if (!process.argv.includes('--dry-run')) await sendTeamroom(text);
