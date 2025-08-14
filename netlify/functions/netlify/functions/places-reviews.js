// /netlify/functions/places-reviews.js
// Returns up to 5 Google reviews via Places Details API.
// Env: GOOGLE_MAPS_API_KEY
exports.handler = async (event) => {
  // CORS + only allow GET
  if (event.httpMethod === 'OPTIONS') return res(200, '', cors());
  if (event.httpMethod !== 'GET') return res(405, JSON.stringify({ error: 'Method not allowed' }), cors());

  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return res(500, JSON.stringify({ error: 'Missing GOOGLE_MAPS_API_KEY' }), cors());

    const url = new URL(event.rawUrl || `https://${event.headers.host}${event.path}`);
    const placeId = url.searchParams.get('placeId');
    const sort   = url.searchParams.get('sort') || 'most_relevant'; // or 'newest'

    if (!placeId) return res(400, JSON.stringify({ error: 'Missing placeId' }), cors());

    const fields = [
      'name','rating','user_ratings_total','url',
      'reviews' // includes author_name, profile_photo_url, rating, text, time/relative_time_description
    ].join(',');

    const api = `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=${encodeURIComponent(fields)}` +
      `&reviews_sort=${encodeURIComponent(sort)}` +
      `&key=${key}`;

    const r = await fetch(api);
    const j = await r.json();

    if (j.status !== 'OK' || !j.result) {
      return res(502, JSON.stringify({ error: 'API error', detail: j.status || 'NO_RESULT' }), cors());
    }

    const out = {
      name: j.result.name,
      rating: j.result.rating,
      total: j.result.user_ratings_total,
      url: j.result.url,
      reviews: (j.result.reviews || []).slice(0, 5).map(rv => ({
        author: rv.author_name,
        avatar: rv.profile_photo_url,
        rating: rv.rating,
        text: rv.text,
        when: rv.relative_time_description
      }))
    };
    return res(200, JSON.stringify(out), { ...cors(), 'Content-Type': 'application/json' });
  } catch (e) {
    return res(500, JSON.stringify({ error: e.message || 'Unknown error' }), cors());
  }
};

function cors(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
function res(code, body, headers={}){ return { statusCode: code, headers, body }; }
