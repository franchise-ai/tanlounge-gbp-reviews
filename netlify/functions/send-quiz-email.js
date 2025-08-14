const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok('', cors());
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  try {
    const {
      GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
      GMAIL_SENDER, INTERNAL_EMAIL
    } = process.env;
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_SENDER)
      return err(500, 'Gmail OAuth not configured');

    const body = JSON.parse(event.body || '{}');
    const { name='', email='', phone='', marketingConsent=false, result={}, answers={}, site='' } = body;
    if (!name || !email) return err(400, 'Missing name or email');

    const oAuth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
    oAuth2.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth: oAuth2 });

    const subject = 'Your Tan Lounge shade match';
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111">
        <h2 style="margin:0 0 8px">Your Tan Lounge match</h2>
        <p>Hi ${esc(name)}, here’s your personalised result.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="font-size:15px">
          <tr><td><b>Shade family:</b> ${esc(result.family||'')}</td></tr>
          <tr><td><b>Depth:</b> ${esc(result.depth||'')}</td></tr>
          ${result.session ? `<tr><td><b>Session:</b> ${esc(result.session)}</td></tr>` : ''}
          ${result.code ? `<tr><td><b>Tan Code:</b> ${esc(result.code)}</td></tr>` : ''}
          <tr><td><b>Rinse guide:</b> ${esc(result.rinse||'')}</td></tr>
        </table>
        ${Array.isArray(result.tips)&&result.tips.length ? `<p><em>Care tips:</em> ${result.tips.map(esc).join(' ')}</p>` : ''}
        <p style="margin:16px 0"><a href="https://tanlounge.com.au/book" target="_blank" rel="noopener">Book your session</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:18px 0"/>
        <p style="font-size:12px;color:#555">Submitted from ${esc(site||'website')} • Phone: ${esc(phone)} • Consent: ${marketingConsent?'Yes':'No'}</p>
      </div>`;

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: b64url(mime(GMAIL_SENDER, email, subject, html)) }
    });

    if (INTERNAL_EMAIL) {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: b64url(mime(GMAIL_SENDER, INTERNAL_EMAIL, 'New Tan Lounge Quiz Lead',
          `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
             <h3>New Quiz Lead</h3>
             <p><b>Name:</b> ${esc(name)}<br/><b>Email:</b> ${esc(email)}<br/><b>Phone:</b> ${esc(phone)}<br/>
             <b>Consent:</b> ${marketingConsent?'Yes':'No'}<br/><b>Site:</b> ${esc(site)}</p>
             <pre style="white-space:pre-wrap">${esc(JSON.stringify({ result, answers }, null, 2))}</pre>
           </div>`)) }
      });
    }

    return ok(JSON.stringify({ ok:true }), cors());
  } catch (e) {
    return err(500, e.message || 'Send failed');
  }
};

function mime(from,to,subject,html){
  return [
    `From: ${from}`, `To: ${to}`, `Subject: ${subject}`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', '', html
  ].join('\n');
}
const b64url = s => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const esc = (s='') => String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function cors(){ return { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type' }; }
function ok(body,headers={}){ return { statusCode:200, headers:{ 'Content-Type':'application/json', ...headers }, body }; }
function err(code,msg){ return { statusCode:code, headers:cors(), body: JSON.stringify({ error: msg }) }; }
