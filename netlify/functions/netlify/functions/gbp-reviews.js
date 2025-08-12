const { google } = require("googleapis");

// Maps enum (FIVE, FOUR, etc.) to number
const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

exports.handler = async (event) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      return json(500, { error: "Missing OAuth env vars" });
    }

    const qs = event.queryStringParameters || {};
    const accountId = (qs.accountId || "").trim();
    const locationId = (qs.locationId || "").trim();
    const max = Math.min(parseInt(qs.max || "200", 10), 500); // hard cap

    if (!accountId || !locationId) {
      return json(400, { error: "Missing accountId or locationId" });
    }

    // OAuth
    const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    const access = await oauth2.getAccessToken();
    const headers = { Authorization: `Bearer ${access.token}` };

    // Optional: get the location title (nice for the widget header)
    const infoUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations/${locationId}?readMask=title`;
    const infoRes = await fetch(infoUrl, { headers });
    const infoJson = await infoRes.json();
    const locTitle = infoJson?.title || "Google Reviews";

    // Pull all reviews (v4)
    // https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
    const base = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;
    let pageToken = "", reviews = [];
    while (reviews.length < max) {
      const url = base + `?pageSize=50` + (pageToken ? `&pageToken=${pageToken}` : "");
      const res = await fetch(url, { headers });
      const json = await res.json();
      if (json.error) return jsonOut(502, json);

      (json.reviews || []).forEach(r => {
        reviews.push({
          author_name: r.reviewer?.displayName || "Google User",
          profile_photo_url: r.reviewer?.profilePhotoUrl || "",
          rating: STAR_MAP[r.starRating] || 0,
          relative_time_description: new Date(r.createTime).toLocaleDateString(),
          text: r.comment || "",
          author_url: "" // GBP v4 doesn't expose profile URL per review
        });
      });

      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }

    // Compute avg
    const rating = reviews.length
      ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
      : "0.0";

    return json(200, {
      name: locTitle,
      rating,
      user_ratings_total: reviews.length,
      reviews
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=600"
    },
    body: JSON.stringify(body)
  };
}
