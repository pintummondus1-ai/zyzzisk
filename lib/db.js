const https = require('https');

const keepAliveAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 50,
  timeout: 5000 
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8890288522:AAGzCgzgfgbrXO2AIfI-ZmQI2IhWeMP3CZU';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8855223328';

function tgApi(method, data) {
  const payload = JSON.stringify(data);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
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
      console.error('tgApi error in db:', e.message);
      resolve({ ok: false });
    });
    req.write(payload);
    req.end();
  });
}

// In-memory cache for ultra-fast responses
let memoryDb = {
  pinnedMsgId: null,
  globalBlocked: false,
  licenses: [],
  lastFetch: 0
};

async function syncFromCloud() {
  const now = Date.now();
  // Cache for 3 seconds to prevent excessive Telegram API calls
  if (memoryDb.licenses.length > 0 && now - memoryDb.lastFetch < 3000) {
    return memoryDb;
  }

  try {
    const chatRes = await tgApi('getChat', { chat_id: CHAT_ID });
    if (chatRes.ok && chatRes.result && chatRes.result.pinned_message) {
      const pin = chatRes.result.pinned_message;
      memoryDb.pinnedMsgId = pin.message_id;
      const text = pin.text || '{}';
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.licenses)) {
          memoryDb.licenses = parsed.licenses;
          memoryDb.globalBlocked = !!parsed.globalBlocked;
          memoryDb.lastFetch = now;
          return memoryDb;
        }
      } catch (e) {}
    }

    // If no valid pinned message, initialize one
    if (!memoryDb.pinnedMsgId) {
      const sendRes = await tgApi('sendMessage', {
        chat_id: CHAT_ID,
        text: JSON.stringify({ version: 1, globalBlocked: false, licenses: [] })
      });
      if (sendRes.ok && sendRes.result) {
        memoryDb.pinnedMsgId = sendRes.result.message_id;
        await tgApi('pinChatMessage', {
          chat_id: CHAT_ID,
          message_id: memoryDb.pinnedMsgId,
          disable_notification: true
        });
        memoryDb.lastFetch = now;
      }
    }
  } catch (err) {
    console.error('syncFromCloud error:', err.message);
  }

  return memoryDb;
}

async function syncToCloud() {
  if (!memoryDb.pinnedMsgId) {
    await syncFromCloud();
  }

  const payloadText = JSON.stringify({
    version: 1,
    globalBlocked: memoryDb.globalBlocked,
    licenses: memoryDb.licenses
  });

  const editRes = await tgApi('editMessageText', {
    chat_id: CHAT_ID,
    message_id: memoryDb.pinnedMsgId,
    text: payloadText
  });

  // If edit failed (e.g. message unpinned or deleted), re-create and pin
  if (!editRes.ok) {
    const sendRes = await tgApi('sendMessage', {
      chat_id: CHAT_ID,
      text: payloadText
    });
    if (sendRes.ok && sendRes.result) {
      memoryDb.pinnedMsgId = sendRes.result.message_id;
      await tgApi('pinChatMessage', {
        chat_id: CHAT_ID,
        message_id: memoryDb.pinnedMsgId,
        disable_notification: true
      });
    }
  }
}

const db = {
  async isGlobalBlocked() {
    await syncFromCloud();
    return !!memoryDb.globalBlocked;
  },

  async setGlobalBlock(blocked) {
    await syncFromCloud();
    memoryDb.globalBlocked = blocked;
    if (blocked) {
      memoryDb.licenses.forEach(l => {
        l.isBlocked = true;
        l.status = 'rejected';
      });
    }
    await syncToCloud();
    return blocked;
  },

  async getAllLicenses() {
    await syncFromCloud();
    return memoryDb.licenses;
  },

  async findByKey(licenseKey) {
    await syncFromCloud();
    return memoryDb.licenses.find(l => l.licenseKey === licenseKey) || null;
  },

  async findByDevice(deviceId) {
    await syncFromCloud();
    return memoryDb.licenses.find(l => l.deviceId === deviceId) || null;
  },

  async saveLicense(license) {
    await syncFromCloud();
    const idx = memoryDb.licenses.findIndex(l => l.licenseKey === license.licenseKey || (license.deviceId && l.deviceId === license.deviceId));
    if (idx >= 0) {
      memoryDb.licenses[idx] = { ...memoryDb.licenses[idx], ...license };
    } else {
      memoryDb.licenses.push(license);
    }
    await syncToCloud();
    return license;
  }
};

module.exports = db;
