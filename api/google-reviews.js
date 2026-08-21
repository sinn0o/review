// api/google-reviews.js
// ============================================================================
// Vercel Function (zero-config). search.html의 구글 리뷰 모달이 호출한다.
//
// Google Places API (New) - Text Search만 사용한다(구버전 Places API 금지).
// GOOGLE_PLACES_API_KEY는 여기(서버)에서만 process.env로 읽고 브라우저에는
// 절대 노출하지 않는다 — 그래서 이 경로에서는 HTTP 리퍼러 제한이 없어도
// 안전하다(리퍼러 제한은 .env.local을 쓰는 로컬 폴백 경로에서만 의미 있음).
//
// 요청 필드는 X-Goog-FieldMask로 정확히 5개(가게 이름/별점/리뷰 개수/
// 리뷰 내용/구글맵 링크)만 받아 비용을 제한한다. 같은 이름의 가게가
// 여러 곳 있을 수 있으므로 넘겨받은 좌표 기준 150m(도보 2분) 반경
// locationRestriction으로 서버 사이드에서 강제 필터링한다.
//
// 정규화(화면에 바로 쓰기 좋은 형태로 다듬는 것)는 클라이언트(search.html)
// 쪽에서 한다 — 여기서는 구글 원본 JSON을 그대로 패스스루한다.
// ============================================================================

const SEARCH_RADIUS_METERS = 150;

module.exports = async (req, res) => {
  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!GOOGLE_PLACES_API_KEY) {
    res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY가 Vercel 환경변수에 설정되지 않았습니다.' });
    return;
  }

  const { name, lat, lng } = req.query || {};
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    res.status(400).json({ error: 'name, lat, lng가 모두 필요합니다.' });
    return;
  }

  try {
    const upstream = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        // 딱 5개 필드만 요청: 가게 이름, 별점, 리뷰 개수, 리뷰 내용들, 구글맵 페이지 링크
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.reviews,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery: String(name),
        languageCode: 'ko',
        maxResultCount: 1,
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: SEARCH_RADIUS_METERS,
          },
        },
      }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Google Places API 호출에 실패했습니다.', detail: String(err && err.message || err) });
  }
};
