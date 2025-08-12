const { google } = require("googleapis");

exports.handler = async () => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      return json(500, { error: "Missing OAuth env vars" });
    }

    // OAuth
    const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    const access = await oauth2.getAccessToken();
    const headers = { Authorization: `Bearer ${access.token}` };

    // 1) List accounts
    const accRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers });
    const accJson = await accRes.json();
    if (accJson.error) return json(502, accJson);

    // 2) For each account, list locations (title + locationId)
    const accounts = [];
    for (const a of accJson.accounts || []) {
      const id = a.name?.split("/")[1];
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${id}/locations?pageSize=100&readMask=name,title,storeCode`,
        { headers }
      );
      const locJson = await locRes.json();
      accounts.push({
        accountId: id,
        accountName: a.accountName || a.name,
        locations: (locJson.locations || []).map(l => ({
          title: l.title,
          locationName: l.name, // accounts/{accountId}/locations/{locationId}
          accountId: l.name.split("/")[1],
          locationId: l.name.split("/")[3],
          storeCode: l.storeCode || null
        }))
      });
    }

    return json(200, { accounts });
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
      "Cache-Control": "public, max-age=300"
    },
    body: JSON.stringify(body, null, 2)
  };
}
