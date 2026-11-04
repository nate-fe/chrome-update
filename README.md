# chrome-update

Chrome 웹 플랫폼 변경사항을 한국어로 정리하는 정적 사이트입니다. 기획: `Chrome 웹 플랫폼 변경사항 자동 안내 페이지 기획서.md`

- Next.js 16 (App Router, `output: 'export'`) + TypeScript + Zod, 배포는 GitHub Pages
- 디자인: B안 "다크 IDE"로 확정 (파일 탭 = 카테고리, diff 표기, 상태 표시줄). 어두운 테마가 기본, 밝은 에디터 테마 선택.
  A안(신문 1면)은 시안 비교 후 채택하지 않았다.

## 실행

Node 24 이상이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 정적 결과물은 out/
npm run typecheck
```

## 구조

```
content/releases/<버전>.json     # 버전 메타 (stable 날짜, beta/stable, 머리말)
content/features/<slug>.json     # 기능 항목 (한국어) — 빌드 시 Zod로 검증
content/pipeline-state.json      # 자동 파이프라인이 싣지 않기로 한 ChromeStatus 기능과 이유
glossary.json                    # 용어집 (아직 화면에서 쓰지 않음)
src/lib/schema.ts                # 콘텐츠 스키마
src/app/                         # 페이지 (/, /chrome/[version], /features, /features/[slug], /compare, /feed.xml)
src/components/                  # 화면 조각 (기능 카드, 미니 미리보기, 라이브 데모, 퀴즈 등)
scripts/pipeline/                # 자동 업데이트 스크립트 (아래 참고)
.github/workflows/               # 자동 업데이트 · PR 검사 · 배포
```

콘텐츠 JSON이 스키마에 맞지 않으면 `npm run build`가 실패합니다. `needsCheck`에 적힌 필드는 상세 페이지에 "확인 필요"로 표시됩니다.
개발 서버는 콘텐츠 JSON을 매번 새로 읽으므로, 파일을 고치면 새로고침만 하면 됩니다.

## 화면 구성

**버전 페이지 (`/chrome/<버전>`)**

- 파일 탭으로 카테고리를 나눈다: `css.diff`, `js.diff`, `removed.md`, `origin-trial.md`. 탭을 누르면 맨 위로 스크롤된다.
- 기존 코드가 깨질 수 있는 변경은 맨 위 경고 배너와 목록 맨 앞에 둔다.
- 하단에 "내 브라우저에서 바로 쓸 수 있는 기능" 점수와 "몇 버전부터?" 퀴즈가 있다.

**기능 카드** (버전 페이지, 홈, 검색, 비교 목록에 공통)

- 제목 앞 말머리: `CSS`, `JS · API`, `Deprecated · 제거`
- 영향도 배지: `신규 · 안전`, `동작 변경 · 확인 필요`, `제거 · 대응 필수`. 연기된 기능에는 `연기 이력` 또는 `출시 연기 · 아직 기본 비활성`이 붙는다.
- 예시 코드: CSS(폭 320px)와 JS · API(폭 560px) 카드에 짧은 코드를 보여준다.
- 미니 미리보기 (CSS만): 예시 코드를 실제 HTML에 적용한 모습. 기능별 HTML은 각 JSON의 `preview`에 있다.
  - 내 Chrome 버전보다 새 버전의 기능에는 보이지 않는다. 지나간 버전은 그대로 보인다.
  - Chromium 기반이 아닌 브라우저에서 미지원이면 "적용 전 모습"이라고 표시한다.
- 출시가 연기된 기능은 예시 코드와 미리보기를 숨긴다. 상세 페이지에는 그대로 있다.

**기능 상세 (`/features/<slug>`)**: 왜 중요한가, 라이브 데모와 슬라이더, Before/After diff, 대응 가이드, 다른 브라우저 지원, 기능의 여정(베타 공지 → 연기 → 출시), 원문 링크.

**그 밖**

- 우측 상단 칩: "이 브라우저는 Chrome 156 버전입니다." 누르면 전체 버전과 OS, 최신 stable과의 차이를 보여준다.
- 홈: 다음 출시까지 남은 날, 주의가 필요한 변경, 버전별 목록. 내 브라우저 버전에 맞춘 안내 배너.
- 검색(`/features`): 이름·요약 검색과 카테고리·상태·Baseline·버전 범위 필터. 필터는 주소에 남아 공유할 수 있다.
- 비교(`/compare`): 두 버전 사이의 추가·변경·제거 목록.
- RSS(`/feed.xml`): 링크 도메인은 `SITE_URL` 환경 변수로 지정한다.

## 구현된 요구사항 (기획서 기준)

F1 버전 페이지·카테고리 탭, F2 기능 카드, F3 Deprecated·제거 우선 표시, F4 연기 이력, F5 내 브라우저 버전 감지,
F6 버전 비교, F7 검색·필터, F8 RSS(Slack은 아직 없음), F11 라이브 데모 + 슬라이더, F12 내 브라우저 지원 점수,
F13 Before/After diff, F15 기능의 여정, F16 "몇 버전부터?" 퀴즈.

기획 단계 이후 화면에서 뺀 것: 상태 배지(출시됨·곧 나옴), 카드의 "내 브라우저 ✓/✗" 배지, 게임 패치노트식 태그(`#nerf` 등, 데이터의 `tags`는 남아 있음), 버전 헤더의 이전·다음 버튼.

## 자동 업데이트 파이프라인 (GitHub Actions)

기획서 4장의 파이프라인입니다. 매일 09:00(한국 시간)에 `.github/workflows/update-content.yml`이 실행됩니다.

| 단계 | 스크립트 | 하는 일 |
|---|---|---|
| 1. 감지 | `scripts/pipeline/detect.ts` | Chromium Dash로 stable·beta 버전과 날짜를 맞추고, 베타였던 기능을 '출시됨'으로 바꾸고, ChromeStatus 목록에서 출시 버전이 바뀐 기능과 새 기능 후보를 찾는다 |
| 4. 초안 | `scripts/pipeline/draft.ts` | 새 후보마다 Claude(`claude-opus-5-5`)가 한국어 요약·예시 코드·감지 식·미리보기 HTML을 쓰거나, 싣지 않을 이유를 적는다. 새 버전 머리말도 쓴다 |
| 검사 | `npm run build` | Zod 스키마 검사 |
| 5. 실제 Chrome 검사 | `scripts/pipeline/verify.ts --fix` | Chrome Stable·Beta에서 감지 식을 돌려 '출시됨'이 맞는지 확인하고(Stable에서 미지원이면 '출시 연기'로 변경), CSS 미리보기를 예시 코드 적용 전/후로 찍어 비교한다 |
| PR | `scripts/pipeline/report.ts` | 변경·초안·경고를 정리한 PR을 연다. 스크린샷은 실행 결과의 `preview-screens` 아티팩트 |

- **상태·날짜만 바뀐 PR**(예: 베타 → 출시됨)은 경고가 없으면 바로 병합하고 배포한다.
- **새 기능 초안이나 내용 변경이 있는 PR**은 `needs-review` 라벨이 붙고, 사람이 승인해 `main`에 병합해야 배포된다. 검수 대기 PR이 열려 있는 동안에는 자동 실행이 쉰다.
- 싣지 않기로 한 ChromeStatus 기능은 `content/pipeline-state.json`에 이유와 함께 남는다. 다시 검토하려면 그 줄을 지운다.
- 자동 검사는 새 프로필의 Chrome으로 돌리므로, Google이 서버 설정(Finch)으로 단계적으로 켜는 기능은 실제 사용자 Chrome과 결과가 다를 수 있다.

로컬에서 단계별로 실행할 수 있습니다 (Node 24 이상):

```bash
node scripts/pipeline/detect.ts
ANTHROPIC_API_KEY=... node scripts/pipeline/draft.ts
node scripts/pipeline/verify.ts            # VERIFY_CHANNELS=chromium 이면 Playwright 전용 Chromium 사용
node scripts/pipeline/report.ts            # pipeline-out/pr-body.md
```

### 처음 한 번 설정

1. GitHub 저장소를 만들고 이 프로젝트를 `main` 브랜치로 올린다.
2. **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꾼다.
3. **Settings → Actions → General → Workflow permissions**에서 **Allow GitHub Actions to create and approve pull requests**를 켠다.
4. **Settings → Secrets and variables → Actions**에 `ANTHROPIC_API_KEY`를 추가한다. 없으면 초안 단계만 건너뛰고 나머지는 동작한다.
5. **Actions → 콘텐츠 자동 업데이트 → Run workflow**로 첫 실행을 한다.

배포 워크플로(`deploy.yml`)는 `main`에 push될 때마다 실행되며, `https://<user>.github.io/<repo>/` 경로에 맞춰 빌드한다.

### 첫 실행에서 올라올 PR

지금 콘텐츠는 Chrome 157이 베타일 때 기준입니다. 첫 실행은 다음 내용을 담은 PR을 엽니다.

- Chrome 157 beta → stable, 157 기능 8개 '출시됨' 전환
- Chrome 158 베타 추가 (머리말은 초안이 없으면 "정리 중")
- 158 새 기능 후보 약 19개: API 키가 있으면 Claude 초안, 없으면 후보 목록만

158 추가가 들어 있어 자동 병합되지 않습니다(`needs-review`). 확인 후 승인하면 배포됩니다.

### 설정값 (환경 변수)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 없음 | 초안 단계에 필요. 없으면 초안 단계를 건너뛴다 |
| `DRAFT_MODEL` | `claude-opus-5-5` | 초안을 쓰는 Claude 모델 |
| `MAX_DRAFTS` | `20` | 한 번에 초안을 쓸 후보 수 (남은 후보는 다음 실행으로) |
| `VERIFY_CHANNELS` | `chrome,chrome-beta` | 검사할 Playwright 브라우저 채널 |
| `PAGES_BASE_PATH` | 없음 | 배포 하위 경로. 배포 워크플로가 자동으로 넣는다 |
| `SITE_URL` | 예시 도메인 | RSS·PR 링크의 사이트 주소 |

초안 비용은 후보 하나에 수 센트 수준입니다. 버전당 후보가 10~20개라서 새 버전마다 1달러 안팎입니다.
