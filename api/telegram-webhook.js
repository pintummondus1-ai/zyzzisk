const db = require('../lib/db');
const https = require('https');

// Keep-Alive agent for lightning-fast HTTPS reuse
const keepAliveAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 50,
  timeout: 5000 
});

function tgApi(method, data) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8890288522:AAGzCgzgfgbrXO2AIfI-ZmQI2IhWeMP3CZU';
  const payload = JSON.stringify(data);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      agent: keepAliveAgent,
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
    req.on('error', (e) => {
      console.error('tgApi error:', e.message);
      resolve({ ok: false });
    });
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
        tgApi('answerCallbackQuery', {
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

        const answerPromise = tgApi('answerCallbackQuery', {
          callback_query_id: cq.id,
          text: `✅ Approved for ${days} days!`
        });

        let lic = await db.findByDevice(deviceId);
        if (!lic) {
          lic = {
            licenseKey: 'JJK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
            deviceId: deviceId,
            durationDays: days,
            createdAt: Date.now(),
            expiresAt: Date.now() + days * 86400000,
            isBlocked: false,
            isApproved: true,
            status: 'approved'
          };
        } else {
          lic.status = 'approved';
          lic.isApproved = true;
          lic.isBlocked = false;
          lic.durationDays = days;
          lic.expiresAt = Date.now() + days * 86400000;
        }

        await db.saveLicense(lic);

        const editPromise = tgApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ *DEVICE APPROVED FOR ${days} DAYS!*\n\n📱 *Device ID:* \`${deviceId}\`\n🔑 *License Key:* \`${lic.licenseKey}\`\n⏳ *Expires:* ${new Date(lic.expiresAt).toLocaleDateString()}\n\n_Approved by Admin via Telegram_`,
          parse_mode: 'Markdown'
        });

        await Promise.all([answerPromise, editPromise]);
      } 
      // Handle custom_days:<deviceId>
      else if (data.startsWith('custom_days:')) {
        const deviceId = data.replace('custom_days:', '');

        const answerPromise = tgApi('answerCallbackQuery', {
          callback_query_id: cq.id,
          text: `✏️ Reply with command: /approve ${deviceId} <days>`
        });

        const replyPromise = tgApi('sendMessage', {
          chat_id: chatId,
          text: `✏️ *MANUAL DAYS APPROVAL*\n\nDevice ID: \`${deviceId}\`\n\nIs device ko customize days ke sath approve karne ke liye ye command copy karke send karein:\n\n\`/approve ${deviceId} 45\`\n\n_(Aap 45 ki jagah koi bhi days likh sakte hain, jaise 1, 10, 60, 180, 500 etc.)_`,
          parse_mode: 'Markdown'
        });

        await Promise.all([answerPromise, replyPromise]);
      }
      // Handle block:<deviceId>
      else if (data.startsWith('block:')) {
        const deviceId = data.replace('block:', '');

        const answerPromise = tgApi('answerCallbackQuery', {
          callback_query_id: cq.id,
          text: `🚫 Device Blocked!`
        });

        let lic = await db.findByDevice(deviceId);
        if (lic) {
          lic.isBlocked = true;
          lic.status = 'rejected';
          await db.saveLicense(lic);
        }

        const editPromise = tgApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🚫 *DEVICE BLOCKED!*\n\n📱 *Device ID:* \`${deviceId}\`\n\n_Access revoked by Admin via Telegram_`,
          parse_mode: 'Markdown'
        });

        await Promise.all([answerPromise, editPromise]);
      }

      return res.status(200).json({ ok: true });
    }

    // 2. Handle Text Commands (/start, /keys, /stats, /blockall, /unblockall)
    if (body.message) {
      const msg = body.message;
      const chatId = msg.chat?.id;
      const text = (msg.text || '').trim();

      if (text === '/start') {
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: `🔥 *JJK License Manager Bot Active!*\n\nCommands:\n• \`/approve <deviceId> <days>\` - ✏️ Manually custom days approve karein\n• \`/newkey\` - Forge a 30-day license key\n• \`/stats\` - Active licenses count\n• \`/blockall\` - 🚨 Sare devices block karein\n• \`/unblockall\` - ✅ Sare devices unblock karein`,
          parse_mode: 'Markdown'
        });
      } else if (text === '/blockall') {
        await db.setGlobalBlock(true);
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: `🚨 *ALL KEYS & DEVICES ARE NOW BLOCKED!*\n\nSabhi devices par app ka access band ho chuka hai (Status: REJECTED).`,
          parse_mode: 'Markdown'
        });
      } else if (text === '/unblockall') {
        await db.setGlobalBlock(false);
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: `✅ *GLOBAL BLOCK REMOVED!*\n\nDevices ab wapas access kar sakte hain.`,
          parse_mode: 'Markdown'
        });
      } else if (text === '/stats') {
        const isBlocked = await db.isGlobalBlocked();
        const all = await db.getAllLicenses();
        const active = all.filter(l => !l.isBlocked && l.expiresAt > Date.now());
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: `📊 *System Stats:*\n\n• Global Block: *${isBlocked ? '🚨 ACTIVE (BLOCKED)' : '🟢 OFF (NORMAL)'}*\n• Total Keys: *${all.length}*\n• Active Licenses: *${active.length}*`,
          parse_mode: 'Markdown'
        });
      } else if (text.startsWith('/approve')) {
        const parts = text.split(/\s+/);
        // Format: /approve <deviceId> <days>
        if (parts.length >= 3) {
          const targetDevice = parts[1];
          const customDays = parseInt(parts[2], 10);

          if (!customDays || customDays <= 0) {
            await tgApi('sendMessage', {
              chat_id: chatId,
              text: `⚠️ *Invalid Days!*\n\nSahi format: \`/approve <deviceId> <days>\`\nExample: \`/approve ${targetDevice} 60\``,
              parse_mode: 'Markdown'
            });
          } else {
            let lic = await db.findByDevice(targetDevice);
            if (!lic) {
              lic = {
                licenseKey: 'JJK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
                deviceId: targetDevice,
                durationDays: customDays,
                createdAt: Date.now(),
                expiresAt: Date.now() + customDays * 86400000,
                isBlocked: false,
                isApproved: true,
                status: 'approved'
              };
            } else {
              lic.status = 'approved';
              lic.isApproved = true;
              lic.isBlocked = false;
              lic.durationDays = customDays;
              lic.expiresAt = Date.now() + customDays * 86400000;
            }

            await db.saveLicense(lic);

            await tgApi('sendMessage', {
              chat_id: chatId,
              text: `✅ *MANUAL APPROVAL SUCCESSFUL!*\n\n📱 *Device ID:* \`${targetDevice}\`\n⏳ *Duration:* *${customDays} Days*\n🔑 *License Key:* \`${lic.licenseKey}\`\n📅 *Expires:* ${new Date(lic.expiresAt).toLocaleDateString()}\n\n_Device activated successfully!_`,
              parse_mode: 'Markdown'
            });
          }
        } else {
          await tgApi('sendMessage', {
            chat_id: chatId,
            text: `⚠️ *Format:* \`/approve <deviceId> <days>\`\n\nExample:\n\`/approve 1234567890 45\``,
            parse_mode: 'Markdown'
          });
        }
      } else if (text.startsWith('/block') && text !== '/blockall') {
        const parts = text.split(/\s+/);
        if (parts.length >= 2) {
          const target = parts[1];
          let lic = await db.findByDevice(target);
          if (!lic) {
            lic = await db.findByKey(target);
          }

          if (lic) {
            lic.isBlocked = true;
            lic.status = 'rejected';
            await db.saveLicense(lic);
            await tgApi('sendMessage', {
              chat_id: chatId,
              text: `🚫 *KEY / DEVICE BLOCKED!*\n\n📱 *Device / Key:* \`${target}\`\n\n_Is device ka app access turant band kar diya gaya hai!_`,
              parse_mode: 'Markdown'
            });
          } else {
            // Even if not found, create a blocked entry so it cannot be activated
            await db.saveLicense({
              licenseKey: 'BLOCKED-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
              deviceId: target,
              expiresAt: Date.now() + 365 * 86400000,
              isBlocked: true,
              isApproved: false,
              status: 'rejected'
            });
            await tgApi('sendMessage', {
              chat_id: chatId,
              text: `🚫 *DEVICE BLOCKED!*\n\n📱 *Device ID:* \`${target}\`\n\n_Device ko blacklist me daal diya gaya hai!_`,
              parse_mode: 'Markdown'
            });
          }
        } else {
          await tgApi('sendMessage', {
            chat_id: chatId,
            text: `⚠️ *Format:* \`/block <deviceId_ya_key>\`\n\nExample:\n\`/block 957904033e6daef8\``,
            parse_mode: 'Markdown'
          });
        }
      } else if (text === '/newkey') {
        const key = 'JJK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        await db.saveLicense({
          licenseKey: key,
          deviceId: null,
          durationDays: 30,
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 86400000,
          isBlocked: false,
          status: 'unused'
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
    return res.status(200).json({ ok: false });
  }
};
