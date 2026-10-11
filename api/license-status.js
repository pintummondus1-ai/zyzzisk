const db = require('../lib/db');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const deviceId = req.query.deviceId;
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  try {
    const license = await db.findByDevice(deviceId);
    if (!license) {
      return res.status(200).json({ status: 'none' });
    }

    if (license.isBlocked) {
      return res.status(200).json({ status: 'rejected' });
    }

    if (license.expiresAt < Date.now()) {
      return res.status(200).json({ status: 'expired' });
    }

    return res.status(200).json({
      status: 'approved',
      license: license.licenseKey,
      expiresAt: license.expiresAt
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
