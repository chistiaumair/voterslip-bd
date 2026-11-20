/**
 * Local Web Server for Voter Slip Generator
 * Zero-dependency pure Node.js server
 * Provides static file serving & native OS filesystem access for Web Mode
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const readline = require('readline');

const PORT = 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Robust Folder/File Resolver across Windows Desktop, User Profile & Workspace
function resolveExistingPath(inputPath) {
  if (!inputPath) return null;
  let clean = String(inputPath).trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  clean = clean.replace(/\s*\(\d+\s*টি\s*PDF[^\)]*\)/i, '').trim();
  if (clean.length > 3 && /[\\\/]$/.test(clean)) {
    clean = clean.replace(/[\\\/]+$/, '');
  }
  if (!clean) return null;

  if (fs.existsSync(clean)) return path.resolve(clean);

  const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
  const candidates = [
    path.join(userProfile, 'Desktop', clean),
    path.join(ROOT_DIR, '..', clean),
    path.join(ROOT_DIR, clean),
    path.join(userProfile, clean),
    path.join(userProfile, 'Downloads', clean),
    path.join(userProfile, 'Documents', clean)
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return path.resolve(cand);
    }
  }

  return null;
}

function resolveOutputDir(outPath, previewOnly) {
  let clean = String(outPath || '').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (clean.length > 3 && /[\\\/]$/.test(clean)) {
    clean = clean.replace(/[\\\/]+$/, '');
  }
  if (!clean) {
    if (previewOnly) {
      const p = path.join(os.tmpdir(), 'voter_slicer_preview');
      fs.mkdirSync(p, { recursive: true });
      return p;
    }
    return null;
  }
  if (fs.existsSync(clean)) return path.resolve(clean);

  const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
  const candidates = [
    path.join(userProfile, 'Desktop', clean),
    path.join(ROOT_DIR, '..', clean),
    path.join(userProfile, clean),
    path.join(ROOT_DIR, clean)
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return path.resolve(cand);
  }
  if (/^[a-zA-Z]:[\\\/]/.test(clean)) {
    try { fs.mkdirSync(clean, { recursive: true }); return path.resolve(clean); } catch (e) {}
  }
  const defaultDir = path.join(userProfile, 'Desktop', clean);
  try { fs.mkdirSync(defaultDir, { recursive: true }); return defaultDir; } catch (e) {}
  return path.resolve(ROOT_DIR, clean);
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-output-dir, x-file-name'
    });
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  // 1. API: Quick Standard System Folders
  if (pathname === '/api/quick-folders' && req.method === 'GET') {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
    const desktop = path.join(userProfile, 'Desktop');
    const downloads = path.join(userProfile, 'Downloads');
    const documents = path.join(userProfile, 'Documents');
    const voterCards = path.join(desktop, 'VoterCards');

    // Detect drives
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const drives = [];
    for (let i = 0; i < letters.length; i++) {
      const d = letters[i] + ':\\';
      try {
        if (fs.existsSync(d)) drives.push(d);
      } catch (e) {}
    }

    sendJson(res, 200, {
      success: true,
      home: userProfile,
      desktop: desktop,
      downloads: downloads,
      documents: documents,
      voterCards: voterCards,
      drives: drives
    });
    return;
  }

  // 1b. API: Browse Folders in Directory
  if (pathname === '/api/browse-folders' && req.method === 'GET') {
    let targetDir = urlObj.searchParams.get('dir') || '';
    if (!targetDir) {
      targetDir = path.join(process.env.USERPROFILE || 'C:\\', 'Desktop');
    }

    try {
      if (!fs.existsSync(targetDir)) {
        targetDir = process.env.USERPROFILE || 'C:\\';
      }

      const items = fs.readdirSync(targetDir, { withFileTypes: true });
      const subdirs = items
        .filter(item => {
          try {
            return item.isDirectory() && !item.name.startsWith('$') && !item.name.startsWith('.');
          } catch (e) {
            return false;
          }
        })
        .map(item => item.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const parentDir = path.dirname(targetDir);
      sendJson(res, 200, {
        success: true,
        current: targetDir,
        parent: (parentDir !== targetDir) ? parentDir : null,
        folders: subdirs
      });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message, current: targetDir, folders: [] });
    }
    return;
  }

  // 1c. API: Create New Folder
  if (pathname === '/api/create-folder' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const dirPath = payload.dir;
      if (!dirPath) {
        sendJson(res, 400, { error: 'Missing dir path' });
        return;
      }
      fs.mkdirSync(dirPath, { recursive: true });
      sendJson(res, 200, { success: true, path: dirPath });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // 1b. API: List PDFs in Folder
  if (pathname === '/api/list-pdfs' && req.method === 'GET') {
    const rawFolder = urlObj.searchParams.get('folder') || '';
    const folder = resolveExistingPath(rawFolder);

    if (!folder || !fs.existsSync(folder)) {
      sendJson(res, 400, { success: false, error: `ফোল্ডার বা ফাইলটি পাওয়া যায়নি (${rawFolder})` });
      return;
    }
    try {
      if (fs.statSync(folder).isFile()) {
        if (folder.toLowerCase().endsWith('.pdf')) {
          const stats = fs.statSync(folder);
          const fileName = path.basename(folder);
          const parentDir = path.dirname(folder);
          sendJson(res, 200, {
            success: true,
            folder: parentDir,
            files: [{ name: fileName, path: folder, size: stats.size }]
          });
          return;
        } else {
          sendJson(res, 400, { success: false, error: 'সিলেক্ট করা ফাইলটি পিডিএফ নয়' });
          return;
        }
      }

      const items = fs.readdirSync(folder, { withFileTypes: true });
      const pdfFiles = [];
      for (const item of items) {
        if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) {
          const fullPath = path.join(folder, item.name);
          const stats = fs.statSync(fullPath);
          pdfFiles.push({
            name: item.name,
            path: fullPath,
            size: stats.size
          });
        }
      }
      pdfFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      sendJson(res, 200, { success: true, folder, files: pdfFiles });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // 1c. API: Stream PDF file content
  if (pathname === '/api/get-pdf' && req.method === 'GET') {
    const filePath = urlObj.searchParams.get('path');
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('PDF not found');
      return;
    }
    try {
      const stats = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': stats.size,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(err.message);
    }
    return;
  }

  // 2. API: Save Card Image Directly to Folder
  if (pathname === '/api/save-card' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      let { baseDir, subDir, fileName, base64 } = payload;
      if (!baseDir || !fileName || !base64) {
        sendJson(res, 400, { error: 'Missing baseDir, fileName, or base64' });
        return;
      }

      let resolvedBaseDir = baseDir;
      if (!/^[a-zA-Z]:[\\\/]/.test(resolvedBaseDir)) {
        const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
        const userSub = path.join(userProfile, resolvedBaseDir);
        if (fs.existsSync(userSub)) {
          resolvedBaseDir = userSub;
        } else {
          resolvedBaseDir = path.resolve(ROOT_DIR, resolvedBaseDir);
        }
      }

      const targetDir = path.resolve(resolvedBaseDir, subDir || '');
      fs.mkdirSync(targetDir, { recursive: true });

      const commaIdx = base64.indexOf(',');
      const cleanB64 = commaIdx !== -1 ? base64.slice(commaIdx + 1) : base64;
      const buffer = Buffer.from(cleanB64, 'base64');

      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, buffer);

      sendJson(res, 200, { success: true, path: filePath });
    } catch (err) {
      console.error('Error saving card:', err);
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 2b. API: High-Speed Batch Save Card Images Directly to Folder
  if (pathname === '/api/save-cards-batch' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      let { baseDir, subDir, cards } = payload;
      if (!baseDir || !Array.isArray(cards) || cards.length === 0) {
        sendJson(res, 400, { error: 'Missing baseDir or cards array' });
        return;
      }

      let resolvedBaseDir = baseDir;
      if (!/^[a-zA-Z]:[\\\/]/.test(resolvedBaseDir)) {
        const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
        const userSub = path.join(userProfile, resolvedBaseDir);
        if (fs.existsSync(userSub)) {
          resolvedBaseDir = userSub;
        } else {
          resolvedBaseDir = path.resolve(ROOT_DIR, resolvedBaseDir);
        }
      }

      const targetDir = path.resolve(resolvedBaseDir, subDir || '');
      fs.mkdirSync(targetDir, { recursive: true });

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card.fileName || !card.base64) continue;
        const commaIdx = card.base64.indexOf(',');
        const cleanB64 = commaIdx !== -1 ? card.base64.slice(commaIdx + 1) : card.base64;
        const buffer = Buffer.from(cleanB64, 'base64');
        const filePath = path.join(targetDir, card.fileName);
        fs.writeFileSync(filePath, buffer);
      }

      sendJson(res, 200, { success: true, count: cards.length });
    } catch (err) {
      console.error('Error saving cards batch:', err);
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 2bb. API: Save Generated PDF Directly to Folder
  if (pathname === '/api/save-pdf' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      let { outputDir, fileName, base64 } = payload;
      if (!outputDir || !fileName || !base64) {
        sendJson(res, 400, { error: 'Missing outputDir, fileName, or base64' });
        return;
      }
      const resolvedDir = resolveOutputDir(outputDir, false);
      if (!resolvedDir) {
        sendJson(res, 400, { error: 'Could not resolve output directory' });
        return;
      }
      fs.mkdirSync(resolvedDir, { recursive: true });
      const commaIdx = base64.indexOf(',');
      const cleanB64 = commaIdx !== -1 ? base64.slice(commaIdx + 1) : base64;
      const buffer = Buffer.from(cleanB64, 'base64');
      const safeName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const targetPath = path.join(resolvedDir, safeName);
      fs.writeFileSync(targetPath, buffer);
      sendJson(res, 200, { success: true, path: targetPath });
    } catch (err) {
      console.error('Error saving PDF:', err);
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 2bb-fast. API: Ultra-fast Binary Stream Save (Zero Base64 / Zero JSON memory overhead)
  if (pathname === '/api/save-pdf-binary' && req.method === 'POST') {
    try {
      const rawOutputDir = req.headers['x-output-dir'] || urlObj.searchParams.get('outputDir');
      const rawFileName = req.headers['x-file-name'] || urlObj.searchParams.get('fileName');
      const outputDir = decodeURIComponent(rawOutputDir || '');
      const fileName = decodeURIComponent(rawFileName || '');
      if (!outputDir || !fileName) {
        sendJson(res, 400, { error: 'Missing outputDir or fileName in query/headers' });
        return;
      }
      const resolvedDir = resolveOutputDir(outputDir, false);
      if (!resolvedDir) {
        sendJson(res, 400, { error: 'Could not resolve output directory' });
        return;
      }
      fs.mkdirSync(resolvedDir, { recursive: true });
      const safeName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const targetPath = path.join(resolvedDir, safeName);
      const writeStream = fs.createWriteStream(targetPath);
      req.pipe(writeStream);
      writeStream.on('finish', () => {
        sendJson(res, 200, { success: true, path: targetPath });
      });
      writeStream.on('error', (err) => {
        console.error('Binary save stream error:', err);
        sendJson(res, 500, { error: err.message });
      });
    } catch (err) {
      console.error('Error in save-pdf-binary:', err);
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 2c. API: Check if backend python slicer is available
  if (pathname === '/api/check-backend-slicer' && req.method === 'GET') {
    const pyScript = path.join(ROOT_DIR, 'votcenter', 'pdf_slice.py');
    const available = fs.existsSync(pyScript);
    sendJson(res, 200, { available });
    return;
  }

  // 2d. API: Ultra-Fast Native Python Slicer Runner with real-time JSON chunked streaming
  if (pathname === '/api/run-slicer-backend' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      let {
        inputDir,
        outputDir,
        lines = 2,
        hideBorders = true,
        previewOnly = false,
        padTop = 0,
        padBottom = 0,
        padLeft = 0,
        padRight = 0,
        shaveTop = 3,
        shaveLeft = 3,
        resolutionScale = 2.0,
        uploadedPdfs
      } = payload;

      let actualInputDir = null;
      let tempUploadDir = null;

      // If PDFs are uploaded directly from browser
      if (Array.isArray(uploadedPdfs) && uploadedPdfs.length > 0) {
        tempUploadDir = path.join(ROOT_DIR, 'temp_slicer_' + Date.now());
        fs.mkdirSync(tempUploadDir, { recursive: true });
        for (const item of uploadedPdfs) {
          if (!item.name || !item.base64) continue;
          const commaIdx = item.base64.indexOf(',');
          const cleanB64 = commaIdx !== -1 ? item.base64.slice(commaIdx + 1) : item.base64;
          fs.writeFileSync(path.join(tempUploadDir, item.name), Buffer.from(cleanB64, 'base64'));
        }
        actualInputDir = tempUploadDir;
      } else {
        actualInputDir = resolveExistingPath(inputDir);
      }

      let resolvedOutDir = resolveOutputDir(outputDir, previewOnly);

      if (!actualInputDir || !fs.existsSync(actualInputDir)) {
        sendJson(res, 400, { error: `ইনপুট ফোল্ডার বা ফাইল পাওয়া যায়নি (${inputDir || ''})` });
        return;
      }
      if (!resolvedOutDir) {
        sendJson(res, 400, { error: 'আউটপুট ফোল্ডার নির্ধারণ করা হয়নি' });
        return;
      }

      const scriptPath = path.join(ROOT_DIR, 'votcenter', 'pdf_slice.py');
      const pyArgs = [
        scriptPath,
        '-i', actualInputDir,
        '-o', resolvedOutDir,
        '--lines', String(lines),
        '-j'
      ];
      if (hideBorders) pyArgs.push('-b');
      if (previewOnly) pyArgs.push('--preview-only');
      if (padTop) pyArgs.push('--pad-top', String(padTop));
      if (padBottom) pyArgs.push('--pad-bottom', String(padBottom));
      if (padLeft) pyArgs.push('--pad-left', String(padLeft));
      if (padRight) pyArgs.push('--pad-right', String(padRight));
      if (shaveTop !== null && shaveTop !== undefined) pyArgs.push('--shave-top', String(shaveTop));
      if (shaveLeft !== null && shaveLeft !== undefined) pyArgs.push('--shave-left', String(shaveLeft));
      if (resolutionScale) pyArgs.push('--resolution-scale', String(resolutionScale));

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      console.log(`[Web Slicer Native] Spawning: python ${pyArgs.join(' ')}`);
      const proc = spawn('python', pyArgs);
      const rl = readline.createInterface({ input: proc.stdout, terminal: false });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          res.write(trimmed + '\n');
        }
      });

      proc.stderr.on('data', (d) => {
        const msg = JSON.stringify({ status: 'stderr', message: d.toString() });
        res.write(msg + '\n');
      });

      proc.on('close', (code) => {
        if (tempUploadDir && fs.existsSync(tempUploadDir)) {
          try { fs.rmSync(tempUploadDir, { recursive: true, force: true }); } catch (e) {}
        }
        const doneMsg = JSON.stringify({ status: 'exit', code: code, outputDir: resolvedOutDir });
        res.write(doneMsg + '\n');
        res.end();
      });

      proc.on('error', (err) => {
        if (tempUploadDir && fs.existsSync(tempUploadDir)) {
          try { fs.rmSync(tempUploadDir, { recursive: true, force: true }); } catch (e) {}
        }
        const errMsg = JSON.stringify({ status: 'error', error: err.message });
        res.write(errMsg + '\n');
        res.end();
      });

      return;
    } catch (err) {
      console.error('Backend slicer error:', err);
      sendJson(res, 500, { error: err.message });
      return;
    }
  }

  // 2e. API: Native Python Text Extractor Runner with real-time JSON chunked streaming
  if (pathname === '/api/run-extractor-backend' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      let { inputDir, outputDir } = payload;
      let actualInputDir = resolveExistingPath(inputDir);
      let resolvedOutDir = resolveOutputDir(outputDir, false);

      if (!actualInputDir || !fs.existsSync(actualInputDir)) {
        sendJson(res, 400, { error: `ইনপুট ফোল্ডার পাওয়া যায়নি (${inputDir || ''})` });
        return;
      }
      if (!resolvedOutDir) {
        sendJson(res, 400, { error: 'আউটপুট ফোল্ডার নির্ধারণ করা হয়নি' });
        return;
      }

      try {
        fs.mkdirSync(resolvedOutDir, { recursive: true });
      } catch (e) {}

      const scriptPath = path.join(ROOT_DIR, 'votcenter', 'extract_voter_text.py');
      const pyArgs = [scriptPath, '-i', actualInputDir, '-o', resolvedOutDir, '-j'];

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      console.log(`[Web Extractor Native] Spawning: python ${pyArgs.join(' ')}`);
      const proc = spawn('python', pyArgs);
      const rl = readline.createInterface({ input: proc.stdout, terminal: false });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          res.write(trimmed + '\n');
        }
      });

      proc.stderr.on('data', (d) => {
        const msg = JSON.stringify({ status: 'stderr', message: d.toString() });
        res.write(msg + '\n');
      });

      proc.on('close', (code) => {
        const doneMsg = JSON.stringify({ status: 'exit', code: code, outputDir: resolvedOutDir });
        res.write(doneMsg + '\n');
        res.end();
      });

      proc.on('error', (err) => {
        const errMsg = JSON.stringify({ status: 'error', error: err.message });
        res.write(errMsg + '\n');
        res.end();
      });

      return;
    } catch (err) {
      console.error('Backend extractor error:', err);
      sendJson(res, 500, { error: err.message });
      return;
    }
  }

  // 2f. API: List Extracted Files in Output Folder
  if (pathname === '/api/list-extracted-files' && req.method === 'GET') {
    try {
      const folderParam = urlObj.searchParams.get('folder');
      const folderPath = resolveExistingPath(folderParam);
      if (folderPath && fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        const txtFiles = files.filter(f => f.toLowerCase().endsWith('.txt') && !f.toLowerCase().startsWith('.'));
        const fileList = txtFiles.map(f => {
          let count = 0;
          try {
            const content = fs.readFileSync(path.join(folderPath, f), 'utf8');
            count = (content.match(/ভোটার নম্বর\s*:/g) || []).length || (content.match(/ক্রমিক\s*:/g) || []).length || 1;
          } catch (e) {}
          return [f, count];
        });
        sendJson(res, 200, { success: true, files: fileList });
      } else {
        sendJson(res, 200, { success: true, files: [] });
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 2g. API: Read Text File Content
  if (pathname === '/api/read-text-file' && req.method === 'GET') {
    try {
      const fileParam = urlObj.searchParams.get('path');
      const filePath = resolveExistingPath(fileParam);
      if (filePath && fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        sendJson(res, 200, { success: true, content: content });
      } else {
        sendJson(res, 404, { error: 'File not found' });
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 3. API: Open Folder in Windows Explorer
  if (pathname === '/api/open-folder' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const folderPath = payload.path;
      if (folderPath && fs.existsSync(folderPath)) {
        exec(`explorer.exe "${path.resolve(folderPath)}"`);
        sendJson(res, 200, { success: true });
      } else {
        sendJson(res, 404, { error: 'Folder not found' });
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 4. Static File Serving (Home Page on / & SPA routing for /admin, /login)
  const lowerPath = pathname.toLowerCase();
  if (req.method === 'GET' && lowerPath === '/index.html') {
    const queryStr = urlObj.search || '';
    res.writeHead(302, { Location: '/' + queryStr });
    res.end();
    return;
  }
  if (req.method === 'GET' && (lowerPath === '/admin/' || lowerPath === '/login/')) {
    const queryStr = urlObj.search || '';
    res.writeHead(302, { Location: lowerPath.slice(0, -1) + queryStr });
    res.end();
    return;
  }

  let servePath = pathname;
  const cleanPath = pathname.replace(/\/+$/, '').toLowerCase();
  if (cleanPath === '' || cleanPath === '/home' || cleanPath === '/admin' || cleanPath === '/login' || cleanPath === '/dashboard') {
    servePath = '/index.html';
  }

  let filePath = path.join(ROOT_DIR, servePath === '/' ? 'index.html' : servePath);

  // Security check: prevent directory traversal outside ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` Voter Slip Server running at http://localhost:${PORT}`);
  console.log(` Native Folder & File Saving API Enabled`);
  console.log(`=======================================================`);
});
