const db = require('../lib/db');
const https = require('https');

function tgApi(method, data) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8890288522:AAGzCgzgfgbrXO2AIfI-ZmQI2IhWeMP3CZU';
  const payload = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({ ok: false }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Webhook Active');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const ADMIN_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || '8855223328');

  try {
    // 1. Handle Button Clicks (Callback Queries)
    if (body.callback_query) {
      const cq = body.callback_query;
      const fromId = String(cq.from?.id);
      const data = cq.data || '';
      const messageId = cq.message?.message_id;
      const chatId = cq.message?.chat?.id;

      if (fromId !== ADMIN_CHAT_ID) {
        await tgApi('answerCallbackQuery', {
          callback_query_id: cq.id,
          text: '❌ Unauthorized',
          show_alert: true
        });
        return res.status(200).json({ ok: true });
      }

      // Handle approve_30:<deviceId> or approve_90:<deviceId>
      if (data.startsWith('approve_')) {
        const parts = data.split(':');
        const days = parseInt(parts[0].replace('approve_', ''), 10) || 30;
        const deviceId = parts[1];

        let lic = await db.findByDevice(deviceId);
        if (!lic) {
          lic = {
            licenseKey: 'JJK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
            deviceId: deviceId,
            durationDays: days,
            createdAt: Date.now(),
            expiresAt: Date.now() + days * 86400000,
            isBlocked: false
          };
        } else {
          lic.isBlocked = false;
          lic.durationDays = days;
          lic.expiresAt = Date.now() + days * 86400000;
        }

        await db.saveLicense(lic);

        await tgApi('answerCallbackQuery', {
          callback_query_id: cq.id,
          text: `✅ Device Approved for ${days} days!`,
          show_alert: true
        });

        await tgApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ *DEVICE APPROVED FOR ${days} DAYS!*\n\n📱 *Device ID:* \`${deviceId}\`\n🔑 *License Key:* \`${lic.licenseKey}\`\n⏳ *Expires:* ${new Date(lic.expiresAt).toLocaleDateString()}\n\n_Approved by Admin via Telegram_`,
          parse_mode: 'Markdown'
        });
      } 
      // Handle block:<deviceId>
      else if (data.startsWith('block:')) {
        const deviceId = data.replace('block:', '');
        let lic = await db.findByDevice(deviceId);
        if (lic) {
          lic.isBlocked = true;
          await db.saveLicense(lic);
        }

        await tgApi('answerCallbackQuery', {
          callback_query_id: cq.id,
          text: `🚫 Device Blocked!`,
          show_alert: true
        });

        await tgApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🚫 *DEVICE BLOCKED!*\n\n📱 *Device ID:* \`${deviceId}\`\n\n_Access revoked by Admin via Telegram_`,
          parse_mode: 'Markdown'
        });
      }

      return res.status(200).json({ ok: true });
    }

    // 2. Handle Text Commands (/start, /keys, /stats)
    if (body.message) {
      const msg = body.message;
      const chatId = msg.chat?.id;
      const text = (msg.text || '').trim();

      if (text === '/start') {
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: `🔥 *JJK License Manager Bot Active!*\n\nCommands:\n• /stats - Active licenses count\n• /keys - List all active keys\n• /newkey - Forge a 30-day license key\n\nNaye license requests yahan automatically approval buttons ke sath aayenge.`,
          parse_mode: 'Markdown'
        });
      } else if (text === '/stats') {
        const all = await db.getAllLicenses();
        const active = all.filter(l => !l.isBlocked && l.expiresAt > Date.now());
        const blocked = all.filter(l => l.isBlocked);
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: `📊 *System Stats:*\n\n• Total Keys: *${all.length}*\n• Active Licenses: *${active.length}*\n• Blocked: *${blocked.length}*`,
          parse_mode: 'Markdown'
        });
      } else if (text === '/newkey') {
        const key = 'JJK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        await db.saveLicense({
          licenseKey: key,
          deviceId: null,
          durationDays: 30,
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 86400000,
          isBlocked: false
        });
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: `✨ *New 30-Day Key Forged:*\n\n\`${key}\`\n\n_Unbound and ready to use!_`,
          parse_mode: 'Markdown'
        });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
