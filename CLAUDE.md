# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

**맛밥 (Matbab)** — "리뷰를 다 읽지 않아도 실제 평판을 빠르게 파악하는" 맛집 리뷰 서비스의 랜딩페이지. 로드맵 1번(검색)은 카카오 로컬 API 기반 실검색(`search.html`)으로 이미 구현됐다. 나머지 서비스 본체(AI 요약, 감성 분석, 대시보드, 로그인)는 아직 구현되지 않은 로드맵 단계이며, `index.html`의 인기 맛집 카드·최근 리뷰 섹션도 여전히 목업 데이터다.

- `PRD.md` — 서비스 정의, 랜딩페이지 섹션별 요구사항, 기능 로드맵과 구현 현황(확정 순서: 리뷰+검색 → 애니메이션/모바일 → AI 요약/감성분석 → 로그인 → 대시보드)
- `DESIGN.md` — 컬러 팔레트, 타이포그래피, 간격, 컴포넌트 스펙, 모션 값. 시각적 스타일을 결정할 때는 이 문서를 그대로 따를 것 — 색상·라운드·그림자·타입 스케일 전부 정확한 값이 지정되어 있으므로 임의로 바꾸지 않는다.
- `index.html` — 랜딩페이지(단일 파일)
- `search.html` — "맛집 담기" 검색 페이지(단일 파일). 카카오 로컬 API로 키워드/카테고리 실검색을 수행하고 결과를 카드로 렌더링한다. API 키는 `.env`(gitignore 대상, 커밋 금지)에서 런타임에 `fetch`로 읽어온다 — 템플릿은 `.env.example` 참고.

## 커맨드

빌드/린트/테스트 도구 없음 — 설치할 의존성이 전혀 없는 정적 HTML 파일이다.

- **실행/미리보기**: `index.html`을 브라우저에서 직접 연다(`file://` 프로토콜로 정상 동작).
- **변경 확인**: 브라우저를 새로고침해 해당 섹션을 확인. 레이아웃이나 애니메이션을 건드릴 때는 devtools 반응형 모드(주요 브레이크포인트 375 / 768 / 1024 / 1440px)와 "prefers-reduced-motion: reduce 에뮬레이션" 렌더링 토글을 함께 확인한다.

## 아키텍처

모든 코드가 `index.html` 한 파일 안에 인라인 블록 3개로 나뉘어 있다 — 상위 디렉터리의 형제 실습 프로젝트들(`day1`~`day3`, `project_hub`)이 전부 빌드 도구 없는 단일 파일(또는 파일+CSS) 방식이라는 관례를 그대로 따른 것이다. 별다른 요청 없이 번들러·프레임워크·npm 의존성을 새로 도입하지 않는다.

1. **`<head>`**: Tailwind를 CDN(`cdn.tailwindcss.com`)으로 로드한 뒤, 인라인 `tailwind.config`로 DESIGN.md 팔레트를 이름 있는 컬러(`honey`, `cream`, `ivory`, `bark`, `cocoa`, `blueberry` 등)로 등록하고 `fontFamily`/`borderRadius`/`boxShadow`/`maxWidth` 커스텀 토큰도 함께 정의한다. 마크업에 hex 값이나 임의의 Tailwind arbitrary value를 직접 쓰기보다 이 config를 확장하는 쪽을 우선한다.
2. **`<style>`**: Tailwind 유틸리티로 표현 안 되는 것만 — Gmarket Sans(제목용) `@font-face`(본문 폰트 Pretendard는 CDN `<link>`로 별도 로드), 스크롤 등장용 `.reveal`/`.is-visible` fade 클래스, 마퀴 `@keyframes` + 좌우 페이드 처리용 가상요소, 그리고 `!important`로 우선해야 하는 `prefers-reduced-motion` 예외 처리.
3. **`<script>`**(body 끝): 데이터 우선 렌더링 방식. 가짜 콘텐츠는 최상단 배열(`restaurants`, `reviews`, `features`)에 있고, 빈 컨테이너 `<div>`에 `createElement`/템플릿 문자열로 렌더링한다 — 카드·칩 마크업을 손으로 하드코딩하지 않는다. PRD.md 로드맵 1번(실제 리뷰 데이터)이 붙을 때 이 배열들이 교체 지점이 된다. 이후 `IntersectionObserver`가 `.reveal` 스크롤 애니메이션을 담당하고, `lucide.createIcons()`가 `data-lucide` 아이콘 자리(역시 CDN 로드)를 렌더링한다.

### 섹션 순서와 배경 리듬

섹션은 PRD.md가 정한 고정 순서를 따른다: 히어로 → 인기 맛집 카드 → 최근 리뷰 → 서비스 특징 → 푸터. 배경은 `Cream → Ivory → Cream → Ivory → Cocoa`로 교차하며 푸터가 유일한 다크 섹션이다. 섹션 마크업을 수정할 때 이 순서와 교차 규칙을 그대로 유지한다.

### 저장소 간 링크

푸터의 "프로젝트 허브로 돌아가기" 링크는 별도로 배포된 project_hub 사이트(`https://project-hub-omega-seven.vercel.app/`)를 새 탭(`target="_blank" rel="noopener noreferrer"`)으로 가리키는 절대 URL이다. 예전에는 형제 저장소를 상대경로(`../project_hub/index.html`)로 참조해서 `review`만 단독 배포하면 깨졌지만, 지금은 절대 URL이라 `review` 저장소만 배포해도 정상 동작한다.

## 스타일링 전 알아둘 디자인 제약

- **Honey(`#E9A227`)는 배경 채움 전용이다** — 흰색/크림 배경 위에서 대비비가 너무 낮아 텍스트 색으로 쓸 수 없다. Honey 배경 위 텍스트는 항상 Cocoa(`#2E2620`), 링크·강조 텍스트는 대신 Blueberry(`#35566B`)를 쓴다.
- Coming Soon 뱃지는 `honey`가 아니라 `honey-soft`를 쓴다 — 아직 없는 기능이 활성 버튼보다 시각적으로 튀면 안 되기 때문이다.
- 한글 카피는 `word-break: keep-all`을 유지해야 단어가 어색하게 끊기지 않는다(현재 `body`에 전역 적용되어 있음, 텍스트 위주 섹션을 새로 추가할 때 참고).
