# chrome-update

Chrome의 웹 플랫폼 변경사항(CSS, JS·API, 제거)을 버전별로 한국어로 정리하는 정적 사이트입니다.
Next.js 16 · TypeScript · GitHub Pages. 기획서: `Chrome 웹 플랫폼 변경사항 자동 안내 페이지 기획서.md`

## 실행

Node 24 이상이 필요합니다.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # out/ 에 정적 사이트 생성 (콘텐츠 형식 검사 포함)
```

## 콘텐츠

| 경로 | 내용 |
|---|---|
| `content/releases/<버전>.json` | 버전 정보 (stable 날짜, beta/stable, 머리말) |
| `content/features/<slug>.json` | 기능 항목 (형식: `src/lib/schema.ts`) |
| `content/pipeline-state.json` | 싣지 않기로 한 ChromeStatus 기능과 이유 |

## 서비스 점검

제거·동작 변경 기능을 서비스 코드에서 쓰는 곳을 찾아 위치(파일:줄:열)를 알려 줍니다.

```bash
node scripts/audit/scan.ts --files files.json     # 목록의 CSS·JS 파일만 받아 검사 (자동 점검은 이 방식)
node scripts/audit/scan.ts ../my-service/src      # 소스 폴더 검사
node scripts/audit/scan.ts https://www.nate.com/  # 페이지를 열어 검사 — 실제 방문이라 PV·광고·통계에 잡힘
```

- **규칙:** 기능 JSON의 `scan`과 [`scripts/audit/legacy-rules.json`](scripts/audit/legacy-rules.json)의 정규식으로 HTML·CSS·JS를 찾습니다. `legacy-rules.json`에는 이 사이트가 다루기 전부터 Chrome이 경고하던 기능(동기 XHR, unload 이벤트, `document.domain` 설정, Mutation Events)이 들어 있습니다.
- **파일 목록 방식 (`--files`):** 목록의 파일만 HTTP로 받고 스크립트는 실행하지 않습니다. 광고 응답(`cyad*.nate.com`)과 확장자 없는 서버 응답은 받지 않습니다. 목록 형식은 `{ "pages": [{ "name", "device", "files": [{ "type": "css"|"js", "url" }] }] }`입니다.
- **페이지 방식 (URL):** Playwright Chromium으로 페이지를 열어 Chrome이 내는 deprecation 경고까지 모읍니다. 실제 방문이라 서비스 점검에는 쓰지 않습니다.
- 옵션: `--targets 목록.txt`(URL·폴더를 한 줄에 하나), `--own nate.com,nateimg.co.kr`(우리 도메인, 나머지는 외부로 분류), `--out 폴더`(기본 `audit-out/`)
- 결과: `audit-out/result.json`, `audit-out/report.html`. **점검 결과는 이 공개 저장소에 올리지 않습니다.**
- 알림: `node scripts/audit/notify.ts <이번 result.json> [지난 result.json] [--send]`는 지난 결과와 비교해 팀룸 메시지를 만듭니다. `--send`를 주고 새로 생기거나 해결된 "수정 필요"가 있으면 `TEAMROOM_WEBHOOK_URL`로 보냅니다. 매일 실행과 알림은 비공개 저장소 `nate-fe/chrome-update-audit`의 Actions가 맡습니다.

## 자동 업데이트

GitHub Actions가 매일 09:02(한국 시간)경에 다음을 합니다.

1. 새 버전 추가, 베타 → stable 전환, 출시 연기를 감지한다.
2. 실제 Chrome으로 지원 여부와 미리보기를 검사한다.
3. 결과를 PR(`content/auto-update` 브랜치)로 올린다.

- 상태만 바뀐 PR은 자동으로 병합·배포됩니다.
- 새 버전이 들어간 PR은 사람이 정리하고 병합해야 배포됩니다. 그동안 자동 실행은 쉽니다.
- 새 버전이 들어간 PR이 새로 열리면 네이트온 팀룸으로 "[Chrome 변경 정리]" 제목과 "Chrome 159 버전이 나와 정리가 필요합니다." 두 줄을 보냅니다 (`scripts/pipeline/notify-pr.ts`). 새 버전이 없는 PR은 알리지 않습니다.
- 비용 때문에 Claude API 키는 쓰지 않습니다. 새 기능 내용은 사람이 채웁니다.

**처음 한 번 설정**

1. Settings → Pages → Source를 **GitHub Actions**로 바꾼다.
2. Settings → Actions → General에서 **Allow GitHub Actions to create and approve pull requests**를 켠다.
3. Settings → Secrets and variables → Actions에 **`TEAMROOM_WEBHOOK_URL`**(네이트온 팀룸 웹훅)을 넣는다. 없으면 팀룸 알림만 건너뜁니다.
4. Actions → **콘텐츠 자동 업데이트** → Run workflow로 첫 실행을 한다.

## 새 버전이 나오면 할 일

자동 PR이 열리면(약 2주마다), 이 프로젝트를 Claude Code로 열고 이렇게 말합니다.

```
158 정리해줘
```

Claude Code가 `CLAUDE.md`의 절차대로 후보를 정리하고, 결과를 보고한 뒤 커밋할지 묻습니다. 승인한 뒤 PR을 병합하면 배포됩니다.

직접 할 때는 PR 본문의 "아직 정리하지 않은 후보"마다 다음 중 하나를 합니다.

- **싣는다:** `content/features/<slug>.json` 작성. `chromestatusId`를 꼭 넣는다.
- **뺀다:** `content/pipeline-state.json`의 `ignored`에 `"<ID>": "<이유>"` 추가.

그다음 `content/releases/<버전>.json`의 머리말을 쓰고 `npm run build`가 통과하면 병합합니다.

**검수할 때 주의:** `featureTest`(js 식)와 `preview.html`은 방문자 브라우저에서 그대로 실행됩니다. `<script>`, `on...=` 속성, `javascript:` 주소가 없는지 확인하세요.
