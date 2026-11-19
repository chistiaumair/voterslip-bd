const { contextBridge, ipcRenderer } = require('electron');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const licenseStorageDir = path.join(appDataDir, 'voter-slip-generator');
const machineIdFile = path.join(licenseStorageDir, 'machine.id');
const licenseKeyFile = path.join(licenseStorageDir, 'app_license.key');

function ensureLicenseDir() {
  try {
    if (!fs.existsSync(licenseStorageDir)) {
      fs.mkdirSync(licenseStorageDir, { recursive: true });
    }
  } catch (e) {}
}

function getMachineId() {
  ensureLicenseDir();

  // 1. If Machine ID was already saved previously, return it permanently
  try {
    if (fs.existsSync(machineIdFile)) {
      const savedId = fs.readFileSync(machineIdFile, 'utf8').trim();
      if (savedId && /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(savedId)) {
        return savedId;
      }
    }
  } catch (e) {}

  let hardwareDetails = '';

  // 2. Windows Registry MachineGuid (Universal, static, and permanent across reboots on Windows)
  try {
    const regCmd = 'REG QUERY "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid';
    const output = execSync(regCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const match = output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
    if (match && match[1] && match[1].trim()) {
      hardwareDetails = match[1].trim();
    }
  } catch (e) {}

  // 3. PowerShell CimInstance (Modern WMI replacement)
  if (!hardwareDetails) {
    try {
      const psCmd = 'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"';
      const output = execSync(psCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (output && output.trim() && output.trim() !== '00000000-0000-0000-0000-000000000000') {
        hardwareDetails = output.trim();
      }
    } catch (e) {}
  }

  // 4. WMIC csproduct UUID
  if (!hardwareDetails) {
    try {
      const wmicCmd = 'wmic csproduct get uuid';
      const output = execSync(wmicCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      if (lines.length > 1 && lines[1].trim() && lines[1].trim() !== '00000000-0000-0000-0000-000000000000') {
        hardwareDetails = lines[1].trim();
      }
    } catch (e) {}
  }

  // 5. Fallback: OS Hostname + Network MAC + Username
  if (!hardwareDetails) {
    try {
      const interfaces = os.networkInterfaces();
      let mac = '';
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
            mac = iface.mac;
            break;
          }
        }
        if (mac) break;
      }
      hardwareDetails = `${os.hostname()}_${mac}_${os.userInfo().username}`;
    } catch (e) {
      hardwareDetails = process.platform + '_' + process.arch;
    }
  }

  const hash = crypto.createHash('sha256').update(hardwareDetails).digest('hex').toUpperCase();
  const machineId = `${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;

  // Save to disk permanently so it never changes
  try {
    fs.writeFileSync(machineIdFile, machineId, 'utf8');
  } catch (e) {}

  return machineId;
}

function saveLicenseKeyToDisk(key) {
  if (!key) return;
  ensureLicenseDir();
  try {
    fs.writeFileSync(licenseKeyFile, key.trim(), 'utf8');
  } catch (e) {}
}

function getSavedLicenseKeyFromDisk() {
  try {
    if (fs.existsSync(licenseKeyFile)) {
      return fs.readFileSync(licenseKeyFile, 'utf8').trim();
    }
  } catch (e) {}
  return "";
}

function verifyLicense(licenseKey) {
  // Automatically bypass license check in dev mode (npm start)
  const isDev = process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);
  if (isDev) return true;

  const keyToVerify = (licenseKey || getSavedLicenseKeyFromDisk() || "").trim();
  if (!keyToVerify) return false;

  const machineId = getMachineId();
  const secret = 'VOTER_SLIP_SECRET_SALT_2026';
  const hash = crypto.createHash('sha256').update(machineId + secret).digest('hex').toUpperCase();
  const expectedKey = `LIC-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;

  const isValid = (keyToVerify === expectedKey);
  if (isValid) {
    saveLicenseKeyToDisk(keyToVerify);
  }
  return isValid;
}

contextBridge.exposeInMainWorld('licensing', {
  getMachineId: () => getMachineId(),
  verifyLicense: (key) => verifyLicense(key),
  saveLicense: (key) => saveLicenseKeyToDisk(key),
  getSavedLicense: () => getSavedLicenseKeyFromDisk()
});

contextBridge.exposeInMainWorld('slicer', {
  selectDirectory: (title) => ipcRenderer.invoke('select-directory', title),
  startSlicing: (options) => ipcRenderer.send('start-slicing', options),
  onProgress: (callback) => ipcRenderer.on('slicer-progress', (event, data) => callback(data)),
  onLog: (callback) => ipcRenderer.on('slicer-log', (event, data) => callback(data)),
  onStderr: (callback) => ipcRenderer.on('slicer-stderr', (event, data) => callback(data)),
  onFinished: (callback) => ipcRenderer.on('slicer-finished', (event, data) => callback(data)),
  readImageAsDataUrl: (filePath) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const data = fs.readFileSync(filePath);
        return `data:${mime};base64,${data.toString('base64')}`;
      }
    } catch (e) {
      console.error('Error reading image as data URL:', e);
    }
    return null;
  }
});

function readExtractedPdfData() {
  try {
    let filePath = path.join(__dirname, 'votcenter', 'extracted_data', 'extracted_pdf_data.json');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, 'votcenter', 'matching_data', 'extracted_pdf_data.json');
    }
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading extracted_pdf_data.json:", e);
  }
  return null;
}

contextBridge.exposeInMainWorld('matcher', {
  startMatching: (options) => ipcRenderer.send('start-matching', options),
  onProgress: (callback) => ipcRenderer.on('matcher-progress', (event, data) => callback(data)),
  onLog: (callback) => ipcRenderer.on('matcher-log', (event, data) => callback(data)),
  onStderr: (callback) => ipcRenderer.on('matcher-stderr', (event, data) => callback(data)),
  onFinished: (callback) => ipcRenderer.on('matcher-finished', (event, data) => callback(data)),
  readExtractedPdfData: () => readExtractedPdfData(),
  getDocxList: (wordDir) => ipcRenderer.invoke('get-docx-list', wordDir),
  previewDocx: (wordDir, filename = null) => ipcRenderer.invoke('preview-docx', wordDir, filename)
});

contextBridge.exposeInMainWorld('extractor', {
  startExtraction: (options) => ipcRenderer.send('start-extracting-text', options),
  onProgress: (callback) => ipcRenderer.on('extractor-progress', (event, data) => callback(data)),
  onLog: (callback) => ipcRenderer.on('extractor-log', (event, data) => callback(data)),
  onStderr: (callback) => ipcRenderer.on('extractor-stderr', (event, data) => callback(data)),
  onFinished: (callback) => ipcRenderer.on('extractor-finished', (event, data) => callback(data)),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  readTextFile: (filePath) => {
    try {
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      console.error("Error reading text file:", e);
    }
    return null;
  },
  listExtractedFiles: (dirPath) => {
    try {
      if (fs.existsSync(dirPath)) {
        return fs.readdirSync(dirPath).filter(f => f.endsWith('.txt'));
      }
    } catch (e) {
      console.error("Error listing files:", e);
    }
    return [];
  }
});

contextBridge.exposeInMainWorld('profileManager', {
  saveProfileDefaultsToCode: (profileData) => ipcRenderer.invoke('save-profile-defaults-to-code', profileData),
  loadUserProfilesFromDisk: () => ipcRenderer.invoke('load-user-profiles-from-disk')
});
