const db = require('../../lib/db');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const durationDays = parseInt(body?.durationDays, 10) || 30;
  let licenseKey = body?.licenseKey?.trim();

  if (!licenseKey) {
    licenseKey = 'JJK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  try {
    const existing = await db.findByKey(licenseKey);
    if (existing) {
      return res.status(400).json({ success: false, error: 'License key already exists' });
    }

    const newLicense = {
      licenseKey,
      deviceId: null,
      durationDays,
      createdAt: Date.now(),
      expiresAt: Date.now() + durationDays * 86400000,
      isBlocked: false
    };

    await db.saveLicense(newLicense);
    return res.status(200).json({ success: true, license: newLicense });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
