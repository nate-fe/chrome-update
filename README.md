# chrome-update

Chrome이 버전마다 바꾸는 웹 기능(CSS, JS·Web API, 제거·지원 중단)을 **한국어로 정리하는 사이트**입니다.
여기서 정리한 내용으로 **네이트 서비스 코드에 고칠 곳이 있는지도 점검**합니다.

Next.js 16 · TypeScript · GitHub Pages. 처음 설계는 `Chrome 웹 플랫폼 변경사항 자동 안내 페이지 기획서.md`에 있습니다.

## 두 저장소가 하는 일

| | 이 저장소 `chrome-update` (공개) | `chrome-update-audit` (비공개) |
|---|---|---|
| 하는 일 | Chrome 변경사항을 정리해 사이트로 보여 준다 | 네이트 메인·뉴스·판의 CSS·JS에서 바뀐 기능을 쓰는 곳을 찾는다 |
| 매일 자동 실행 | 09:02 — 새 버전·상태 변화 감지 → PR | 평일 09:30 — 네이트 파일 점검 → 팀룸·현황 시트 |
| 가진 것 | 사이트, 기능 정리(JSON), **점검 규칙**, 점검 도구 | 점검할 파일 목록, 지난 결과, 실행 설정 |
| 결과를 보는 곳 | 사이트 | 네이트온 팀룸, 현황 시트(Google 스프레드시트) |

점검 결과와 대상 파일 목록은 비공개 저장소에만 둡니다. 이 공개 저장소에는 올리지 않습니다.

### 둘을 잇는 것: 점검 규칙

```
Chrome 새 버전 ─▶ [공개] 기능 정리 + 점검 규칙(scan) 작성 ─▶ main 병합
                                                               │
                         다음 점검 때 최신 main의 규칙을 받아 씀 ◀┘
                                       │
                 [비공개] 네이트 CSS·JS 검사 ─▶ 팀룸 알림 · 현황 시트
```

- 없어지거나 동작이 바뀌는 기능을 정리할 때, 그 기능을 쓰는 코드를 찾는 정규식(`scan`)을 함께 씁니다.
- 비공개 저장소는 점검할 때마다 이 저장소의 `main`을 받아 **지금까지 정리된 규칙 전부**로 네이트 코드를 검사합니다.
- 그래서 새 버전 정리가 병합되면, 다음 날 아침 점검부터 새 규칙이 적용됩니다.

## 언제 무엇을 하면 되나요

| 이런 일이 생기면 | 할 일 |
|---|---|
| 팀룸에 **`[Chrome 변경 정리]` Chrome 159 버전이 나와…** | 새 버전 PR이 열린 것. [새 버전 검수](#새-버전이-나오면)를 하고 병합 |
| 팀룸에 **`[Chrome 변경 점검]` … 수정 필요** | 네이트 코드에 고칠 곳이 생긴 것. Claude 제안을 확인하고 서비스 코드를 고쳐 배포. 현황 시트에 담당자·상태를 적는다 |
| 팀룸에 **`[Chrome 변경 점검]` 점검 실패** | 대부분 배포로 파일 이름이 바뀐 것. 비공개 저장소의 `files.json`을 새로 뽑아 고친다 |
| 아무 알림도 없음 | 할 일 없음. 상태만 바뀐 PR은 자동으로 병합·배포된다 |

네이트 코드를 고칠 때 이 두 저장소에 PR을 낼 일은 없습니다. 고친 코드가 배포되면 다음 점검에서 자동으로 해결로 바뀝니다.

## 사이트 자동 업데이트

GitHub Actions(**콘텐츠 자동 업데이트**)가 매일 09:02(한국 시간)쯤 돕니다.

1. **감지:** 새 버전, 베타 → stable 전환, 출시 연기를 찾는다.
2. **초안:** 새 기능 후보가 있으면 Claude가 ChromeStatus 원문을 읽고 초안을 쓴다.
   - 실을지 뺄지 판단, 한국어 설명, 예시 코드, 지원 감지 식, 미리보기, 점검 규칙(`scan`), 버전 머리말
3. **검사:** 실제 Chrome으로 지원 감지 식과 미리보기를 확인한다.
4. **PR:** 결과를 `content/auto-update` 브랜치 PR로 올린다.

PR은 두 종류입니다.

| PR | 병합 | 팀룸 알림 |
|---|---|---|
| 상태만 바뀜 (베타 → stable, 날짜 변경) | 자동 병합·배포 | 없음 |
| 새 버전이 들어감 | **사람이 검수하고 병합** | `[Chrome 변경 정리]` 두 줄 |

- 새 버전 PR이 열려 있는 동안은 PR을 덮어쓰지 않도록 자동 실행이 쉽니다. 오래 열어 두지 마세요.
- 초안은 **구독 토큰**으로 씁니다 (Claude Code Action + `CLAUDE_CODE_OAUTH_TOKEN`). API 요금은 들지 않고 구독 사용량에서 차감됩니다. 한 번에 최대 15개 후보, 도구 없이 한 번에 답하게 해 사용량을 줄였습니다 (`scripts/pipeline/draft.ts`).
- 토큰이 없거나 초안 단계가 실패하면 초안 없이 후보 목록만 PR에 남습니다.

## 새 버전이 나오면

자동 PR에는 초안이 이미 들어 있습니다. 이 프로젝트를 Claude Code로 열고 이렇게 말합니다.

```
159 검수해줘
```

Claude Code가 `CLAUDE.md`의 절차대로 초안을 원문과 대조해 고치고, 결과를 표로 보고한 뒤 커밋할지 묻습니다. 확인하고 GitHub에서 PR을 **Merge**하면 사이트가 배포되고, 다음 날 네이트 점검에 새 규칙이 들어갑니다. 초안이 없는 PR이면 `159 정리해줘`라고 하면 처음부터 정리합니다.

**검수할 때 꼭 볼 것**

- AI 초안이라 원문에 없는 이름·옵션이 섞일 수 있습니다. `needsCheck`에 적힌 필드를 먼저 확인합니다.
- `scan` 규칙이 너무 넓으면 팀룸에 엉뚱한 "수정 필요"가 오고, 너무 좁으면 고칠 곳을 놓칩니다.
- `featureTest`(js 식)와 `preview.html`은 방문자 브라우저에서 그대로 실행됩니다. `<script>`, `on...=` 속성, `javascript:` 주소가 없는지 확인합니다.

직접 고칠 때는 PR 본문의 "아직 정리하지 않은 후보"마다 하나를 고릅니다.

- **싣는다:** `content/features/<slug>.json` 작성. `chromestatusId`를 꼭 넣는다.
- **뺀다:** `content/pipeline-state.json`의 `ignored`에 `"<ID>": "<이유>"` 추가.

그다음 `content/releases/<버전>.json`의 머리말을 쓰고 `npm run build`가 통과하면 병합합니다.

## 네이트 서비스 점검

자세한 설정과 흐름은 비공개 저장소 `chrome-update-audit`의 README에 있습니다. 여기에는 이 저장소에 있는 도구만 적습니다.

**PV·광고·통계에 잡히지 않게 합니다.** 페이지를 열지 않고, 목록에 적힌 CSS·JS 파일만 받아 글자로 검사합니다. 스크립트는 실행하지 않습니다.

| 파일 | 하는 일 |
|---|---|
| `scripts/audit/scan.ts` | 파일을 받아 규칙으로 검사 → `result.json`, `report.html` |
| `scripts/audit/legacy-rules.json` | 이 사이트가 다루기 전부터 Chrome이 경고하던 기능 규칙 (동기 XHR, unload 이벤트, `document.domain`, Mutation Events) |
| `scripts/audit/notify.ts` | 지난 결과와 비교해 바뀐 게 있으면 팀룸 알림 |
| `scripts/audit/fixes.ts` | Claude에게 고칠 곳의 해결 방법을 묻고 쌓기 |
| `scripts/audit/sheet.ts` | 현황 시트(Google 스프레드시트) 갱신 |

- 규칙은 기능 JSON의 `scan`과 `legacy-rules.json` 두 곳에서 옵니다. 주석 안의 코드는 검사하지 않습니다.
- 찾은 곳은 **고쳐야 함**(제거·deprecated)과 **확인 필요**(동작이 바뀌니 화면 확인)로 나뉩니다. 팀룸에는 "고쳐야 함"만 보내고, 둘 다 현황 시트에 올립니다.
- 사이트 왼쪽 위 **NATE 서비스 현황 시트** 링크로 현황 시트를 엽니다. 권한이 있는 회사 계정만 볼 수 있습니다.
- 글자로만 찾기 때문에 실행할 때만 드러나는 문제는 놓칠 수 있습니다.

직접 돌려 볼 때:

```bash
node scripts/audit/scan.ts --files ../chrome-update-audit/files.json --out ../chrome-update-audit/audit-out
node scripts/audit/scan.ts ../my-service/src      # 소스 폴더 검사
```

- 옵션: `--own nate.com,nateimg.co.kr`(우리 도메인. 나머지는 외부 파일로 분류), `--out 폴더`(기본 `audit-out/`)
- `scan.ts`에 페이지 주소를 주면 Playwright로 페이지를 열어 검사하지만, **실제 방문이라 PV·광고·통계에 잡힙니다.** 서비스 점검에는 쓰지 않습니다.
- 결과 폴더(`audit-out/`)는 이 저장소에 커밋하지 않습니다.

## 처음 한 번 설정 (이 저장소)

1. Settings → Pages → Source를 **GitHub Actions**로 바꾼다.
2. Settings → Actions → General에서 **Allow GitHub Actions to create and approve pull requests**를 켠다.
3. Settings → Secrets and variables → Actions에 아래 값을 넣는다.

   | 이름 | 값 | 없으면 |
   |---|---|---|
   | `TEAMROOM_WEBHOOK_URL` | 네이트온 팀룸 인커밍 웹훅 주소 | 새 버전 PR 알림만 빠짐 |
   | `CLAUDE_CODE_OAUTH_TOKEN` | Claude 구독(Pro/Max) 계정 PC에서 `claude setup-token`으로 만든 토큰. 비공개 저장소와 같은 값을 써도 된다 | 초안 없이 후보 목록만 PR에 남음 |

4. Actions → **콘텐츠 자동 업데이트** → **Run workflow**로 첫 실행을 한다.

## 개발

Node 24 이상이 필요합니다.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # out/ 에 정적 사이트 생성 (콘텐츠 형식 검사 포함)
```

| 경로 | 내용 |
|---|---|
| `content/releases/<버전>.json` | 버전 정보 (stable 날짜, beta/stable, 머리말) |
| `content/features/<slug>.json` | 기능 정리와 점검 규칙 (형식: `src/lib/schema.ts`) |
| `content/pipeline-state.json` | 싣지 않기로 한 ChromeStatus 기능과 이유 |
| `scripts/pipeline/` | 사이트 자동 업데이트 (감지 · 초안 · 검사 · PR 본문 · 팀룸 알림) |
| `scripts/audit/` | 네이트 서비스 점검 도구 |
