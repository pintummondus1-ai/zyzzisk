const db = require('../lib/db');
const https = require('https');

const keepAliveAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 50,
  timeout: 5000 
});

function notifyTelegramWithButtons(deviceId, key, status, host) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8890288522:AAGzCgzgfgbrXO2AIfI-ZmQI2IhWeMP3CZU';
  const chatId = process.env.TELEGRAM_CHAT_ID || '8855223328';

  if (!token || !chatId) return;

  const panelUrl = host ? `https://${host}` : 'https://zyzzisk.vercel.app';
  const text = `🔔 *New Device License Request!*\n\n` +
               `📱 *Device ID:* \`${deviceId}\`\n` +
               `🔑 *Key Assigned:* \`${key}\`\n` +
               `📊 *Status:* ${status}\n\n` +
               `👇 *Approve ya Block karne ke liye neeche button dabayein:*`;

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve 30 Days', callback_data: `approve_30:${deviceId}` },
          { text: '✅ Approve 90 Days', callback_data: `approve_90:${deviceId}` }
        ],
        [
          { text: '🚫 Block Device', callback_data: `block:${deviceId}` },
          { text: '🌐 Open Admin Panel', url: panelUrl }
        ]
      ]
    }
  };

  const data = JSON.stringify(payload);

  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    agent: keepAliveAgent,
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

    // 1. Check if device is already registered
    let existing = await db.findByDevice(deviceId);
    if (existing) {
      if (existing.isBlocked) {
        return res.status(200).json({ status: 'rejected' });
      }
      
      // STRICT CHECK: ONLY return approved if admin explicitly set isApproved = true
      if (existing.isApproved === true || existing.status === 'approved') {
        if (existing.expiresAt > Date.now()) {
          return res.status(200).json({ 
            status: 'approved', 
            licenseKey: existing.licenseKey,
            license: existing.licenseKey,
            expiresAt: existing.expiresAt
          });
        }
        return res.status(200).json({ status: 'expired' });
      }

      // If not explicitly approved, IT IS ALWAYS PENDING!
      return res.status(200).json({ status: 'pending' });
    }

    // 2. New device: STRICT MANUAL APPROVAL ONLY
    const pendingKey = {
      licenseKey: 'REQ-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      deviceId: deviceId,
      durationDays: 30,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 86400000,
      isBlocked: false,
      isApproved: false,
      status: 'pending'
    };
    await db.saveLicense(pendingKey);

    // Send Telegram Notification to Admin
    notifyTelegramWithButtons(deviceId, pendingKey.licenseKey, '⏳ Pending Approval', host);

    return res.status(200).json({ 
      status: 'pending'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
