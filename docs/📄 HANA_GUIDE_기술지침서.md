# HANA_GUIDE 체험관 SPA-lite 기술지침서 (업데이트: 2026-01-07)

본 문서는 `/cont/guide/index.html`에서 동작하는 SPA-lite 구조를 기준으로 작성되었습니다. 구형 브라우저 호환을 위해 전체 코드는 ES5와 `XMLHttpRequest`만 사용합니다.

---

## 1. 시스템 개요
- 하나의 HTML에서 `Store → Router → App` 순서로 초기화됩니다.
- 라우팅은 해시 기반이며, 각 화면은 HTML 파셜을 XHR로 불러와 삽입합니다.
- 정적 리소스는 모두 절대 경로(`/cont/resource/...`)로 로드합니다.
- 업무별 체험(Stage) 화면은 iframe으로 완전히 외부화되어 별도 스크립트가 제어합니다.
- 라우터가 로드하는 주요 파셜은 `/cont/guide/components/intro.html`, `/cont/guide/components/onboarding.html`, `/cont/guide/components/workflow.html`, `/cont/guide/components/menu.html`입니다.
- 세부 시나리오 화면은 `/cont/guide/pages/**` 하위에 위치한 독립 HTML이며, workflow iframe에서만 참조합니다.

## 2. Store
- 현재 페이지(`state.currentPage`)만 관리하는 단순 Pub/Sub 구조입니다.
- `setPage(page)`는 중복 변경을 방지하고 변화가 있을 때만 `notify()`로 모든 구독자를 호출합니다.
- App은 `Store.subscribe`로 헤더 상태를 갱신합니다.

## 3. Router
- `routes`: 라우트 이름과 HTML 경로(절대 경로)를 매핑합니다.
- `pageMeta`: 페이지별 제목, 뱃지 정보(`text`, `className`), `showHome`, `showMenu` 플래그를 정의합니다.
- `init(callbacks)`: 해시 변경을 감지해 HTML을 로드하고 `callbacks.onRendered(page, meta)`를 호출합니다.
- Router는 App을 직접 알지 못하고, 콜백을 통해 결과만 전달합니다.

## 4. App
### 4.1 초기화
1. `loadHeader()`로 `/cont/guide/components/header.html`을 로드합니다.
2. Router를 `App.handleRouteRendered` 콜백과 함께 초기화합니다.
3. `Store.subscribe`로 헤더 상태를 동기화합니다.

### 4.2 헤더 갱신
- `updateHeaderState(page)` → `updateHeaderBadge(page)` + `updateHeaderNavigation(page)` 조합입니다.
- 홈/메뉴 버튼 노출은 `Router.pageMeta`의 `showHome`, `showMenu` 플래그로 결정합니다.

### 4.3 페이지 스크립트 실행
- `runPageScripts()`는 기존 컨트롤러를 파괴한 뒤 DOM에 존재하는 영역만 새로 생성합니다.
- 현재 활성 컨트롤러: `onboarding`, `menu`, `workflow`.

### 4.4 모듈 역할 요약
| 모듈 | 책임 |
| --- | --- |
| onboarding | `data-onboarding-*` 속성을 가진 영역에서 스텝 전환, dot, hero 버튼, 탭을 제어합니다. |
| menu | `data-menu-page` 내에서 탭 버튼 ↔ 컨텐츠 섹션 스크롤을 동기화합니다. |
| workflow | LNB/툴팁/iframe src만 관리하며, 실제 스테이지 기능은 iframe 내부 스크립트가 담당합니다. |
| dialog | 다이얼로그 파셜을 로드하고 `data-navigate`/`data-dialog-close` 트리거를 처리합니다. |

### 4.6 Onboarding 새로고침 복원
- 온보딩은 마지막 스텝을 `sessionStorage.onboardingStep`에 저장합니다.
- 새로고침일 때만 저장값을 복원하고, 일반 진입 시에는 항상 hero(0)로 시작합니다.
- 일반 진입 시 탭 상태도 `onboardingTab:1~3` 키를 초기화합니다.

### 4.5 App 내비게이션(data-navigate)
App에서만 사용하는 공통 내비게이션 규칙입니다.

```html
<button type="button" data-navigate="workflow:b2b-loan">시작하기</button>
```

- `workflow:ID`: 업무별 체험 라우팅(`App.openWorkflow`).
- `hash:intro` 또는 단순 `intro`: 해시 라우팅.
- `url:https://example.com`: 전체 URL 이동.

## 5. Workflow 모듈 상세
- LNB(`data-flow`) 내부에서 `data-steps` 리스트와 `data-step` 항목을 동적으로 만들고, JSON의 `steps` 데이터를 매칭해 활성 상태를 표시합니다.
- `iframe.stage`의 `src`와 `title`만 갱신하며, iframe 내부 DOM에는 접근하지 않습니다.
- 툴팁 영역(`data-tooltip`)은 iframe에서 전달되는 이벤트로만 갱신합니다.
- iframe과의 통신을 위해 `App.workflowBridge`를 노출합니다.
- 새로고침 시 마지막 선택 메뉴를 유지하기 위해 `sessionStorage.workflowMenuId`를 사용합니다.

## 5.1 Start 안내 팝업(start.html)
- 모든 메뉴 클릭 시 `start.html` 팝업이 먼저 노출됩니다.
- 팝업 제목/본문은 `menu.json`의 `title`, `info`, `infoList`를 바인딩해 렌더링됩니다.
- 팝업 타이틀은 `data-dialog-menu`로 바인딩되며 줄바꿈 없이 한 줄로 표시됩니다.
- `info`가 있으면 문단(`data-dialog-info`)을 표시하고, `infoList`가 있으면 목록(`data-dialog-list`)을 추가로 표시합니다.
- 시작하기 버튼(`data-dialog-start`)은 `workflow:pageId`로 자동 연결됩니다.
- 메뉴 클릭 시점에 `menu.json`이 로드되지 않았으면 `App.ensureWorkflowPages()`로 선로딩 후 팝업을 엽니다.

### 5.2 iframe ↔ App 통신 규약
iframe 페이지는 동일 출처 조건에서 아래 함수를 호출할 수 있습니다.

```js
var bridge = parent.App && parent.App.workflowBridge;
if (bridge) {
  bridge.notify({ type: 'tooltip', data: '다음 버튼을 눌러주세요' });
  bridge.notify({ type: 'autoplay', data: false });
  bridge.notify({ type: 'finish' });
}
```

- `notify({ type, data })`: iframe → App으로 상태/이벤트를 전달합니다.
  - `type: 'tooltip'`: 툴팁 문구 변경.
  - `type: 'autoplay'`: 자동재생 상태 변경(`true/false`).
  - `type: 'finish'`: 현재 스텝 자동재생 종료 알림.
- `getAutoPlayState()`: App이 보관 중인 자동재생 상태를 반환합니다.

#### 5.2.1 체험 종료 팝업(finish.html)
- 체험 종료 팝업은 App이 관리하며, iframe 통신 규약에는 포함하지 않습니다.
- `notify({ type: 'finish' })`를 받으면 App이 현재 스텝이 마지막인지 판단해 finish 팝업을 분기합니다.
- `finish.html`은 `data-dialog-type="step|menu"`로 구분되어 한 파일에서 분기 렌더링됩니다.
- `data-dialog-menu`는 현재 메뉴명을, `data-dialog-step`은 현재 스텝 번호를 자동 바인딩합니다.
- `finishBreak: true`가 있는 메뉴는 완료 문구에서 메뉴명 뒤에 줄바꿈을 강제로 삽입합니다.

## 6. 메뉴 데이터 스키마
`cont/guide/data/menu.json`은 LNB와 workflow 진입을 위한 데이터입니다. 모든 메뉴는 `a` 텍스트 기준으로 생성되며, iframe은 `steps[].page`에 해당하는 HTML을 로드합니다.

```json
{
  "pages": [
    {
      "pageId": "inq0000",
      "category": "조회",
      "title": "보유계좌 조회",
      "pdfUrl": "",
      "info": "보유계좌 조회 팝업 텍스트",
      "infoList": [
        "보유계좌 조회 안내 항목 1",
        "보유계좌 조회 안내 항목 2"
      ],
      "finishBreak": true,
      "steps": [
        { "id": "inq0001", "title": "보유계좌 조회 첫 번째 스텝", "subtitle": "", "page": "inq/inq0000.html" },
        { "id": "inq0002", "title": "보유계좌 조회 두 번째 스텝", "subtitle": "", "page": "inq/inq0000.html" },
        { "id": "inq0003", "title": "보유계좌 조회 세 번째 스텝", "subtitle": "", "page": "inq/inq0000.html" }
      ]
    }
  ]
}
```

- `pageId`: 메뉴 식별자(라우팅/저장 키).
- `category`: LNB 상단 카테고리 라벨.
- `title`: 메뉴명(줄바꿈 `\n` 지원, start 팝업 타이틀은 한 줄 렌더링).
- `pdfUrl`: PDF 다운로드 경로(없으면 빈 문자열).
- `info`: start 팝업 본문 텍스트(`\n` 줄바꿈 지원).
- `infoList`: start 팝업 목록(배열, 항목별 `\n` 줄바꿈 지원).
- `finishBreak`: 완료 팝업에서 메뉴명 뒤 줄바꿈 필요 시 `true`.
- `steps`: workflow 스텝 배열.
  - `id`: 스텝 식별자.
  - `title`: 스텝 제목(`\n` 줄바꿈 지원).
  - `subtitle`: 스텝 보조 제목(옵션).
  - `page`: iframe에 로드할 HTML 경로. 절대 경로가 아니면 `/cont/guide/pages/` 기준으로 보정됩니다.
- 추가 데이터(터치포인트, 자동재생 등)는 **각 HTML에서 직접 관리**합니다.

## 7. 개발 규칙
1. **ES5 문법 고정**: `var`, 함수 선언, 콜백 패턴을 사용하고 화살표 함수/async는 금지.
2. **XHR 전용**: 데이터 로드는 `App.requestHtml`, `App.requestJson`, `Router.request`만 사용.
3. **절대 경로 사용**: `/cont/...` 형태로 모든 리소스를 불러옵니다.
4. **UTF-8 저장**: 한글이 깨지지 않도록 파일 인코딩을 UTF-8로 유지합니다.
5. **문서 동기화**: 구조 변경 시 README와 본 지침서를 항상 동시에 업데이트합니다.
6. **iframe 독립성**: App은 iframe 내부 로직에 관여하지 않으며, 필요한 경우 `App.workflowBridge`를 통해 신호만 주고받습니다.
7. **테스트 팝업**: 실제 배포 전에 `cont/guide/test.html`을 사용해 팝업 UX를 검증합니다.

---

> 이 문서는 현재 코드 구조(2025-12-23 기준)를 토대로 작성되었습니다. 이후 설계가 변경되면 동일한 형식으로 갱신해 주십시오.

