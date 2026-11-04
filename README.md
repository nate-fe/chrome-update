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

## 자동 업데이트

GitHub Actions가 매일 09:02(한국 시간)경에 다음을 합니다.

1. 새 버전 추가, 베타 → stable 전환, 출시 연기를 감지한다.
2. 실제 Chrome으로 지원 여부와 미리보기를 검사한다.
3. 결과를 PR(`content/auto-update` 브랜치)로 올린다.

- 상태만 바뀐 PR은 자동으로 병합·배포됩니다.
- 새 버전이 들어간 PR은 사람이 정리하고 병합해야 배포됩니다. 그동안 자동 실행은 쉽니다.
- 비용 때문에 Claude API 키는 쓰지 않습니다. 새 기능 내용은 사람이 채웁니다.

**처음 한 번 설정**

1. Settings → Pages → Source를 **GitHub Actions**로 바꾼다.
2. Settings → Actions → General에서 **Allow GitHub Actions to create and approve pull requests**를 켠다.
3. Actions → **콘텐츠 자동 업데이트** → Run workflow로 첫 실행을 한다.

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
