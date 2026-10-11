function verifyAdmin(req) {
  const expectedToken = process.env.ADMIN_TOKEN || 'admin123';
  const token = req.headers['x-admin-token'] || (req.query && req.query.adminToken);
  return token && token === expectedToken;
}

module.exports = { verifyAdmin };
