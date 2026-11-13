# chrome-update 작업 안내

Chrome 웹 플랫폼 변경사항을 한국어로 정리하는 Next.js 정적 사이트. 사용자와는 한국어로 대화한다.
구조와 자동화는 README.md를 본다. 이 파일은 Claude Code가 반복 작업을 같은 기준으로 하기 위한 안내다.

## 운영 방식

- Claude API 키 없이 운영한다 (비용 때문). `ANTHROPIC_API_KEY`를 쓰지 않는다.
- GitHub Actions가 매일 새 버전·상태 변경을 감지해 `content/auto-update` 브랜치로 PR을 연다. 새 기능 후보가 있으면 구독 토큰(`CLAUDE_CODE_OAUTH_TOKEN`)으로 Claude Code Action이 초안을 쓴다 (`scripts/pipeline/draft.ts input`/`apply`). 초안은 사람이(= Claude Code와 함께) 검수한 뒤 병합한다.
- 저장소: `nate-fe/chrome-update`. 커밋·푸시·PR 병합은 사용자가 요청할 때만 한다.

## "새 버전 정리해줘" / "158 정리해줘" / "158 검수해줘" 요청을 받으면

자동 PR에 Claude 초안이 이미 있으면(PR 본문 "새 기능 초안", "싣지 않기로 한 기능") 처음부터 쓰지 않고 **검수**한다: 초안마다 3번처럼 원문을 읽어 아래 기준·규칙과 대조해 고치고, `pipeline-state.json`의 "자동 제외" 판단도 확인한다. 남은 후보만 새로 정리한다.

1. **작업 브랜치 정하기**: `git fetch` 후 `origin/content/auto-update` 브랜치가 있으면(= 자동 PR이 열려 있으면) 그 브랜치에서 작업한다. 없으면 `node scripts/pipeline/detect.ts`를 돌려 새 버전·상태 변경을 먼저 반영한다.
2. **후보 목록**: `node scripts/pipeline/detect.ts` 출력의 "후보" 줄, 또는 자동 PR 본문의 "아직 정리하지 않은 후보"가 대상이다.
3. **원문 읽기**: 후보마다 `https://chromestatus.com/api/v0/features/<id>`를 읽는다 (응답 앞의 `)]}'` 4글자를 떼고 JSON 파싱). `summary`, `motivation`, `spec_link`, `explainer_links`, `sample_links`를 근거로 쓴다.
4. **싣기 / 빼기 판단** (아래 기준)
   - 싣는다 → `content/features/<slug>.json` 작성
   - 뺀다 → `content/pipeline-state.json`의 `ignored`에 `"<id>": "<버전> 정리 때 제외: <이름> — <이유>"` 추가
5. **버전 머리말**: `content/releases/<버전>.json`의 `headlineKo`(핵심 두세 가지를 담은 짧은 구절, 버전 번호 넣지 않기), `summaryKo`(주요 변경을 나열한 한 문장)를 쓴다. "정리 중" 문구를 바꾼다.
6. **검사**: `npm run build` (스키마 검사), `VERIFY_CHANNELS=chromium node scripts/pipeline/verify.ts` (감지 식·미리보기 확인. 사용자 PC의 Chrome은 회사 정책으로 자동화가 막혀 있어 Playwright 전용 Chromium을 쓴다). 개발 서버에서 버전 페이지를 눈으로 확인한다.
7. **보고**: 실은 기능, 뺀 기능과 이유, `needsCheck`로 남긴 부분을 표로 알려 주고, 커밋·푸시할지 묻는다.

### 싣는 기준

- 싣는다: 웹 페이지 코드(HTML, CSS, JS, Web API)를 쓰는 개발자가 알아야 할 새 기능, 동작 변경, deprecated·제거.
- 뺀다: 엔터프라이즈 정책, 확장 프로그램 API, 브라우저 UI, 내부 구현, 특정 OS 전용, 일반 웹 개발자가 거의 쓰지 않는 저수준 API (WebTransport 세부 옵션, WebGPU 셰이더 세부, Direct Sockets 등).

### 기능 JSON 쓰는 규칙

형식은 `src/lib/schema.ts`. 기존 파일(`content/features/css-random.json`, `html-insertion-streaming.json`)을 본보기로 삼는다.

- `chromestatusId`는 반드시 넣는다 (없으면 다음 감지 때 후보로 다시 올라온다). `sources` 맨 앞에 `https://chromestatus.com/feature/<id>`.
- `status`: 그 버전이 stable이면 `shipped`, beta면 `beta`. Deprecated/Removed/Origin trial 목록이면 `deprecated`/`removed`/`origin-trial`.
- `history`: `[{ "milestone": <버전>, "channel": "beta" 또는 "stable", "note": "ChromeStatus: <목록 종류>" }]`
- 원문에 근거가 있는 내용만 쓴다. 원문에 없는 메서드 이름·옵션·값을 지어내지 않는다. 확실하지 않으면 그 필드 이름을 `needsCheck`에 넣는다 (`support`는 항상 넣는다).
- 한국어는 짧은 평서문(~한다). 코드 이름은 백틱.
  - `summaryKo`: 무엇이 바뀌는지 한 문장
  - `whyKo`: 왜 중요한지, 예전엔 어떻게 했는지 한두 문장
  - `guideKo`: 미지원 브라우저·기존 코드 대응. 없으면 `null`
- `impact`: `new`(기존 코드 영향 없음) / `changed`(기존 동작이 바뀜) / `removed`(사라지거나 막힘)
- `category`: `css` / `js`(HTML·JS·Web API) / `deprecation`
- `exampleCode`: 3~8줄, 한 줄 60자 이내
- `featureTest`: 기능이 없는 브라우저에서 false, 있으면 true. `{kind:"css",decl}` / `{kind:"media",query}` / `{kind:"js",expr}`. 정확히 못 만들면 `null`.
- `preview` (CSS만): `exampleCode`를 그대로 적용해 효과가 보이는 작은 HTML과 바탕 CSS
  - HTML은 `exampleCode` 선택자와 맞춘다. `<a>`에 `href`를 넣지 않는다.
  - `<script>`, `on...=` 속성, `javascript:` 주소는 절대 쓰지 않는다 (페이지에 그대로 들어간다).
  - 바탕 CSS만 쓴다(크기·테두리·색). 색은 `var(--accent|--fg|--fg-dim|--line|--panel)`, 글꼴은 `var(--mono|--sans)`. 높이 120px 이내.
- `scan` (impact가 `removed`·`changed`인 기능만): 서비스 코드에서 영향받는 곳을 찾는 규칙. `[{ "lang": "js"|"css"|"html", "pattern": "<정규식>", "level": "fix"|"check", "noteKo": "<걸렸을 때 보여 줄 한 줄>" }]`
  - `fix` = 제거·deprecated라 고쳐야 함, `check` = 동작이 바뀌니 화면·성능 확인.
  - 원문에 나온 API·속성·값 이름만 찾는다. `\b`로 단어 경계를 걸어 비슷한 이름이 걸리지 않게 한다 (JSON이라 역슬래시는 `\\b`).
  - API가 그대로이고 찾을 코드가 없으면(내부 구현 변경 등) 넣지 않는다.
  - 쓴 뒤 문제 코드 한 줄을 담은 임시 폴더로 `node scripts/audit/scan.ts <폴더>`를 돌려 걸리는지 확인한다.
- `demo`, `before`, `after`는 `null`, `tags`는 `[]`, `baseline`은 모르면 `null`, `support`는 `{ "firefox": null, "safari": null }`, `review`는 `{ "by": null, "at": null }`.

## 서비스 점검 (`scripts/audit/scan.ts`)

- 기능 JSON의 `scan`과 `scripts/audit/legacy-rules.json` 규칙으로 CSS·JS를 검사해 `audit-out/report.html`로 만든다.
- 서비스 점검은 **파일 목록 방식(`--files`)만** 쓴다. 네이트 페이지를 브라우저로 열거나 HTML을 받지 않는다 (PV·광고·통계에 잡히면 안 됨). 페이지 URL 방식은 사용자가 따로 요청할 때만 쓴다.
- `legacy-rules.json`에는 Chrome 공식 문서로 deprecated·제거가 확인된 기능만 넣고, `link`에 그 문서를 적는다.
- 점검 결과(`audit-out/`), 검사 대상 파일 목록(`files.json`), 팀룸 알림은 비공개 저장소 `nate-fe/chrome-update-audit`에서 다룬다. 이 공개 저장소에는 결과·대상 목록·웹훅 주소를 커밋하지 않는다.

## 그 밖의 약속

- 화면에서 뺀 것은 다시 넣지 않는다: 상태 배지(출시됨·곧 나옴), 카드의 "내 브라우저 ✓/✗", `#nerf` 같은 태그, 버전 헤더의 이전·다음 버튼.
- Windows 환경. Git Bash에서 `/경로` 형태 환경 변수는 Windows 경로로 바뀌므로 PowerShell을 쓴다.
