// api/analyze-reviews.js
// ============================================================================
// Vercel Function (zero-config). search.html의 리뷰 모달이 구글 리뷰를 다
// 받아온 직후 자동으로 호출한다.
//
// Gemini API로 리뷰를 분석해: (1) 리뷰별 긍정/보통/부정 분류 개수,
// (2) 음식 이름/맛/분위기/서비스 위주 핵심 단어 8~15개(중요도 1~10점 +
// 좋은/나쁜 맥락), (3) 가게 리뷰 한 문장 요약을 돌려준다.
//
// GEMINI_API_KEY는 여기(서버)에서만 process.env로 읽고 브라우저에는 절대
// 노출하지 않는다. generationConfig.responseSchema로 출력 형식을 강제해
// 파싱 실패 위험을 줄이고, 여기서 Gemini 응답 봉투(candidates[0].content...)
// 를 미리 풀어서 { sentimentCounts, keywords, summary } 형태로만 반환한다
// — 카카오/구글 프록시와 달리 원본을 그대로 패스스루할 이유가 없다(Gemini
// 응답 구조는 장황하고 클라이언트가 다룰 이유가 없음).
// ============================================================================

// gemini-2.5-flash는 신규 API 키에는 더 이상 제공되지 않음(2026-08 기준
// Google이 404 + "gemini-3.6-flash를 쓰라"는 안내를 반환함) — 3.6-flash로 확정.
const MODEL = 'gemini-3.6-flash';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sentimentCounts: {
      type: 'object',
      properties: {
        positive: { type: 'integer' },
        neutral: { type: 'integer' },
        negative: { type: 'integer' },
      },
      required: ['positive', 'neutral', 'negative'],
    },
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          score: { type: 'integer' }, // 1~10, 중요도
          sentiment: { type: 'string', enum: ['positive', 'negative'] },
        },
        required: ['word', 'score', 'sentiment'],
      },
    },
    summary: { type: 'string' }, // 한국어 한 문장 총평
  },
  required: ['sentimentCounts', 'keywords', 'summary'],
};

function buildPrompt(placeName, reviews){
  const reviewsText = reviews
    .map((r, i) => `${i + 1}. (별점 ${r.rating ?? '?'}점) ${r.text || '(내용 없음)'}`)
    .join('\n');

  return `당신은 맛집 리뷰 분석가입니다. 아래는 "${placeName}"의 구글 리뷰 ${reviews.length}개입니다.

${reviewsText}

다음을 분석해 JSON으로만 답하세요:
1. 각 리뷰를 긍정/보통/부정 중 하나로 분류하고, 전체 개수를 센다(sentimentCounts). 세 개수의 합은 리뷰 총 개수(${reviews.length})와 같아야 한다.
2. 리뷰에서 자주 언급되는 핵심 단어를 8~15개 뽑는다(keywords). 음식 이름, 맛, 분위기, 서비스 관련 단어 위주로 고르고, 각 단어마다 중요도(score, 1~10점, 자주 언급되고 리뷰 전체 인상에 중요할수록 높게)와 맥락(sentiment, 좋은 맥락이면 positive, 나쁜 맥락이면 negative)을 함께 매긴다.
3. 전체 리뷰를 바탕으로 이 가게에 대한 총평을 한국어 한 문장(summary)으로 요약한다.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 허용됩니다.' });
    return;
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY가 Vercel 환경변수에 설정되지 않았습니다.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (err) { body = null; }
  }
  const placeName = body && body.placeName;
  const reviews = (body && Array.isArray(body.reviews)) ? body.reviews : [];
  if (!placeName || reviews.length === 0) {
    res.status(400).json({ error: 'placeName과 reviews(1개 이상)가 필요합니다.' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(placeName, reviews) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => null);
      res.status(upstream.status).json({ error: (errData && errData.error && errData.error.message) || 'Gemini API 호출에 실패했습니다.' });
      return;
    }

    const data = await upstream.json();
    const text = data && data.candidates && data.candidates[0]
      && data.candidates[0].content && data.candidates[0].content.parts
      && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

    if (!text) {
      // 응답 후보가 없음 — safety block 등
      res.status(502).json({ error: 'Gemini가 분석 결과를 반환하지 않았습니다.' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      res.status(502).json({ error: 'Gemini 응답을 해석하지 못했습니다.' });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(502).json({ error: 'Gemini API 호출에 실패했습니다.', detail: String(err && err.message || err) });
  }
};
