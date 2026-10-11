const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Admin Panel UI
app.use(express.static(path.join(__dirname, 'public')));

// Serverless handler adapters
const licenseStatusHandler = require('./api/license-status');
const requestLicenseHandler = require('./api/request-license');
const getLicensesHandler = require('./api/admin/get-licenses');
const createKeyHandler = require('./api/admin/create-key');
const blockKeyHandler = require('./api/admin/block-key');
const resetDeviceHandler = require('./api/admin/reset-device');
const extendKeyHandler = require('./api/admin/extend-key');
const telegramWebhookHandler = require('./api/telegram-webhook');
const setupWebhookHandler = require('./api/setup-webhook');

// Route Mappings
app.all('/api/license-status', (req, res) => licenseStatusHandler(req, res));
app.all('/api/request-license', (req, res) => requestLicenseHandler(req, res));
app.all('/api/admin/get-licenses', (req, res) => getLicensesHandler(req, res));
app.all('/api/admin/create-key', (req, res) => createKeyHandler(req, res));
app.all('/api/admin/block-key', (req, res) => blockKeyHandler(req, res));
app.all('/api/admin/reset-device', (req, res) => resetDeviceHandler(req, res));
app.all('/api/admin/extend-key', (req, res) => extendKeyHandler(req, res));
app.all('/api/telegram-webhook', (req, res) => telegramWebhookHandler(req, res));
app.all('/api/setup-webhook', (req, res) => setupWebhookHandler(req, res));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`✦ JJK License Server running at: http://localhost:${PORT}`);
  console.log(`✦ Admin Panel: http://localhost:${PORT}`);
  console.log(`✦ Admin Token: ${process.env.ADMIN_TOKEN || 'admin123'}`);
  console.log(`===============================================`);
});
