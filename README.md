# 맛밥 (Matbab)

> 리뷰를 다 읽지 않아도 실제 평판을 빠르게 파악하는 맛집 리뷰 서비스

랜딩페이지와 실제 검색·리뷰·AI 분석 기능까지 구현된 프로젝트입니다. 별도 프레임워크·빌드 도구 없이 정적 HTML + Vercel 서버리스 함수만으로 이루어져 있습니다.

## 지금 되는 것

- **랜딩페이지** (`index.html`) — 히어로, 인기 맛집 카드, 최근 리뷰, 서비스 특징, 푸터. 인기 맛집 카드·최근 리뷰는 아직 목업 데이터입니다.
- **맛집 검색** (`search.html`) — 카카오 로컬 API로 키워드/카테고리 실검색.
- **구글 리뷰 보기** — 검색 결과 카드를 클릭하면 모달로 해당 가게의 구글 평점·리뷰(작성자/별점/작성일/내용)를 보여줍니다. Google Places API **(New)**, 좌표 150m(도보 2분) 반경 안의 매장만 조회.
- **AI 리뷰 분석** — 리뷰가 뜨면 자동으로 Gemini API가 이어서 분석해 긍정/보통/부정 비율 막대, 핵심 단어 워드클라우드, 한 줄 총평을 보여줍니다. 리뷰가 없는 가게는 분석을 건너뜁니다.
- 조회한 가게의 리뷰·AI 분석 결과는 브라우저(`localStorage`)에 캐싱되어 재클릭 시 API를 다시 부르지 않습니다.

나머지 로드맵(대시보드, 로그인)은 아직 구현되지 않았습니다 — 자세한 순서는 [`PRD.md`](./PRD.md) 참고.

## 아키텍처

- 프런트엔드는 빌드 도구 없는 순수 HTML/CSS/JS 두 파일(`index.html`, `search.html`)이며, 스타일은 Tailwind CDN + 인라인 config로 처리합니다.
- 카카오/구글/Gemini API 키는 브라우저에 노출되지 않습니다. `api/` 아래 세 개의 Vercel 서버리스 함수(zero-config, 별도 설정 불필요)가 각 API를 대신 호출하고, 키는 Vercel 프로젝트 환경변수에서 `process.env`로 서버 사이드에서만 읽습니다.
  - `api/kakao-search.js` — 카카오 로컬 API 프록시
  - `api/google-reviews.js` — Google Places API (New) 프록시
  - `api/analyze-reviews.js` — Gemini API 프록시(구조화 출력으로 감성 분석)
- 로컬에서 정적 서버(예: VSCode Live Server)로 열면 서버리스 함수가 없어 `/api/...` 요청이 404가 나는데, 그 경우에만 `.env.local`의 키로 브라우저가 각 API를 직접 호출하는 폴백으로 전환됩니다. 이 폴백은 로컬 개발 전용이며 프로덕션에서는 쓰이지 않습니다.

자세한 설계 배경과 구현 규칙은 [`CLAUDE.md`](./CLAUDE.md)에 정리되어 있습니다.

## 로컬에서 실행하기

빌드/설치 과정이 없습니다.

1. `index.html`은 브라우저에서 바로 열어도 됩니다(`file://` 정상 동작).
2. `search.html`(검색·리뷰·AI 분석)을 쓰려면 API 키가 필요합니다:
   1. `.env.local.example`을 복사해 같은 폴더에 `.env.local`로 저장합니다(`.gitignore` 대상이라 커밋되지 않습니다).
   2. 카카오 로컬 API, Google Places API (New), Gemini API 키를 각각 발급받아 채웁니다 — 발급 방법은 `.env.local.example`의 각 항목 주석을 따라가면 됩니다.
   3. VSCode Live Server 같은 로컬 정적 서버로 `search.html`을 엽니다. (`file://`로 직접 열면 `.env.local`을 읽는 `fetch`가 막힐 수 있습니다.)

레이아웃·애니메이션을 건드릴 때는 devtools 반응형 모드(375 / 768 / 1024 / 1440px)와 "prefers-reduced-motion: reduce" 렌더링 에뮬레이션을 함께 확인하세요.

## Vercel 배포

1. 이 저장소를 Vercel 프로젝트로 연결합니다.
2. 프로젝트 Settings → Environment Variables에 아래 세 값을 등록합니다.
   - `KAKAO_REST_API_KEY`
   - `GOOGLE_PLACES_API_KEY`
   - `GEMINI_API_KEY`
3. 재배포하면 `api/` 아래 함수들이 자동으로 서버리스 엔드포인트로 인식되어 별도 설정 없이 동작합니다.

## 문서

| 문서 | 내용 |
|---|---|
| [`PRD.md`](./PRD.md) | 서비스 정의, 화면 구성, 기능 로드맵과 구현 현황 |
| [`DESIGN.md`](./DESIGN.md) | 컬러 팔레트, 타이포그래피, 컴포넌트 스펙, 모션 값 |
| [`CLAUDE.md`](./CLAUDE.md) | 코드베이스 구조와 작업 규칙(AI 어시스턴트용, 사람이 봐도 유용) |

## 관련 링크

- [프로젝트 허브로 돌아가기](https://project-hub-omega-seven.vercel.app/)
