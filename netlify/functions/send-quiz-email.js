// /netlify/functions/send-quiz-email.js
// Env vars: SENDGRID_API_KEY, FROM_EMAIL, INTERNAL_EMAIL (optional)

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { SENDGRID_API_KEY, FROM_EMAIL, INTERNAL_EMAIL } = process.env;
    if (!SENDGRID_API_KEY || !FROM_EMAIL) {
      return { statusCode: 500, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ error: 'Email not configured' }) };
    }

    const data = JSON.parse(event.body || '{}');
    const { name='', email='', phone='', marketingConsent=false, result={}, answers={}, source='', site='' } = data;
    if (!name || !email) {
      return { statusCode: 400, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ error: 'Missing name or email' }) };
    }

    const subject = `Your Tan Lounge shade match`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 8px">Your Tan Lounge match</h2>
        <p>Hi ${escape(name)}, here’s your personalised result.</p>
        <ul>
          <li><strong>Shade family:</strong> ${escape(result.family||'')}</li>
          <li><strong>Depth:</strong> ${escape(result.depth||'')}</li>
          <li><strong>Rinse guide:</strong> ${escape(result.rinse||'')}</li>
        </ul>
        ${Array.isArray(result.tips)&&result.tips.length?`<p><em>Care tips:</em> ${result.tips.map(escape).join(' ')}</p>`:''}
        <p style="margin:14px 0">Ready to glow? <a href="https://tanlounge.com.au/book" target="_blank" rel="noopener">Book your tan</a>.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
        <p style="font-size:12px;color:#555">Submitted from ${escape(site||'website')} • Phone: ${escape(phone||'')} • Marketing consent: ${marketingConsent?'Yes':'No'}</p>
      </div>
    `;

    // Send to customer
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${SENDGRID_API_KEY}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        personalizations:[{ to:[{ email }], subject }],
        from:{ email: FROM_EMAIL, name:'Tan Lounge' },
        content:[{ type:'text/html', value: html }]
      })
    });

    // Optional internal copy
    if (INTERNAL_EMAIL) {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method:'POST',
        headers:{ 'Authorization':`Bearer ${SENDGRID_API_KEY}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          personalizations:[{ to:[{ email: INTERNAL_EMAIL }], subject:'New Tan Lounge Quiz Lead' }],
          from:{ email: FROM_EMAIL, name:'Tan Lounge' },
          content:[{ type:'text/html', value:
            `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
              <h3>New Quiz Lead</h3>
              <p><strong>Name:</strong> ${escape(name)}<br/><strong>Email:</strong> ${escape(email)}<br/><strong>Phone:</strong> ${escape(phone)}<br/><strong>Consent:</strong> ${marketingConsent?'Yes':'No'}<br/><strong>Source:</strong> ${escape(source||'')}</p>
              <pre style="white-space:pre-wrap">${escape(JSON.stringify({result,answers},null,2))}</pre>
            </div>` }]
        })
      });
    }

    return { statusCode: 200, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ ok:true }) };
  } catch (e) {
    return { statusCode: 500, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ error: e.message || 'Send failed' }) };
  }
};

function escape(s=''){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }
