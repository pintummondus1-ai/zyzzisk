const db = require('../../lib/db');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }

  try {
    const licenses = await db.getAllLicenses();
    return res.status(200).json({ success: true, licenses });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
