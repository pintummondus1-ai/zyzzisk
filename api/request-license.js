const db = require('../lib/db');

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
    // 1. Check if device already has a license
    let existing = await db.findByDevice(deviceId);
    if (existing) {
      return res.status(200).json({ success: true, status: existing.isBlocked ? 'rejected' : 'approved', license: existing.licenseKey });
    }

    // 2. Check if an unbound key is available to assign
    let availableKey = await db.findAvailableKey();
    if (availableKey) {
      availableKey.deviceId = deviceId;
      await db.saveLicense(availableKey);
      return res.status(200).json({ success: true, status: 'approved', license: availableKey.licenseKey });
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

    return res.status(200).json({ success: true, status: 'pending', message: 'Request queued for admin approval' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
