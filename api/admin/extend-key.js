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

  const { licenseKey, days } = body || {};
  const addDays = parseInt(days, 10);

  if (!licenseKey || isNaN(addDays) || addDays <= 0) {
    return res.status(400).json({ success: false, error: 'Valid licenseKey and days are required' });
  }

  try {
    const lic = await db.findByKey(licenseKey);
    if (!lic) {
      return res.status(404).json({ success: false, error: 'License key not found' });
    }

    const currentExpiry = Math.max(lic.expiresAt, Date.now());
    lic.expiresAt = currentExpiry + addDays * 86400000;
    lic.durationDays = (lic.durationDays || 0) + addDays;

    await db.saveLicense(lic);
    return res.status(200).json({ success: true, license: lic });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
