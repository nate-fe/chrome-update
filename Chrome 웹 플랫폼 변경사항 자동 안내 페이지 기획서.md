# Chrome 웹 플랫폼 변경사항 자동 안내 페이지 기획서

Oct 30, 2026 · @윤지은 · 개정 Nov 4, 2026 (구현 결과 반영)

## 개정 요약

첫 구현(Chrome 155~158)을 마친 뒤 실제 사이트에 맞춰 고쳤다. 기획 단계와 달라진 점은 다음과 같다.

| 항목 | 처음 기획 | 지금 |
| --- | --- | --- |
| 한국어 초안 | 매번 LLM API로 자동 작성 | 비용 때문에 쓰지 않는다. 사람이 Claude Code와 함께 작성한다 (스크립트는 남겨 둠) |
| 출시 여부 판단 | ChromeStatus 마일스톤 필드 | ChromeStatus 목록 + **실제 Chrome으로 감지 식 검사**. ChromeStatus 상태 값은 믿을 수 없었다 |
| 디자인 | A(신문)/B(다크 IDE) 토글 | B 하나로 확정 |
| 상태 표시 | 출시됨·곧 나옴·연기됨 등 상태 배지 | 상태 배지는 뺐다. "출시 연기"만 표시한다 |
| 카드 | 텍스트 위주 | 예시 코드와 CSS 미니 미리보기를 카드에 바로 보여준다 |
| 호스팅 | 미정 | GitHub Pages |

## 1. 개요

Chrome stable·베타가 새로 나올 때마다 프론트엔드 개발자에게 영향이 있는 변경사항(CSS, JS/Web API, deprecated·제거)을 한국어로 정리해 게시하는 페이지를 만든다. 변경 감지와 검사는 자동으로, 내용 작성과 게시 결정은 사람이 한다.

**배경**

- Chrome은 Chrome 153(2026년 9월 8일 stable)부터 릴리스 주기를 4주에서 2주로 줄였다. 1년에 약 26개 버전이 나오므로 사람이 매번 직접 따라가기 어렵다.
- 공식 블로그의 한국어판(`?hl=ko`)은 AI 번역이라 늦게 올라온다. 베타 공지 글은 "ChromeStatus를 보라"는 링크만 남기는 형태로 바뀌어, 실제 기능 목록은 영어로만 볼 수 있다.
- 베타 공지에 있던 기능이 다음 버전으로 밀리는 일이 잦다. 예를 들어 155 베타 공지에 있던 `corner` 단축 속성은 실제로 157에서 출시됐다. 구현 중에는 ChromeStatus에 "155 기본 활성화"로 올라 있던 기능 두 개가 Chrome 156에서도 실제로는 꺼져 있는 것을 확인했다. "실제로 어느 버전에 나왔는지"를 추적해야 한다.

**목표**

1. 새 stable/베타가 나오면 24시간 안에 감지하고, 버전 일정과 출시 상태를 자동으로 맞춘다.
2. 기능마다 "무엇이 바뀌었나, 내 코드에 영향이 있나, 지금 써도 되나"를 한 화면에서 보여준다.
3. deprecated·제거 항목을 놓치지 않는다. 기존 코드가 깨질 수 있는 변경을 우선으로 알린다.

**대상 사용자**

- 사내 프론트엔드 개발자 (1차)
- QA 및 퍼블리셔: 브라우저 호환성 점검용 (2차)

## 2. 범위

웹 페이지 코드에 직접 영향을 주는 변경만 다루고, 브라우저 UI나 보안 패치는 제외한다.

| 구분 | 포함 | 예 |
| --- | --- | --- |
| CSS | 새 속성, 함수, 선택자, 미디어 쿼리, 값 | `random()`, `margin-trim`, `::highlight(*)` |
| JS / Web API | 언어 기능, DOM, HTML·SVG, Web API, 권한 정책 | 텍스트 모듈, HTML-in-canvas, `navigator.install()` |
| Deprecated / 제거 | deprecated, 제거, 동작 변경 | fenced frame no-op, Background Fetch CORS, XSLT 제거 |
| 오리진 트라이얼 | 새로 시작된 것만 별도 탭 | 지금까지 해당 없음 |

**버전 범위**: 사이트에는 현재 **Stable과 Beta까지만** 싣는다. Dev·Canary와 플래그 뒤의 기능은 자주 빠지거나 미뤄지므로 다루지 않는다. 지난 버전은 지우지 않고 남긴다.

**제외**: 엔터프라이즈 정책, 확장 프로그램 API, 브라우저 UI, 내부 구현, 특정 OS 전용 기능, 일반 웹 개발자가 거의 쓰지 않는 저수준 API(WebTransport 세부 옵션, WebGPU 셰이더 세부, Direct Sockets 등). 제외한 항목은 이유와 함께 `content/pipeline-state.json`에 남긴다.

## 3. 데이터 소스

| 소스 | 용도 | 가져오는 방법 | 사용 |
| --- | --- | --- | --- |
| [Chromium Dash](https://chromiumdash.appspot.com/schedule) | 현재 Stable·Beta 버전, 버전별 stable 날짜 | `fetch_releases`, `fetch_milestone_schedule` JSON | 사용 |
| [ChromeStatus](https://chromestatus.com/roadmap) | 마일스톤별 기능 목록과 종류, 기능 설명·스펙·샘플 링크 | `/api/v0/features?milestone=N`, `/api/v0/features/<id>` (응답 앞 `)]}'` 제거) | 사용 |
| 실제 Chrome Stable·Beta | 기능이 실제로 켜져 있는지 | Playwright로 감지 식 실행 | 사용 |
| [MDN browser-compat-data](https://github.com/mdn/browser-compat-data), [web-features](https://github.com/web-platform-dx/web-features) | 다른 브라우저 지원, Baseline | — | 미사용 (사람이 확인해 입력) |
| Edge 릴리스 노트, Chrome 블로그 | 해설, 예제 참고 | — | 미사용 |

**원칙**

- ChromeStatus의 **마일스톤 목록**으로 어느 버전에 나오는지 정하고, **실제 Chrome 검사**로 정말 켜졌는지 확인한다.
- ChromeStatus 기능별 상태 값은 쓰지 않는다. 157에 출시된 `corner`가 "Proposed"로 남아 있는 등 갱신되지 않는 경우가 많았다.
- 한국어 설명은 원문을 옮기지 않고 새로 쓰며, 모든 기능에 원문 링크를 둔다.

## 4. 자동화 파이프라인

GitHub Actions가 매일 09:02(한국 시간)경에 실행한다. 바뀐 것이 없으면 PR 없이 끝난다.

1. **검수 대기 확인**: 사람이 봐야 하는 PR이 열려 있으면 그날은 쉰다 (검수 중인 내용을 덮어쓰지 않기 위해).
2. **감지** (`detect.ts`)
   - Stable·Beta 버전과 날짜를 맞춘다. 새 Beta 버전이 생기면 버전 파일을 추가한다.
   - Stable이 된 버전의 기능을 "출시됨"으로 바꾼다.
   - ChromeStatus 목록에서 기능의 출시 버전이 뒤로 밀렸는지 확인한다.
   - 아직 정리하지 않은 새 기능 후보를 찾는다.
3. **초안** (`draft.ts`): API 키가 있을 때만 Claude가 초안을 쓴다. **지금은 비용 때문에 건너뛴다.**
4. **형식 검사**: Zod 스키마로 콘텐츠 파일을 검사하고 사이트를 빌드한다.
5. **실제 Chrome 검사** (`verify.ts`): Chrome Stable·Beta로 기능 감지 식을 돌린다.
   - Stable에서 동작하지 않는 "출시됨" 기능은 "출시 연기"로 바꾼다.
   - CSS 미리보기를 예시 코드 적용 전/후로 찍어 실제로 달라 보이는지 확인한다.
6. **PR** (`report.ts`): 콘텐츠가 바뀌었으면 PR을 연다. 본문에 변경 내용, 남은 후보, 검사 경고를 적는다.
   - **상태·날짜만 바뀐 PR**(예: 베타 → 출시됨): 경고가 없으면 바로 병합하고 배포한다.
   - **새 버전이나 내용이 바뀐 PR**: `needs-review` 라벨. 사람이 정리하고 병합해야 배포된다.
7. **배포**: `main`에 병합되면 GitHub Pages에 배포한다.

**사람이 하는 일 (새 Beta 버전마다, 약 2주 간격)**

자동 PR이 열리면 Claude Code에게 "158 정리해줘"처럼 요청한다. 절차와 작성 규칙은 `CLAUDE.md`에 있다.

1. 후보마다 ChromeStatus 원문을 읽고 싣거나 뺀다.
2. 실을 기능은 `content/features/<slug>.json`을 쓰고(`chromestatusId` 필수), 뺄 기능은 이유와 함께 제외 목록에 적는다.
3. 버전 머리말을 쓴다.
4. 빌드·검사를 통과시키고 PR을 병합한다.

**알려진 한계**: 자동 검사는 새 프로필의 Chrome으로 돌린다. Google이 서버 설정(Finch)으로 단계적으로 켜는 기능은 실제 사용자 Chrome과 결과가 다를 수 있다 (`text-decoration-skip-spaces`가 그런 경우였다).

## 5. 페이지 구성과 기능 요구사항

**화면 구조**

| 화면 | 주소 | 내용 |
| --- | --- | --- |
| 홈 | `/` | Stable·Beta 버전과 다음 출시까지 남은 날, 내 브라우저 안내 배너, 주의가 필요한 변경, 버전별 목록 |
| 버전 페이지 | `/chrome/158` | 머리말, 파일 탭(`css.diff`, `js.diff`, `removed.md`, `origin-trial.md`), breaking 경고 배너, 지원 점수, 퀴즈 |
| 기능 상세 | `/features/xslt-removal` | 왜 중요한가, 라이브 데모, Before/After, 대응 가이드, 다른 브라우저 지원, 기능의 여정, 원문 링크 |
| 버전 비교 | `/compare?from=155&to=158` | 두 버전 사이에 추가·변경·제거된 기능 |
| 검색·필터 | `/features?cat=css` | 카테고리, 상태, Baseline, 버전 범위 필터 (주소로 공유 가능) |

**기능 카드에 보이는 것**

| 요소 | 예 | 비고 |
| --- | --- | --- |
| 말머리 + 제목 | `CSS` `text-decoration-inset` | 말머리: CSS / JS · API / Deprecated · 제거 |
| 한 줄 요약 | 밑줄·윗줄·취소선의 시작과 끝 위치를 조절한다 | |
| 예시 코드 | `a { text-decoration-inset: 10px; }` | CSS, JS · API 카드 |
| 미니 미리보기 | 예시 코드를 실제 HTML에 적용한 모습 | CSS만. 내 Chrome보다 새 버전의 기능은 숨김 |
| 영향도 배지 | 신규 · 안전 / 동작 변경 · 확인 필요 / 제거 · 대응 필수 | |
| 연기 표시 | 연기 이력 155→157 / 출시 연기 · 아직 기본 비활성 | 출시 연기 기능은 예시·미리보기를 숨김 |

**기능 요구사항**

| ID | 기능 | 상태 |
| --- | --- | --- |
| F1 | 버전별 페이지와 카테고리 탭 | 구현 |
| F2 | 기능 카드 | 구현 |
| F3 | Deprecated·제거 항목을 맨 위에 강조 | 구현 |
| F4 | 연기 이력과 출시 연기 표시 | 구현 (상태 배지는 뺌) |
| F5 | 내 브라우저 버전 감지: 우측 상단 "이 브라우저는 Chrome 000 버전입니다.", 홈 안내 배너 | 구현 |
| F6 | 버전 비교 | 구현 |
| F7 | 검색과 필터 | 구현 |
| F8 | RSS와 Slack 알림 | 제외 |
| F9 | 팀 코멘트 | 보류 |
| F10 | Firefox·Safari 릴리스로 확장 | 보류 |
| F11 | 라이브 데모 + 슬라이더 (상세 페이지, sandbox iframe) | 구현 |
| F12 | 내 브라우저 지원 점수 (버전 페이지 하단) | 구현 (카드의 ✓/✗ 배지는 뺌) |
| F13 | Before / After diff | 구현 |
| F14 | 게임 패치노트 테마·태그(`#nerf` 등) | 제외 |
| F15 | 기능의 여정 (베타 공지 → 연기 → 출시) | 구현 |
| F16 | "몇 버전부터?" 퀴즈 | 구현 |
| F17 | 레거시 사냥 (저장소 스캔) | 보류 |
| F18 | Slack 카드 이미지 | 제외 |
| F19 | 카드 예시 코드와 미니 미리보기 | 구현 (기획 후 추가) |

**디자인: 다크 IDE (B안 확정)**

- 코드 에디터 화면처럼 보인다. 사이드바 = 버전 목록, 파일 탭 = 카테고리, 상태 표시줄 = Stable·Beta·다음 출시.
- 기능 카드는 diff 한 줄처럼 왼쪽에 `+`(신규) `~`(변경) `-`(제거) 기호 칸을 둔다.
- 어두운 테마가 기본이고 밝은 테마로 바꿀 수 있다.
- A안(신문 1면)은 시안 비교 후 채택하지 않았다.

## 6. 기술 스택과 데이터 모델

서버 없는 정적 사이트에, Git 저장소를 데이터베이스로 쓴다. 모든 변경이 PR 이력으로 남는다.

| 영역 | 사용 |
| --- | --- |
| 사이트 | Next.js 16 (정적 내보내기), TypeScript |
| 호스팅 | GitHub Pages |
| 스케줄러 | GitHub Actions (매일 1회) |
| 감지·검사 스크립트 | Node.js 24 (TypeScript 그대로 실행) |
| 실제 브라우저 검사 | Playwright + Chrome Stable·Beta |
| 형식 검사 | Zod 스키마 (빌드 시) |
| 내용 작성 | 사람 + Claude Code (`CLAUDE.md` 절차) |

**저장소 구조**

```
content/releases/<버전>.json   # 버전 정보 (stable 날짜, beta/stable, 머리말)
content/features/<slug>.json   # 기능 항목
content/pipeline-state.json    # 싣지 않기로 한 기능과 이유
scripts/pipeline/              # 감지 · 초안 · 검사 · PR 본문
.github/workflows/             # 자동 업데이트 · PR 검사 · 배포
CLAUDE.md                      # 새 버전 정리 절차와 작성 규칙
```

**기능 데이터 예시** (`content/features/text-decoration-inset.json`, 일부)

```json
{
  "slug": "text-decoration-inset",
  "chromestatusId": 5178263526834176,
  "title": "CSS `text-decoration-inset`",
  "category": "css",
  "impact": "new",
  "status": "shipped",
  "milestone": 157,
  "history": [
    { "milestone": 154, "channel": "mention", "note": "New in Chrome 154 글에 소개됨" },
    { "milestone": 157, "channel": "stable", "note": "ChromeStatus 기준 기본 활성화" }
  ],
  "summaryKo": "밑줄·윗줄·취소선의 시작과 끝 위치를 안쪽이나 바깥으로 조절한다.",
  "exampleCode": "a {\n  text-decoration: underline;\n  text-decoration-inset: 10px;\n}",
  "featureTest": { "kind": "css", "decl": "text-decoration-inset: 10px" },
  "preview": { "html": "<a>크롬 위클리 제157호</a>", "css": "a { font: 600 18px var(--sans); }" },
  "support": { "firefox": "146", "safari": null },
  "needsCheck": [],
  "sources": ["https://chromestatus.com/feature/5178263526834176"]
}
```

- `featureTest`: 기능 지원 여부를 확인하는 식. 미리보기 표시와 실제 Chrome 검사에 쓴다.
- `preview`: 카드 미니 미리보기용 HTML과 바탕 CSS. 예시 코드를 그 위에 적용한다.
- `needsCheck`: 근거가 부족한 필드. 상세 페이지에 "확인 필요"로 표시한다.

## 7. 운영

새 Beta 버전마다(약 2주 간격) 한 번 정리한다. 한 버전 정리에 30분 이내가 목표다.

**검수 체크리스트**

- [ ] 요약과 예시 코드에 원문에 없는 내용이 없는가
- [ ] 뺀 기능마다 이유가 적혀 있는가
- [ ] Deprecated·제거 항목에 대응 방법이 있는가
- [ ] `featureTest`(js 식)와 `preview.html`에 `<script>`, `on...=` 속성, `javascript:` 주소가 없는가 (방문자 브라우저에서 그대로 실행된다)
- [ ] PR의 실제 Chrome 검사 경고를 확인했는가

**출처 표기**: 원문을 번역해 옮기지 않고 한국어로 새로 쓴다. 모든 기능에 원문 링크를 달고, 페이지 하단에 데이터 출처(ChromeStatus, MDN browser-compat-data, web-features, Chromium Dash)를 적는다. 외부에 공개할 때는 각 소스의 이용 조건을 확인한다.

**리스크와 대응**

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| ChromeStatus 응답 형식이 바뀜 (비공식 API) | 감지가 멈춤 | 감지 실패는 Actions 실행 실패로 드러난다. 스크립트의 조회 부분(`lib.ts`)만 고치면 된다 |
| ChromeStatus 정보가 실제와 다름 | 잘못된 "출시됨" 표시 | 실제 Chrome 검사로 Stable에서 꺼진 기능을 "출시 연기"로 바꾼다 |
| 서버 설정으로 단계적으로 켜는 기능 | 자동 검사와 사용자 Chrome이 다름 | PR과 README에 한계를 적어 두고, 의심되면 사람이 직접 확인한다 |
| 2주마다 정리하는 부담 | 게시가 늦어짐 | 범위를 엄격히 지킨다. 상태만 바뀌는 PR은 자동 병합한다. Claude Code로 정리 시간을 줄인다 |
| 검수 대기 PR을 오래 둠 | 상태 변경도 반영되지 않음 | 새 버전 PR은 가능한 빨리 정리해 병합한다 |

## 8. 일정과 성공 지표

**진행 상황**

- **G1** (수집·분류): 완료. Chrome 155~158 기능을 ChromeStatus 목록과 대조해 정리했다.
- **G2** (팀 검토): 진행 전. 프론트엔드 팀원 3명 이상이 155~158 페이지를 검토한다.
- **G3** (사람 없이 감지부터 PR까지 1회): 첫 자동 실행 대기 중.

**성공 지표**

| 지표 | 목표 | 측정 방법 |
| --- | --- | --- |
| 새 Beta 버전 출시 후 게시까지 | 2영업일 이내 | Chromium Dash 날짜와 PR 병합 시각 비교 |
| 누락된 기능 | 0개 (범위 안 기능 기준) | ChromeStatus 목록과 대조 (제외 목록 포함) |
| 게시 후 정정 | 버전당 1건 이하 | 정정 PR 수 |
| 정리 시간 | 버전당 30분 이내 | PR 생성과 병합 사이 시간 |
| 팀 사용 | 프론트엔드 팀원 절반 이상이 월 1회 이상 방문 | 사이트 방문 통계 |

## 부록. Chrome 155~158 정리 결과

| 버전 (stable) | 구분 | 항목 | 비고 |
| --- | --- | --- | --- |
| 158 (11월 17일 예정, 베타) | CSS | `::highlight(*)` | |
| 158 | CSS | `flow-start` · `flow-end` 정렬 키워드 | |
| 158 | CSS | 미디어 상태 의사 클래스 `:playing` 등 | |
| 158 | CSS | `circle()`·`ellipse()`의 `closest-corner` 등 | |
| 158 | 동작 변경 | `<object>`·`<embed>` SVG에 `object-fit` 적용 | |
| 158 | JS·API | 웹 앱 설치 `navigator.install()` · `<install>` | 원문 2개를 한 항목으로 |
| 158 | JS·API | 권한 정책 `focus-without-user-activation` | |
| 158 | JS·API | SVG `<textPath>`의 `side` 속성 | |
| 158 | 제거 | XSLT 제거 | 예외 허용은 176까지 |
| 157 (11월 3일) | CSS | `corner` 단축 속성 | 155 베타 공지 → 157 출시 |
| 157 | CSS | `text-decoration-inset`, `text-overflow: <string>`, `position-visibility` | |
| 157 | JS·API | HTML-in-canvas, HTML 삽입·스트리밍, Long Animation Frames | |
| 157 | 동작 변경 | Background Fetch CORS 적용 | |
| 156 (10월 20일) | CSS | `random()`, `overflow: scroll clip`, `scroll-snap-type: pair` | |
| 156 | JS·API | 실패한 모듈 재시도, IndexedDB SQLite 백엔드 | 모듈 재시도: 155 베타 공지 → 156 출시 |
| 156 | 제거 | Fenced frame, `window.fence` no-op | |
| 155 (10월 6일) | CSS | `margin-trim`, `symbols()` | |
| 155 | CSS | `text-decoration-skip-spaces`, `display-state`·`resizable` | **출시 연기**: Chrome 156에서도 기본 비활성 |
| 155 | JS·API | 텍스트 모듈, JPEG XL, 보이지 않는 iframe 미디어 정책 | |

158에서 뺀 기능 10개(WebTransport 6개, Direct Sockets, Android WebHID, `OfflineAudioContext`, `<install>` 별도 항목)는 `content/pipeline-state.json`에 이유와 함께 있다.

## 출처

- [ChromeStatus](https://chromestatus.com/roadmap), [Chromium Dash](https://chromiumdash.appspot.com/schedule)
- [Chrome 155 Release Notes – ChromeStatus](https://chromestatus.com/release-notes/155)
- [Chrome 157 beta – Chrome for Developers](https://developer.chrome.com/blog/chrome-157-beta)
- [Deprecating XSLT – Chrome for Developers](https://developer.chrome.com/docs/web-platform/deprecating-xslt)
- [Install element / Web Install API 스펙](https://wicg.github.io/install-element)
- [MDN browser-compat-data](https://github.com/mdn/browser-compat-data), [web-features](https://github.com/web-platform-dx/web-features)
