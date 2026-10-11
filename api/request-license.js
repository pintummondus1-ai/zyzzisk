const db = require('../lib/db');
const https = require('https');

// Helper to send Telegram notification to Admin
function notifyTelegram(deviceId, key, status, host) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const panelUrl = host ? `https://${host}` : 'Admin Panel';
  const text = `🔔 *New Device License Request!*\n\n` +
               `📱 *Device ID:* \`${deviceId}\`\n` +
               `🔑 *Key Assigned:* \`${key}\`\n` +
               `📊 *Status:* ${status}\n\n` +
               `🔗 [Open Admin Panel](${panelUrl})`;

  const data = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  });

  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  });

  req.on('error', (e) => console.error('Telegram notify error:', e.message));
  req.write(data);
  req.end();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  const deviceId = body?.deviceId;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  try {
    const host = req.headers['host'] || '';

    // 1. Check if device already has a license
    let existing = await db.findByDevice(deviceId);
    if (existing) {
      return res.status(200).json({ 
        success: true, 
        status: existing.isBlocked ? 'rejected' : 'approved', 
        license: existing.licenseKey 
      });
    }

    // 2. Check if an unbound key is available to assign
    let availableKey = await db.findAvailableKey();
    if (availableKey) {
      availableKey.deviceId = deviceId;
      await db.saveLicense(availableKey);

      notifyTelegram(deviceId, availableKey.licenseKey, '✅ Auto-Approved', host);

      return res.status(200).json({ 
        success: true, 
        status: 'approved', 
        license: availableKey.licenseKey 
      });
    }

    // 3. Otherwise create a pending license request record
    const pendingKey = {
      licenseKey: 'REQ-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      deviceId: deviceId,
      durationDays: 30,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 86400000,
      isBlocked: false,
      status: 'pending'
    };
    await db.saveLicense(pendingKey);

    notifyTelegram(deviceId, pendingKey.licenseKey, '⏳ Pending Approval', host);

    return res.status(200).json({ 
      success: true, 
      status: 'pending', 
      message: 'Request queued for admin approval' 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
