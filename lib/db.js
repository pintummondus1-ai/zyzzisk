const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let isConnected = false;
let isGlobalBlocked = false;

// License Mongoose Schema
const LicenseSchema = new mongoose.Schema({
  licenseKey: { type: String, required: true, unique: true },
  deviceId: { type: String, default: null },
  durationDays: { type: Number, default: 30 },
  createdAt: { type: Number, default: () => Date.now() },
  expiresAt: { type: Number, required: true },
  isBlocked: { type: Boolean, default: false }
});

const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Boolean, default: false }
});

const LicenseModel = mongoose.models.License || mongoose.model('License', LicenseSchema);
const SettingModel = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);

// File-based fallback DB
const LOCAL_DB_PATH = process.env.VERCEL 
  ? path.join('/tmp', 'licenses_db.json') 
  : path.join(__dirname, '..', 'licenses_db.json');

const SETTINGS_PATH = process.env.VERCEL 
  ? path.join('/tmp', 'settings_db.json') 
  : path.join(__dirname, '..', 'settings_db.json');

function readLocalDb() {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (e) {
    return [];
  }
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error writing local DB:', e);
  }
}

function readGlobalBlock() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      return !!data.globalBlocked;
    }
  } catch (e) {}
  return isGlobalBlocked;
}

function writeGlobalBlock(blocked) {
  isGlobalBlocked = blocked;
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ globalBlocked: blocked }));
  } catch (e) {}
}

async function connectMongo() {
  if (isConnected || !process.env.MONGODB_URI) return;
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    });
    isConnected = !!db.connections[0].readyState;
  } catch (err) {
    console.warn('MongoDB connection failed:', err.message);
  }
}

const db = {
  async isGlobalBlocked() {
    await connectMongo();
    if (isConnected) {
      const setting = await SettingModel.findOne({ key: 'globalBlock' }).lean();
      return setting ? setting.value : false;
    }
    return readGlobalBlock();
  },

  async setGlobalBlock(blocked) {
    await connectMongo();
    if (isConnected) {
      await SettingModel.findOneAndUpdate(
        { key: 'globalBlock' },
        { value: blocked },
        { upsert: true, new: true }
      );
    }
    writeGlobalBlock(blocked);

    // Also block all existing keys in DB
    if (blocked) {
      if (isConnected) {
        await LicenseModel.updateMany({}, { isBlocked: true });
      }
      const all = readLocalDb();
      all.forEach(l => l.isBlocked = true);
      writeLocalDb(all);
    }
    return blocked;
  },

  async getAllLicenses() {
    await connectMongo();
    if (isConnected) {
      return await LicenseModel.find({}).lean();
    }
    return readLocalDb();
  },

  async findByKey(licenseKey) {
    await connectMongo();
    if (isConnected) {
      return await LicenseModel.findOne({ licenseKey }).lean();
    }
    const all = readLocalDb();
    return all.find(l => l.licenseKey === licenseKey) || null;
  },

  async findByDevice(deviceId) {
    await connectMongo();
    if (isConnected) {
      return await LicenseModel.findOne({ deviceId }).lean();
    }
    const all = readLocalDb();
    return all.find(l => l.deviceId === deviceId) || null;
  },

  async findAvailableKey() {
    await connectMongo();
    if (isConnected) {
      return await LicenseModel.findOne({ 
        $or: [{ deviceId: null }, { deviceId: "" }], 
        isBlocked: false,
        expiresAt: { $gt: Date.now() }
      }).lean();
    }
    const all = readLocalDb();
    return all.find(l => (!l.deviceId) && !l.isBlocked && l.expiresAt > Date.now()) || null;
  },

  async saveLicense(license) {
    await connectMongo();
    if (isConnected) {
      await LicenseModel.findOneAndUpdate(
        { licenseKey: license.licenseKey },
        license,
        { upsert: true, new: true }
      );
      return license;
    }
    const all = readLocalDb();
    const idx = all.findIndex(l => l.licenseKey === license.licenseKey);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...license };
    } else {
      all.push(license);
    }
    writeLocalDb(all);
    return license;
  }
};

module.exports = db;
