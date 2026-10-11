const https = require('https');

module.exports = async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8890288522:AAGzCgzgfgbrXO2AIfI-ZmQI2IhWeMP3CZU';
  const host = req.headers['host'];

  if (!host) {
    return res.status(400).send('Host header missing');
  }

  const webhookUrl = `https://${host}/api/telegram-webhook`;

  const payload = JSON.stringify({
    url: webhookUrl,
    drop_pending_updates: true
  });

  const apiReq = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${token}/setWebhook`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px; background:#0d1117; color:#58a6ff;">
          <h2>🚀 Telegram Bot 24/7 Webhook Configured!</h2>
          <p style="color:#8b949e;">Webhook URL: <code>${webhookUrl}</code></p>
          <pre style="background:#161b22; padding:15px; border-radius:8px; display:inline-block; text-align:left; color:#7ee787;">${body}</pre>
          <br><br>
          <p style="color:#ffffff;">Ab aapka Telegram Bot 24/7 bina kisi server ke live chalega!</p>
          <a href="/" style="color:#58a6ff; text-decoration:none;">✦ Open Admin Panel ✦</a>
        </div>
      `);
    });
  });

  apiReq.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });

  apiReq.write(payload);
  apiReq.end();
};
