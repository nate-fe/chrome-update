# Chrome 웹 플랫폼 변경사항 자동 안내 페이지 기획서

Oct 30, 2026 · @Emily

## 1. 개요

Chrome stable·베타가 새로 나올 때마다 프론트엔드 개발자에게 영향이 있는 변경사항(CSS, JS/Web API, deprecated·제거)을 한국어로 정리해 자동으로 게시하는 페이지를 만든다. 수집과 초안 작성은 자동으로, 게시 여부는 사람이 검수해 결정한다.

**배경**

- Chrome은 Chrome 153(2026년 9월 8일 stable)부터 릴리스 주기를 4주에서 2주로 줄였다. 1년에 약 26개 버전이 나오므로 사람이 매번 직접 따라가기 어렵다.
- 공식 블로그의 한국어판(`?hl=ko`)은 AI 번역이라 늦게 올라온다. 게다가 베타 공지 글이 "ChromeStatus를 보라"는 링크만 남기는 형태로 바뀌어, 실제 기능 목록은 영어로만 볼 수 있다.
- 베타 공지에 있던 기능이 다음 버전으로 밀리는 일이 잦다. 예를 들어 155 베타 공지에 있던 `corner` 단축 속성은 실제로 157에서 출시됐다. 그래서 "실제로 어느 버전에 나왔는지"를 추적해야 한다.

**목표**

1. 새 stable/베타가 나오고 24시간 안에 한국어 요약 초안을 자동으로 만든다.
2. 기능마다 "무엇이 바뀌었나, 내 코드에 영향이 있나, 지금 써도 되나(다른 브라우저 지원)"를 한 화면에서 보여준다.
3. deprecated·제거 항목을 놓치지 않는다. 기존 코드가 깨질 수 있는 변경을 우선으로 알린다.

**대상 사용자**

- 사내 프론트엔드 개발자 (1차)
- QA 및 퍼블리셔: 브라우저 호환성 점검용 (2차)
- 향후 공개 시 국내 프론트엔드 커뮤니티 (선택)

## 2. 범위

웹 페이지 코드에 직접 영향을 주는 변경만 다루고, 브라우저 UI나 보안 패치는 제외한다.

| 구분 | 포함 | 비고 |
| --- | --- | --- |
| CSS | 새 속성, 함수, 선택자, 미디어 쿼리, 값 | 예: `random()`, `margin-trim`, `text-decoration-inset` |
| JS / Web API | 언어 기능, DOM, Web API, 성능 API, 미디어·그래픽 | 예: 텍스트 모듈, `import()` 재시도, HTML-in-canvas |
| Deprecated / 제거 | deprecated, 제거, 동작 변경(기본값이나 보안 정책 변경) | 예: fenced frame no-op, Background Fetch CORS 적용 |
| 오리진 트라이얼 | 새로 시작된 것만 별도 표시 | "미리 보기" 라벨 |

**채널**

- **Stable**: 게시의 기준. 실제 출시된 기능만 "출시됨"으로 표시한다.
- **Beta**: "곧 나옴"으로 미리 게시하고, stable에 나오면 상태를 바꾼다. 베타에서 빠지거나 다음 버전으로 밀린 기능은 "연기됨"으로 표시한다.
- Dev/Canary와 플래그 뒤에 있는 기능은 제외한다. 다만 수집 데이터에는 남겨 두어 나중에 필요하면 활용한다.

**제외**: DevTools 신기능(2단계 후보), 확장 프로그램 API, 엔터프라이즈 정책, 보안 취약점 패치 목록, Android·iOS 앱 UI 변경.

## 3. 데이터 소스

기본 데이터는 ChromeStatus에서 가져오고, 다른 소스는 출시 일정, 교차 확인, 호환성 정보를 보충하는 용도로 쓴다. 블로그 글을 기본 데이터로 쓰지 않는다. 베타 공지 내용과 실제 출시 버전이 다른 일이 있었기 때문이다.

| 소스 | 용도 | 가져오는 방법 | 우선순위 |
| --- | --- | --- | --- |
| [ChromeStatus](https://chromestatus.com/roadmap) | 마일스톤별 기능 목록, 분류, 상태(기본 활성화, 오리진 트라이얼, deprecated, 제거), 설명, 샘플·스펙 링크 | 기능 목록 JSON(마일스톤 쿼리) 또는 `release-notes/<버전>` 페이지 | 기본 |
| [Chromium Dash 일정](https://chromiumdash.appspot.com/schedule) | 버전별 베타·stable 날짜, 새 버전 감지 | `fetch_milestone_schedule` JSON | 기본 |
| [MDN browser-compat-data](https://github.com/mdn/browser-compat-data) | Chrome/Firefox/Safari 지원 버전, 실제 출시 여부 교차 확인 | npm 패키지 또는 버전별 자동 PR("Updates for Chrome N beta") | 보조 |
| [web-features / Baseline](https://github.com/web-platform-dx/web-features) | Baseline 상태(널리 사용 가능 / 새로 사용 가능 / 제한적) | npm 패키지 | 보조 |
| [Microsoft Edge 웹 플랫폼 릴리스 노트](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/157) | 같은 Chromium 버전에 대한 사람이 쓴 설명, 예제 | 페이지 수집 | 참고 |
| Chrome for Developers 블로그 ("New in Chrome", 베타 공지) | 핵심 기능 선정, 해설 링크 | RSS | 참고 |

**원칙**

- 기능의 "출시 버전"은 ChromeStatus의 마일스톤 필드를 기준으로 한다. BCD와 다르면 검수 큐에 "불일치"로 표시한다.
- 한국어 설명은 원문을 옮기지 않고 새로 작성하며, 원문 링크를 항상 함께 둔다.
- **확인 필요(PoC)**: ChromeStatus 기능 목록 API의 정확한 엔드포인트, 응답 형식, 호출 빈도 제한. 공식으로 문서화된 공개 API가 아니므로, 형식이 바뀌는 경우를 대비해 수집기를 어댑터 구조로 만든다.

## 4. 자동화 파이프라인

매일 한 번 새 버전을 확인하고, 1\~4단계는 자동으로 실행한다. 게시는 사람이 PR을 승인해야만 이뤄진다. LLM이 쓴 설명이 검수 없이 그대로 나가는 일을 막기 위해서다.

&#91;embedded content: 자동화 파이프라인 · 7단계, 사람 검수 1회\]

1. **감지**: GitHub Actions cron이 하루 한 번 Chromium Dash 일정 JSON과 ChromeStatus를 조회한다. 다음 세 가지를 감지한다.
   - 새 베타 승격
   - 새 stable 승격
   - 이미 게시한 기능의 마일스톤 변경(연기 또는 철회)
   - 변경이 없으면 여기서 종료한다.
2. **수집**: 해당 마일스톤의 원본 JSON을 `raw/<버전>/<날짜>.json`에 스냅샷으로 저장한다. 다음 실행 때 이 스냅샷과 비교해 무엇이 바뀌었는지 계산한다.
3. **분류·필터**: ChromeStatus의 카테고리와 기능 유형 필드를 기준으로 CSS / JS·API / Deprecated·제거로 나눈다. 범위 밖 항목(엔터프라이즈 정책, 확장 프로그램 API)은 제외한다. BCD에 같은 기능이 있으면 지원 버전을 함께 붙인다.
4. **한국어 초안**: LLM API에 원문 설명, 스펙·샘플 링크, BCD 데이터를 넣고, 정해진 JSON 스키마로 결과를 받는다(요약, 영향도, 예제 코드, 대응 가이드). 프롬프트에 다음 규칙을 넣는다.
   - 원문에 없는 사실은 쓰지 않는다.
   - 용어집을 따른다(예: deprecated는 번역하지 않는다).
   - 근거가 부족한 필드는 비워 두고 '확인 필요'로 표시한다.
5. **검수 PR**: 콘텐츠 파일 변경을 PR로 올리고 미리보기 배포 링크를 붙인다. 다음 자동 검사가 함께 실행된다.
   - 스키마 검증
   - 링크 검사
   - 예제 코드 문법 검사(CSS 파서, ESLint)
6. **병합·배포**: PR이 승인되면 병합하고, 정적 사이트를 다시 빌드해 배포한다.
7. **알림**: RSS 피드를 갱신하고 Slack 웹훅을 보낸다(메일은 선택).

**상태만 바뀌는 경우**: 베타로 게시한 기능이 stable이 되는 경우처럼 상태 필드만 바뀌는 PR은 자동 검사만 통과하면 자동으로 병합되도록 허용한다. 반면 연기나 철회는 반드시 사람이 확인한다.

## 5. 페이지 구성과 기능 요구사항

처음 들어오면 "내 브라우저 버전과 다음 버전 사이에 무엇이 바뀌나"부터 보여주고, 세부 내용은 버전별 페이지와 기능 카드로 내려가며 보게 한다.

**화면 구조**

| 화면 | 주소 예시 | 내용 |
| --- | --- | --- |
| 홈 | `/` | 현재 stable·베타 버전과 다음 출시일, 내 브라우저 버전 배너, 최근 2개 버전의 주요 변경, 주의가 필요한 변경(deprecated·제거) 모음 |
| 버전 페이지 | `/chrome/157` | 한 줄 요약, CSS / JS·API / Deprecated·제거 / 오리진 트라이얼 탭, 출시일과 버전 상태 |
| 기능 상세 | `/features/text-decoration-inset` | 기능 카드 전체, 예제, 다른 브라우저 지원, 변경 이력(어느 베타 공지에 있었고 실제로는 언제 나왔는지) |
| 버전 비교 | `/compare?from=155&to=157` | 두 버전 사이에 추가·변경·제거된 기능을 합친 목록 |
| 검색·필터 | `/features?cat=css&status=removed` | 카테고리, 상태, Baseline, 버전 범위로 필터 |
| 피드 | `/feed.xml` | 새 버전이나 상태가 바뀌면 항목 추가 |

**기능 카드 필드**

| 필드 | 예시 (`text-decoration-inset`) | 출처 |
| --- | --- | --- |
| 이름 | CSS `text-decoration-inset` | ChromeStatus |
| 카테고리 | CSS | ChromeStatus → 분류 규칙 |
| 상태 배지 | 출시됨 / 곧 나옴 / 연기됨 / 오리진 트라이얼 / Deprecated / 제거됨 | ChromeStatus + 일정 |
| 출시 버전 | 157 (11월 3일 stable 예정) | ChromeStatus, Chromium Dash |
| 한 줄 요약 | 밑줄이나 취소선의 시작·끝 위치를 조절한다 | LLM 초안 + 검수 |
| 왜 중요한가 | 밑줄 애니메이션을 그라디언트 꼼수 없이 구현할 수 있다 | LLM 초안 + 검수 |
| 예제 코드 | `text-decoration-inset: 10px;` | LLM 초안 + 문법 검사 |
| 영향도 | 신규(안전) / 동작 변경(확인 필요) / 제거(대응 필수) | 분류 규칙 |
| 다른 브라우저 지원 | Firefox, Safari 지원 버전 및 Baseline | BCD, web-features |
| 대응 가이드 | `@supports` 폴백 예시, 대체 방법 | LLM 초안 + 검수 |
| 원문 링크 | ChromeStatus, 스펙, MDN | 수집 데이터 |

**기능 요구사항**

| ID | 기능 | 우선순위 |
| --- | --- | --- |
| F1 | 버전별 페이지와 카테고리 탭 | P0 |
| F2 | 기능 카드(위 필드 전체) | P0 |
| F3 | Deprecated·제거 항목을 목록 맨 위에 강조 표시 | P0 |
| F4 | 상태 배지와 연기 이력 | P0 |
| F5 | 내 브라우저 버전 감지: 접속한 브라우저 버전을 읽어 "내 버전 이후 변경"을 기본으로 보여준다. Chromium이 아니면 안내 문구를 표시한다. | P1 |
| F6 | 버전 비교(from–to) | P1 |
| F7 | 검색과 필터 | P1 |
| F8 | RSS와 Slack 알림 | P1 |
| F9 | 기능별 "우리 코드에서 쓰는 곳" 메모(팀 코멘트) | P2 |
| F10 | Firefox·Safari 릴리스로 확장 | P2 |

**재미 요소: 읽는 페이지에서 만져 보는 페이지로**

텍스트 설명만으로는 "그래서 뭐가 좋아지는데?"가 잘 전달되지 않는다. 그래서 모든 기능을 **직접 돌려 보고, 내 브라우저로 확인하고, 우리 코드와 연결해 보게** 만든다. 핵심은 라이브 데모(F11)이고, 나머지는 다시 방문하게 만드는 장치다.

| ID | 요소 | 어떻게 보이나 | 난이도 | 우선순위 |
| --- | --- | --- | --- | --- |
| F11 | 라이브 데모 + 슬라이더 | 카드마다 실제로 동작하는 데모를 넣는다. 예: `text-decoration-inset` 값을 슬라이더로 움직이면 밑줄이 줄어들고 늘어난다. `random()`은 버튼을 누를 때마다 컨페티가 다르게 튜다. | 중 | P0 |
| F12 | 내 브라우저 지원 점수 | 페이지를 열면 `CSS.supports()`와 API 존재 여부로 기능마다 지원/미지원을 즉석에서 표시한다(예: "내 브라우저 14/16"). 미지원이면 데모 옆에 폴백 화면을 나란히 보여준다. | 하 | P0 |
| F13 | Before / After 코드 | "예전 방식"(예: 그라디언트로 밑줄 만들기 꼼수)과 "이제 방식"을 나란히 두고 줄 수 차이를 보여준다(예: "12줄 → 1줄"). | 하 | P0 |
| F14 | 게임 패치노트 스타일 | 새 기능은 "신규 스킬", 동작 변경은 "밸런스 조정", deprecated는 "너프 예고", 제거는 "삭제"로 부른다. 버전 페이지 상단에 패치 버전 배너를 둔다. 표기만 바꾸면 되므로 숨길 수 있는 테마 토글로 제공한다. | 하 | P1 |
| F15 | 기능의 여정 | 한 기능이 베타 공지에서 출시까지 거친 경로를 미니 타임라인으로 보여준다(예: `corner` 155 베타 공지 → 157 출시). F4의 연기 이력을 그림으로 나타낸 것이다. | 하 | P1 |
| F16 | "몇 버전부터?" 퀴즈 | 코드 조각을 보여주고 어느 버전부터 동작하는지 맞히는 버전별 3문제를 낸다. Slack 알림에 퀴즈 링크를 붙이고, 팀 리더보드는 선택 사항이다. | 중 | P1 |
| F17 | 레거시 사냥 | 우리 저장소를 스캔해 새 기능으로 바꿀 수 있는 코드(예: `:first-child { margin-top: 0 }` → `margin-trim`)와 deprecated API 사용처를 찾아 "이번 버전에서 잡을 수 있는 레거시 N개"로 보여준다. | 상 | P2 |
| F18 | Slack 카드 이미지 | 텍스트 알림 대신 패치 배너나 데모 GIF 이미지를 붙여 보낸다. | 중 | P2 |

파이프라인에 주는 영향은 다음과 같다.

- 데모 코드(HTML/CSS/JS 조각)는 4단계에서 LLM이 초안을 쓰고, 5단계 검수 미리보기에서 사람이 실제로 돌려 보고 승인한다.
- 데모는 sandbox iframe 안에서 실행해 본 페이지와 분리한다.
- 기능 카드 스키마에 `demo`(HTML/CSS/JS), `controls`(슬라이더 정의), `before`/`after`, `featureTest`(지원 감지 식) 필드를 추가한다.
- 데모가 검수 시간을 늘리므로, MVP에서는 CSS 기능에만 데모를 붙이고 JS·API는 코드 예제만 둔다.

**디자인 방향: 두 가지 버전 (A 신문 / B 다크 IDE)**

같은 데이터를 두 가지 디자인으로 보여주고, 방문자가 상단 토글로 고를 수 있게 한다. 고른 값은 브라우저에 저장해 다음 방문 때도 유지한다. 기능 카드 JSON은 하나이고, 두 버전은 화면을 그리는 컴포넌트만 다르다.

|  | A. 신문 1면 | B. 다크 IDE |
| --- | --- | --- |
| 느낌 | "크롬 위클리 제157호"처럼 버전마다 신문 한 부가 나오는 편집 디자인 | 코드 에디터 화면. 변경점을 diff(`-` 예전, `+` 지금)로 보여준다 |
| 타이포그래피 | 명조체(예: Nanum Myeongjo), 헤드라인, 부제, 드롭캡, 2단 본문 | 고정폭 글꼴, 문법 강조 색, 탭 바, 상태 표시줄 |
| 버전에 대응하는 요소 | 호수(제157호), 발행일 = stable 출시일, 면 = 카테고리(CSS면, 자바스크립트면, 부고면 = 제거) | 파일 탭 = 카테고리(`css.diff`, `js.diff`, `removed.md`), 상태 표시줄 = 출시 상태·마일스톤·Baseline |
| 강점 | 요약 글을 읽게 만든다. 사내 공유용으로 무게감이 있다 | 개발자에게 익숙하다. JS 기능과 제거 항목을 보여주기 좋다 |
| 라이브 데모(F11) | 기사 본문 사이에 "도판"처럼 박스로 넣는다 | 에디터 아래 터미널·미리보기 패널로 넣는다 |
| 다크 모드 | 종이색 배경과 어두운 배경 둘 다 지원 | 어두운 테마가 기본이고, 밝은 에디터 테마는 선택 |

- 두 버전 모두 F11\~F13(라이브 데모, 내 브라우저 점수, Before/After)을 같은 데이터로 표시한다.
- F14(게임 패치노트 테마)는 이 A/B 토글로 대체하고 보류한다. 단, `buff`·`deleted`·`silent` 같은 상태 태그는 B에서 쓸 수 있다.
- 일정 영향: MVP(2\~3주차)는 B를 먼저 만들고, A는 시범 운영 기간(5\~8주차)에 추가하는 것을 제안한다. 둘을 동시에 만들면 MVP 기간이 약 1주 늘어날 수 있다.
- 시안: 대화에서 보여준 "같은 기능(import() 재시도)을 세 가지 스타일로 비교"한 예시 중 A와 B를 채택했다(2026년 11월 2일).

## 6. 기술 스택과 데이터 모델

서버 없이 동작하는 정적 사이트에, Git 저장소를 데이터베이스로 쓰는 구조를 제안한다. 데이터를 저장소에 두면 모든 변경이 PR 이력으로 남아서 검수·롤백·감사가 모두 Git 안에서 해결된다.

| 영역 | 제안 | 선택 이유 |
| --- | --- | --- |
| 사이트 | Astro 또는 Next.js(정적 export) | 콘텐츠 중심 사이트이고, JSON을 읽어 페이지를 만들기 쉽다 |
| 호스팅 | GitHub Pages, Vercel, Cloudflare Pages 중 하나 | PR마다 미리보기 배포를 제공한다 (Vercel, Cloudflare) |
| 스케줄러 | GitHub Actions cron (매일 1회) | 별도 서버가 필요 없다 |
| 수집·분류 | Node.js 스크립트 (TypeScript) | 프론트엔드 팀이 유지보수하기 쉽다 |
| 한국어 초안 | LLM API (구조화 출력) | 스키마에 맞춘 JSON을 받아 바로 검증할 수 있다 |
| 검증 | Zod 스키마, lychee(링크), stylelint/ESLint(예제) | PR에서 자동으로 실행한다 |
| 알림 | RSS 생성, Slack Incoming Webhook | 설정이 간단하다 |

**저장소 구조**

```
raw/157/2026-10-15.json      # 수집 원본 스냅샷
content/releases/157.json    # 버전 메타 (날짜, 상태, 요약)
content/features/<slug>.json # 기능 카드 (한국어)
glossary.json                # 용어집
scripts/                     # 감지·수집·분류·초안
```

**기능 데이터 예시**

```json
{
  "slug": "text-decoration-inset",
  "chromestatusId": 5178263526834176,
  "category": "css",
  "impact": "new",
  "status": "shipped",
  "milestone": 157,
  "history": [
    { "milestone": 154, "note": "New in Chrome 154 글에 소개" },
    { "milestone": 157, "note": "ChromeStatus 기준 기본 활성화" }
  ],
  "summaryKo": "밑줄·윗줄·취소선의 시작과 끝 위치를 안쪽이나 바깥으로 조절한다.",
  "exampleCode": "a { text-decoration-inset: 10px; }",
  "support": { "firefox": "146", "safari": null },
  "sources": ["https://chromestatus.com/feature/5178263526834176"],
  "review": { "by": null, "at": null }
}
```

## 7. 운영

한 버전을 검수하는 데 30분 이내가 목표다. 담당자는 2주씩 돌아가며 맡는다.

**검수 체크리스트**

- [ ] 출시 버전이 ChromeStatus와 같은가 (BCD와 다르면 사유를 메모)
- [ ] 요약에 원문에 없는 주장이 없는가
- [ ] 예제 코드가 실제 브라우저(베타 또는 stable)에서 동작하는가
- [ ] Deprecated·제거 항목에 대응 방법이 적혀 있는가
- [ ] 용어집을 따랐는가

**라이선스와 출처 표기**

- 원문을 그대로 번역해 옮기지 않는다. 사실을 바탕으로 한국어로 새로 쓰고, 모든 카드에 원문 링크를 단다.
- 페이지 하단에 데이터 출처(ChromeStatus, MDN BCD, web-features)와 각 라이선스를 표기한다.
- **확인 필요**: 각 소스의 라이선스 조건. 예를 들어 ChromeStatus는 CC BY 2.5로 인용된 사례가 있다. 외부에 공개하기 전에 법무 검토를 받는다.

**리스크와 대응**

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| ChromeStatus 응답 형식이 바뀜 (비공식 API) | 수집이 멈춤 | 수집기를 어댑터로 분리하고, 스키마 검증이 실패하면 알림을 보낸다. 대안으로 release-notes 페이지를 수집한다. |
| LLM이 없는 사실을 지어냄 | 잘못된 정보가 게시됨 | 원문에 근거가 있는 내용만 쓰게 하고, 사람이 반드시 검수한다. 예제 코드는 문법 검사를 거친다. |
| 기능 출시가 연기되거나 철회됨 | 잘못된 "출시됨" 표시 | 매일 마일스톤을 다시 비교하고, 변경이 있으면 상태를 "연기됨"으로 바꾼 PR을 만든다. |
| 2주마다 검수하는 부담 | 게시가 늦어짐 | 범위를 엄격히 지킨다. 상태만 바뀌는 PR은 자동으로 병합한다. 담당자는 돌아가며 맡는다. |
| LLM API 비용 | 운영비가 늘어남 | 새 기능이거나 내용이 바뀐 기능에만 호출한다. 버전당 기능은 10\~20개 수준이다. |

## 8. 일정과 성공 지표

착수하고 8주 안에 릴리스 2회를 파이프라인으로 처리하는 것이 목표다. 게이트를 통과하지 못하면 다음 단계로 넘어가지 않는다. 착수일은 아직 정해지지 않았다.

&#91;embedded content: 로드맵 · 4단계, 게이트 3개 (주차는 착수일 기준)\]

- **G1**: 수집기가 Chrome 157 기본 활성화 기능 16개를 빠짐없이 가져오고 분류한다(부록의 샘플 데이터와 비교).
- **G2**: 프론트엔드 팀원 3명 이상이 155\~157 페이지를 검토하고 큰 수정 없이 통과시킨다.
- **G3**: 사람이 실행하지 않아도 감지부터 PR 생성까지 한 번 완료된다.

**성공 지표**

| 지표 | 목표 | 측정 방법 |
| --- | --- | --- |
| 새 버전 출시 후 게시까지 걸리는 시간 | stable 출시일에서 2영업일 이내 | Chromium Dash 날짜와 병합 시각 비교 |
| 누락된 기능 수 | 0개 (범위 안 기능 기준) | ChromeStatus 목록과 대조 |
| 게시 후 정정 건수 | 버전당 1건 이하 | 정정 PR 수 |
| 검수 시간 | 버전당 30분 이내 | PR 생성과 승인 사이 시간 |
| 팀 사용 | 프론트엔드 팀원 절반 이상이 월 1회 이상 방문 | 사이트 방문 통계, RSS/Slack 클릭 |

## 부록. Chrome 155\~157 샘플 데이터

파이프라인이 내놓아야 하는 결과의 기준이다. PoC(G1) 검증과 MVP 초기 데이터로 쓴다. ChromeStatus의 기본 활성화 목록에서 범위 안 항목만 골랐다.

| 버전 (stable) | 구분 | 항목 | 한 줄 요약 |
| --- | --- | --- | --- |
| 157 (11월 3일 예정) | CSS | `corner` 단축 속성 | 모서리별로 `border-radius`와 `corner-shape`를 한 번에 지정 |
| 157 | CSS | `text-decoration-inset` | 밑줄·취소선의 시작과 끝 위치를 조절 |
| 157 | CSS | `text-overflow: <string>` | 텍스트가 잘릴 때 원하는 문자열 표시 |
| 157 | CSS | `position-visibility: anchor-valid / anchor-visible` | 앵커 상태에 따라 표시. 복수형 이름은 deprecated 별칭으로 남음 |
| 157 | JS·API | HTML-in-canvas | HTML을 캔버스에 그리고 DOM과 동기화 |
| 157 | JS·API | HTML 삽입·스트리밍 메서드 | 위치를 지정해 마크업 삽입, 스트리밍 삽입 |
| 157 | JS·API | Long Animation Frames | `styleDuration`, `forcedStyleDuration` 추가 |
| 157 | 동작 변경 | Background Fetch CORS 적용 | Background Fetch 요청에 CORS 검사가 적용됨 |
| 156 (10월 20일) | CSS | `random()` | 범위를 정해 난수 값 생성 |
| 156 | CSS | `overflow: scroll clip` | 한 축만 스크롤, 축별 sticky |
| 156 | CSS | `scroll-snap-type: pair` | 두 축이 같은 요소에 스냅 |
| 156 | JS·API | 실패한 모듈 재시도 | 실패한 `import()`를 다시 호출해 재시도 가능 |
| 156 | JS·API | IndexedDB SQLite 백엔드 | API는 그대로, 저장소 구현만 변경 |
| 156 | 제거 | Fenced frame, `window.fence` | 동작하지 않게(no-op) 바뀜. 157부터 요소 제거를 단계적으로 진행 |
| 155 (10월 6일) | CSS | `margin-trim` | 첫·마지막 자식의 여백 제거 |
| 155 | CSS | `symbols()` | `@counter-style` 없이 인라인으로 카운터 스타일 정의 |
| 155 | CSS | `text-decoration-skip-spaces` | 텍스트 장식이 공백을 건너뛸지 제어 |
| 155 | CSS | `display-state`, `resizable` 미디어 쿼리 | 창의 최소화·최대화 상태와 크기 조절 가능 여부 감지 |
| 155 | JS·API | 텍스트 모듈 | `import ... with { type: "text" }` |
| 155 | JS·API | JPEG XL 디코딩 | `image/jxl` 표시 지원 |
| 155 | JS·API | 보이지 않는 iframe 미디어 정책 | 숨겨진 iframe에서 소리 나는 재생을 막는 권한 정책 |

연기 이력 샘플: `corner` 단축 속성은 155 베타 공지에 있었지만 실제 출시는 157이다. 실패한 모듈 재시도도 155 베타 공지에 있었지만 실제 출시는 156이다. F4(상태 배지와 연기 이력)가 이 두 경우를 올바르게 표시하는지 테스트 케이스로 쓴다.

## 출처

- [Chrome 155 Release Notes – ChromeStatus](https://chromestatus.com/release-notes/155)
- [Chrome Release 156 – chromestatuslite](https://chromestatuslite.com/?version=156)
- [Chrome Release 157 – chromestatuslite](https://chromestatuslite.com/?version=157)
- [Chrome 155 beta – Chrome for Developers (X)](https://x.com/ChromiumDev/article/2105325011116646507)
- [Chrome 157 beta – Chrome for Developers](https://developer.chrome.com/blog/chrome-157-beta)
- [MDN BCD: Updates for Chrome 157 beta](https://github.com/mdn/browser-compat-data/pull/30893)
- [Microsoft Edge 157 web platform release notes](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/157)
- [Chrome Release Dates 2026 – 출시일 정리](https://www.superchargebrowser.com/library/chrome-149-whats-coming-tab-users/)
- [Chromium Dash 일정 JSON 사용 예 (Firefox 소스)](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/webrtc/third_party_build/lookup_branch_head.py)
- [MicrosoftEdge/Status – ChromeStatus CC BY 2.5 인용 사례](https://github.com/MicrosoftEdge/Status)
