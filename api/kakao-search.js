// api/kakao-search.js
// ============================================================================
// Vercel Function (zero-config, /api 디렉터리에 있으면 자동으로 서버리스
// 엔드포인트가 된다 — package.json도, vercel.json 설정도 필요 없다).
//
// search.html이 브라우저에서 카카오 로컬 API를 직접 호출하던 것을 대신 맡는다.
// KAKAO_REST_API_KEY는 여기(서버)에서만 process.env로 읽고 브라우저에는
// 절대 노출하지 않는다. 응답은 카카오 원본 JSON을 그대로 패스스루하므로
// search.html의 documents/meta 파싱 로직은 손댈 필요가 없다.
//
// 로컬 정적 서버(Live Server 등)로 search.html을 열면 이 경로 자체가
// 존재하지 않아 404가 나는데, 그건 정상이다 — search.html이 그 경우
// .env.local을 읽어 카카오를 직접 호출하는 폴백으로 넘어간다.
// ============================================================================

module.exports = async (req, res) => {
  const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_REST_API_KEY) {
    res.status(500).json({ error: 'KAKAO_REST_API_KEY가 Vercel 환경변수에 설정되지 않았습니다.' });
    return;
  }

  const { type, query, groupCode, x, y, page } = req.query || {};

  let upstreamUrl;
  if (type === 'category') {
    if (!groupCode || !x || !y) {
      res.status(400).json({ error: 'category 검색에는 groupCode, x, y가 필요합니다.' });
      return;
    }
    const params = new URLSearchParams({
      category_group_code: String(groupCode),
      x: String(x),
      y: String(y),
      radius: '20000',
      page: String(page || 1),
      size: '15',
      sort: 'accuracy',
    });
    upstreamUrl = `https://dapi.kakao.com/v2/local/search/category.json?${params.toString()}`;
  } else {
    if (!query) {
      res.status(400).json({ error: 'keyword 검색에는 query가 필요합니다.' });
      return;
    }
    const params = new URLSearchParams({ query: String(query), page: String(page || 1), size: '15' });
    upstreamUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: '카카오 API 호출에 실패했습니다.', detail: String(err && err.message || err) });
  }
};
