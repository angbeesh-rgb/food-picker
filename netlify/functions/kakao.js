
const https = require('https');

// CORS 허용 도메인 화이트리스트
const ALLOWED_ORIGINS = [
  'https://angbeesh-rgb.github.io',
  'https://food-picker-73e4a.web.app',
  'https://food-picker-73e4a.firebaseapp.com'
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin'
  };
}

function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const corsHeaders = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Origin 검증 (브라우저는 OPTIONS preflight로 막힘. 직접 호출 봇은 Origin 없거나 다른 값)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Forbidden origin' })
    };
  }

  const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

  if (!KAKAO_KEY) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았어요'
      })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const type = params.type;
    const lat = parseFloat(params.lat);
    const lng = parseFloat(params.lng);
    const radius = Math.min(parseInt(params.radius) || 5000, 20000);

    // 좌표 검증 (한국 영역 + 일반 허용 범위)
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '위치 정보가 없어요' })
      };
    }

    let url = '';

    if (type === 'menu') {
      // 쿼리 길이 제한 + 위험 문자 차단
      let query = String(params.query || '맛집').slice(0, 50);
      // 카카오 API에 영향 줄 수 있는 문자 제거 (공백/한글/영문/숫자/일부 기호만)
      query = query.replace(/[^가-힣A-Za-z0-9 ()+]/g, '').trim() || '맛집';
      url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&x=${lng}&y=${lat}&radius=${radius}&sort=distance&size=15`;
    } else {
      url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6&x=${lng}&y=${lat}&radius=${radius}&sort=distance&size=15`;
    }

    const data = await request(url, {
      Authorization: `KakaoAK ${KAKAO_KEY}`
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: '식당 검색 실패',
        detail: err.message
      })
    };
  }
};

