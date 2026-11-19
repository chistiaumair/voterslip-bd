const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const os = require('os');

// Prevent Chromium disk cache, GPU cache, and QuotaManager database lock collisions
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-features', 'StorageBuckets,CalculateNativeWinOcclusion');


function getScriptPath(scriptName) {
  if (app.isPackaged) {
    const unpackedPath = path.join(__dirname, '..', 'app.asar.unpacked', scriptName);
    if (fs.existsSync(unpackedPath)) return unpackedPath;
    const resourcesPath = path.join(process.resourcesPath, 'app.asar.unpacked', scriptName);
    if (fs.existsSync(resourcesPath)) return resourcesPath;
    return unpackedPath;
  }
  return path.join(__dirname, scriptName);
}

function getSpawnConfig(exeRelativePath, pyRelativePath, args = []) {
  const exePath = getScriptPath(exeRelativePath);
  if (app.isPackaged) {
    return { cmd: exePath, args: args };
  }
  const pyPath = path.join(__dirname, pyRelativePath);
  if (fs.existsSync(pyPath)) {
    return { cmd: 'python', args: [pyPath, ...args] };
  }
  return { cmd: exePath, args: args };
}

let currentSlicerProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: false,
  });

  // DevTools disabled by default
  // if (!app.isPackaged) {
  //   win.webContents.openDevTools();
  // }

  win.loadFile(path.join(__dirname, 'index.html'));

  // Auto-reload window in development whenever index.html or js files are saved
  if (!app.isPackaged) {
    let reloadTimeout = null;
    const watchPaths = [
      path.join(__dirname, 'index.html'),
      path.join(__dirname, 'js', 'voter_slip_template.js')
    ];
    watchPaths.forEach(p => {
      if (fs.existsSync(p)) {
        fs.watch(p, (eventType) => {
          if (eventType === 'change') {
            clearTimeout(reloadTimeout);
            reloadTimeout = setTimeout(() => {
              if (!win.isDestroyed()) {
                win.webContents.reload();
              }
            }, 150);
          }
        });
      }
    });
  }
  if (process.env.TEST_VERIFY === '1') {
    win.webContents.on('did-finish-load', async () => {
      try {
        const testRes = await win.webContents.executeJavaScript(`
          (async () => {
            try {
              const fontStack = '"Noto Sans Bengali", "Segoe UI", Arial, sans-serif';
              // Check preset
              let tplConfig = window.VoterSlipTemplate ? window.VoterSlipTemplate.getConfig() : null;
              if (window.VoterSlipTemplate && window.VoterSlipTemplate.applyBuiltinPreset) {
                window.VoterSlipTemplate.applyBuiltinPreset('preset_default_9_portrait');
                tplConfig = window.VoterSlipTemplate.getConfig();
              }

              // Test card geometry for 9 slips portrait (A4: 210x297, 3 cols x 3 rows)
              const cellW_mm = 64.7;
              const cellH_mm = 94.0;
              const canvasScale = 3.7795;
              const pxW = cellW_mm * canvasScale;
              const pxH = cellH_mm * canvasScale;

              let dividerY = 0;
              if (window.VoterSlipTemplate && window.VoterSlipTemplate.getDividerY) {
                dividerY = window.VoterSlipTemplate.getDividerY(pxW, pxH, tplConfig);
              }

              // Measure header
              const testCanvas = document.createElement('canvas');
              testCanvas.width = Math.ceil(pxW);
              testCanvas.height = Math.ceil(pxH);
              const testCtx = testCanvas.getContext('2d');

              const opts = {
                title1: "ভোট কেন্দ্র: শহীদ বীর উত্তম লেফটেন্যান্ট আনোয়ার গার্লস স্কুল অ্যান্ড কলেজ",
                title2: "ভোটার এলাকা: ঢাকা সেনানিবাস",
                title3: "ওয়ার্ড নং: ১৭",
                titleFontSize: 14,
                voterFontSize: 14,
                lineSpacing: 1.3,
                gridLayout: 9,
                pageOrientation: 'portrait'
              };

              const header = drawVoterHeaderBlock(testCtx, 0, 0, pxW, canvasScale, opts, fontStack);

              // Measure card footer
              const geo = getCellGeometry(0, 0, cellW_mm, cellH_mm, opts, canvasScale);

              // Test drawCellContent
              const voterText = "নাম: মোছাঃ সালমা বেগম\\nভোটার নং: ২৬০৫৩০০০০০০১\\nপিতা: মৃত আব্দুল জলিল\\nমাতা: মোছাঃ খাদিজা বেগম\\nপেশা: গৃহিণী\\nঠিকানা: বাসা নং ১২, রোড নং ৩, ঢাকা সেনানিবাস";
              
              opts.enableSlipTemplate = true;
              drawCellContent(
                testCtx,
                0,
                0,
                pxW,
                pxH,
                voterText,
                opts,
                canvasScale
              );

              // Check footer metrics
              const baseScale = Math.min(pxW / 270, pxH / 220);
              let footFontSize = (tplConfig.footerFontSize || 7.5) * baseScale;
              const maxF1W = pxW * 0.94;
              testCtx.font = "bold " + footFontSize + "px " + fontStack;
              const f1Text = tplConfig.footerLeft || "প্রচারে: শার্শা ইউনিয়নের সর্বস্তরের জনগণ।";
              let rawF1W = testCtx.measureText(f1Text).width;
              if (rawF1W > maxF1W) {
                footFontSize = Math.max(footFontSize * 0.40, footFontSize * (maxF1W / rawF1W));
              }

              let f2FontSize = (tplConfig.footerLine2FontSize || tplConfig.footerFontSize || 7.5) * baseScale;
              testCtx.font = "bold " + f2FontSize + "px " + fontStack;
              const f2Left = tplConfig.footerCenter || "মুদ্রণে: বেনাপোল প্রিন্টিং প্রেস, বেনাপোল";
              const f2Right = tplConfig.footerRight || "ফোন: ০১৭৮১৯২৩৮৩৪, তারিখ: ২৩/০৪/২০২৬";
              let rawF2LeftW = testCtx.measureText(f2Left).width;
              let rawF2RightW = testCtx.measureText(f2Right).width;
              const maxF2TotalW = pxW * 0.92;
              const minCenterGap = Math.max(6, 8 * baseScale);
              if ((rawF2LeftW + rawF2RightW + minCenterGap) > maxF2TotalW) {
                const shrinkRatio = (maxF2TotalW - minCenterGap) / (rawF2LeftW + rawF2RightW);
                f2FontSize = Math.max(f2FontSize * 0.40, f2FontSize * Math.min(1.0, shrinkRatio));
                testCtx.font = "bold " + f2FontSize + "px " + fontStack;
                rawF2LeftW = testCtx.measureText(f2Left).width;
                rawF2RightW = testCtx.measureText(f2Right).width;
              }
              const actualF2Gap = pxW - (pxW * 0.03 + rawF2LeftW) - (pxW * 0.03 + rawF2RightW);

              // Test full generateTextPDF for 9 cards on 1 portrait page
              const savedBlobs = [];
              window.outputDirHandle = {
                getFileHandle: async (name) => ({
                  createWritable: async () => ({
                    write: async (blob) => { savedBlobs.push({ name, size: blob.size }); },
                    close: async () => {}
                  })
                })
              };

              window.__setCurrentJobData([
                "নাম: মোছাঃ সালমা বেগম\\nভোটার নং: ২৬০৫৩০০০০০০১\\nপিতা: মৃত আব্দুল জলিল\\nমাতা: মোছাঃ খাদিজা বেগম\\nপেশা: গৃহিণী\\nঠিকানা: বাসা নং ১২, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোঃ রফিকুল ইসলাম\\nভোটার নং: ২৬০৫৩০০০০০০২\\nপিতা: মোঃ নজরুল ইসলাম\\nমাতা: রোকেয়া বেগম\\nপেশা: ব্যবসায়ী\\nঠিকানা: বাসা নং ১৪, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোছাঃ ফাতেমা খাতুন\\nভোটার নং: ২৬০৫৩০০০০০০৩\\nপিতা: আব্দুল করিম\\nমাতা: রাবেয়া খাতুন\\nপেশা: শিক্ষিকা\\nঠিকানা: বাসা নং ১৬, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোঃ কামরুল হাসান\\nভোটার নং: ২৬০৫৩০০০০০০৪\\nপিতা: মৃত আবুল হোসেন\\nমাতা: সুফিয়া বেগম\\nপেশা: চাকরিজীবী\\nঠিকানা: বাসা নং ১৮, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোছাঃ নাসরিন আক্তার\\nভোটার নং: ২৬০৫৩০০০০০০৫\\nপিতা: সামসুল হক\\nমাতা: জাহানারা বেগম\\nপেশা: গৃহিণী\\nঠিকানা: বাসা নং ২০, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোঃ জহিরুল ইসলাম\\nভোটার নং: ২৬০৫৩০০০০০০৬\\nপিতা: মৃত সিরাজুল ইসলাম\\nমাতা: আনোয়ারা বেগম\\nপেশা: চালক\\nঠিকানা: বাসা নং ২২, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোছাঃ পারভীন সুলতানা\\nভোটার নং: ২৬০৫৩০০০০০০৭\\nপিতা: খন্দকার মিজানুর রহমান\\nমাতা: সেলিনা রহমান\\nপেশা: ডাক্তার\\nঠিকানা: বাসা নং ২৪, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোঃ আশরাফুল আলম\\nভোটার নং: ২৬০৫৩০০০০০০৮\\nপিতা: কাজী নুরুল আলম\\nমাতা: মেহেরুন্নেসা\\nপেশা: প্রকৌশলী\\nঠিকানা: বাসা নং ২৬, রোড নং ৩, ঢাকা সেনানিবাস",
                "নাম: মোছাঃ শাহনাজ পারভীন\\nভোটার নং: ২৬০৫৩০০০০০০৯\\nপিতা: মৃত মতিউর রহমান\\nমাতা: লতিফা বেগম\\nপেশা: গৃহিণী\\nঠিকানা: বাসা নং ২৮, রোড নং ৩, ঢাকা সেনানিবাস"
              ]);

              // Configure DOM elements for PDF generation
              window.skipPermissionCheck = true;
              if (document.getElementById("imagesPerPage")) document.getElementById("imagesPerPage").value = "9";
              if (document.getElementById("title1")) document.getElementById("title1").value = opts.title1;
              if (document.getElementById("title2")) document.getElementById("title2").value = opts.title2;
              if (document.getElementById("title3")) document.getElementById("title3").value = opts.title3;
              if (document.getElementById("topToggleSlipTemplate")) document.getElementById("topToggleSlipTemplate").checked = true;
              if (document.getElementById("pageOrientation")) document.getElementById("pageOrientation").value = "portrait";
              window.setMode("text");

              let pdfError = null;
              try {
                await window.generateTextPDF();
              } catch (e) {
                pdfError = e.message;
              }

              return {
                success: true,
                tplConfigPresetLoaded: !!tplConfig,
                cardWidth_px: Math.round(pxW),
                cardHeight_px: Math.round(pxH),
                dividerY_px: Math.round(dividerY),
                dividerY_mm: (dividerY / canvasScale).toFixed(1),
                dividerRatio: (dividerY / pxH).toFixed(3),
                footerStartY_mm: (geo.footerStartY / canvasScale).toFixed(1),
                availableSlotH_mm: ((geo.footerStartY - dividerY) / canvasScale).toFixed(1),
                headerCenterLines: header.centerLines,
                headerFontSize_pt: (header.centerFontSize / (canvasScale * 0.3528)).toFixed(1),
                headerTotalH_mm: (header.totalHeight / canvasScale).toFixed(1),
                footerLine1_fontSize: footFontSize.toFixed(1),
                footerLine1_width: rawF1W.toFixed(1),
                footerLine1_fits: rawF1W <= maxF1W,
                footerLine2_fontSize: f2FontSize.toFixed(1),
                footerLine2_gap: actualF2Gap.toFixed(1),
                footerLine2_noOverlap: actualF2Gap >= minCenterGap,
                pdfGenerated: savedBlobs.length > 0,
                pdfName: savedBlobs[0]?.name,
                pdfSizeBytes: savedBlobs[0]?.size,
                pdfError: pdfError,
                subLineExists: !!(opts.title2 || opts.title3)
              };
            } catch (err) {
              return { success: false, error: err.message, stack: err.stack };
            }
          })()
        `);
        fs.writeFileSync(path.join(__dirname, 'test_output.json'), JSON.stringify(testRes, null, 2), 'utf8');
      } catch (err) {
        fs.writeFileSync(path.join(__dirname, 'test_output.json'), JSON.stringify({ error: err.message }, null, 2), 'utf8');
      } finally {
        app.quit();
      }
    });
  }
}

// PDF Slicer Spawn Runner
function runPdfSlicer(options = {}, webContents) {
  const {
    inputDir,
    outputDir,
    cleanup = false,
    hideBorders = false,
    previewOnly = false,
    padTop = 0,
    padBottom = 0,
    padLeft = 0,
    padRight = 0,
    shaveTop = null,
    shaveLeft = null,
    resolutionScale = 2.0,
    lines = 6
  } = options;
  
  let finalOutputDir = outputDir;
  if (previewOnly) {
    finalOutputDir = app.getPath('temp');
  }
  
  try {
    fs.mkdirSync(finalOutputDir, { recursive: true });
  } catch (err) {
    console.error("Error creating output dir:", err);
  }
  
  let args = ['-i', inputDir, '-o', finalOutputDir, '-j'];
  if (cleanup) {
    args.push('-c');
  }
  if (hideBorders) {
    args.push('-b');
  }
  if (previewOnly) {
    args.push('--preview-only');
  }
  
  args.push('--pad-top', String(padTop));
  args.push('--pad-bottom', String(padBottom));
  args.push('--pad-left', String(padLeft));
  args.push('--pad-right', String(padRight));
  args.push('--resolution-scale', String(resolutionScale));
  args.push('--lines', String(lines));

  if (shaveTop !== null && shaveTop !== undefined && !isNaN(Number(shaveTop))) {
    args.push('--shave-top', String(shaveTop));
  }
  if (shaveLeft !== null && shaveLeft !== undefined && !isNaN(Number(shaveLeft))) {
    args.push('--shave-left', String(shaveLeft));
  }

  const spawnConfig = getSpawnConfig(
    path.join('bin', 'pdf_slice', 'pdf_slice.exe'),
    path.join('votcenter', 'pdf_slice.py'),
    args
  );

  if (currentSlicerProcess) {
    try {
      currentSlicerProcess.kill();
    } catch (e) {}
    currentSlicerProcess = null;
  }

  console.log(`Spawning Slicer: ${spawnConfig.cmd} ${spawnConfig.args.join(' ')}`);
  const proc = spawn(spawnConfig.cmd, spawnConfig.args);
  currentSlicerProcess = proc;

  const rl = readline.createInterface({
    input: proc.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const progressObj = JSON.parse(trimmed);
      webContents.send('slicer-progress', progressObj);
    } catch (err) {
      webContents.send('slicer-log', line);
    }
  });

  proc.stderr.on('data', (data) => {
    webContents.send('slicer-stderr', data.toString());
  });

  proc.on('error', (err) => {
    if (currentSlicerProcess === proc) {
      currentSlicerProcess = null;
    }
    webContents.send('slicer-finished', { code: -1, error: err.message });
  });

  proc.on('close', (code) => {
    if (currentSlicerProcess === proc) {
      currentSlicerProcess = null;
    }
    if (code === 0 && !previewOnly) {
      const batchJobs = [];
      let totalBoxes = 0;
      try {
        if (fs.existsSync(finalOutputDir)) {
          const entries = fs.readdirSync(finalOutputDir, { withFileTypes: true });
          const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
          subdirs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

          for (const sub of subdirs) {
            const subPath = path.join(finalOutputDir, sub);
            const imgFiles = fs.readdirSync(subPath)
              .filter(f => /\.(jpe?g|png)$/i.test(f))
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            if (imgFiles.length > 0) {
              totalBoxes += imgFiles.length;
              const cardFiles = imgFiles.map(imgName => {
                const fullPath = path.join(subPath, imgName);
                return {
                  name: imgName,
                  path: fullPath
                };
              });
              batchJobs.push({
                name: sub,
                files: cardFiles,
                status: 'pending'
              });
            }
          }
        }
      } catch (scanErr) {
        console.error("Error scanning slicer output directory:", scanErr);
      }

      webContents.send('slicer-finished', {
        code: 0,
        outputDir: finalOutputDir,
        jobs: batchJobs,
        totalCards: totalBoxes
      });
      return;
    }
    webContents.send('slicer-finished', { code, outputDir: finalOutputDir });
  });
}


// Voter Area Matcher Spawn Runner
let currentMatcherProcess = null;

function runVoterAreaMatcher(options = {}, webContents) {
  const {
    wordDir,
    pdfDir,
    outputDir,
    fileColumnConfigs = {}
  } = options;
  
  if (currentMatcherProcess) {
    try {
      currentMatcherProcess.kill();
    } catch (e) {}
    currentMatcherProcess = null;
  }
  
  webContents.send('matcher-log', "১. ওয়ার্ড ফাইল থেকে কেন্দ্র ও এলাকার তথ্য উদ্ধার করা শুরু হচ্ছে...\n");

  // Ensure output directory exists before writing config
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const configFilePath = path.join(outputDir, 'column_configs.json');
    fs.writeFileSync(configFilePath, JSON.stringify(fileColumnConfigs, null, 2), 'utf8');
    console.log(`Saved file-specific column configs to: ${configFilePath}`);
  } catch (err) {
    console.error("Error writing column config JSON:", err);
  }
  
  // Phase 1: Run extract_columns.py / extract_columns.exe
  const extractConfig = getSpawnConfig(
    path.join('bin', 'extract_columns', 'extract_columns.exe'),
    path.join('votcenter', 'extract_columns.py'),
    [
      '-i', wordDir,
      '-o', outputDir,
      '--config', path.join(outputDir, 'column_configs.json')
    ]
  );
  
  console.log(`Spawning extract: ${extractConfig.cmd} ${extractConfig.args.join(' ')}`);
  const extractProc = spawn(extractConfig.cmd, extractConfig.args);
  currentMatcherProcess = extractProc;
  
  const rlExtract = readline.createInterface({
    input: extractProc.stdout,
    terminal: false
  });
  
  rlExtract.on('line', (line) => {
    webContents.send('matcher-log', line);
  });
  
  extractProc.stderr.on('data', (data) => {
    webContents.send('matcher-stderr', data.toString());
  });
  
  extractProc.on('close', (code) => {
    if (code !== 0) {
      webContents.send('matcher-finished', { code: code, error: "ওয়ার্ড ফাইল এক্সট্রাকশন ব্যর্থ হয়েছে।" });
      currentMatcherProcess = null;
      return;
    }
    
    webContents.send('matcher-log', "\n২. পিডিএফ ফাইল রিড করে ওয়ার্ড ফাইলের সাথে মেলানো শুরু হচ্ছে...\n");
    
    // Phase 2: Run process_pdfs.py / process_pdfs.exe
    const refFile = path.join(outputDir, 'extracted_columns.json');
    const processConfig = getSpawnConfig(
      path.join('bin', 'process_pdfs', 'process_pdfs.exe'),
      path.join('votcenter', 'process_pdfs.py'),
      ['-i', pdfDir, '-o', outputDir, '-r', refFile]
    );
    
    console.log(`Spawning process: ${processConfig.cmd} ${processConfig.args.join(' ')}`);
    const processProc = spawn(processConfig.cmd, processConfig.args);
    currentMatcherProcess = processProc;
    
    const rlProcess = readline.createInterface({
      input: processProc.stdout,
      terminal: false
    });
    
    rlProcess.on('line', (line) => {
      webContents.send('matcher-log', line);
    });
    
    processProc.stderr.on('data', (data) => {
      webContents.send('matcher-stderr', data.toString());
    });
    
    processProc.on('close', (code2) => {
      currentMatcherProcess = null;
      if (code2 === 0) {
        webContents.send('matcher-finished', { code: 0 });
      } else {
        webContents.send('matcher-finished', { code: code2, error: "পিডিএফ ম্যাচিং ব্যর্থ হয়েছে।" });
      }
    });
  });
}

// Voter Text Extractor Spawn Runner
let currentExtractorProcess = null;

function runVoterTextExtractor(options = {}, webContents) {
  let { inputDir, outputDir } = options;

  if (!inputDir) inputDir = path.join(__dirname, 'votcenter', 'allpdf');
  if (!outputDir) outputDir = path.join(__dirname, 'votcenter', 'extracted_text_data');

  inputDir = path.isAbsolute(inputDir) ? inputDir : path.resolve(__dirname, inputDir);
  outputDir = path.isAbsolute(outputDir) ? outputDir : path.resolve(__dirname, outputDir);

  if (currentExtractorProcess) {
    try {
      currentExtractorProcess.kill();
    } catch (e) {}
    currentExtractorProcess = null;
  }

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    console.error("Error creating output dir:", err);
  }

  const args = ['-i', inputDir, '-o', outputDir, '-j'];
  const spawnConfig = getSpawnConfig(
    path.join('bin', 'extract_voter_text', 'extract_voter_text.exe'),
    path.join('votcenter', 'extract_voter_text.py'),
    args
  );

  console.log(`Spawning Text Extractor: ${spawnConfig.cmd} ${spawnConfig.args.join(' ')}`);
  const proc = spawn(spawnConfig.cmd, spawnConfig.args);
  currentExtractorProcess = proc;

  const rl = readline.createInterface({
    input: proc.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsedObj = JSON.parse(trimmed);
      webContents.send('extractor-progress', parsedObj);
    } catch (err) {
      webContents.send('extractor-log', line);
    }
  });

  proc.stderr.on('data', (data) => {
    webContents.send('extractor-stderr', data.toString());
  });

  proc.on('error', (err) => {
    if (currentExtractorProcess === proc) {
      currentExtractorProcess = null;
    }
    webContents.send('extractor-finished', { code: -1, error: err.message });
  });

  proc.on('close', (code) => {
    if (currentExtractorProcess === proc) {
      currentExtractorProcess = null;
    }
    webContents.send('extractor-finished', { code });
  });
}

app.whenReady().then(() => {
  // Register IPC Handlers
  ipcMain.handle('select-directory', async (event, title) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: title || 'Select Folder',
      properties: ['openDirectory']
    });
    if (result.canceled) {
      return null;
    } else {
      return result.filePaths[0];
    }
  });

  ipcMain.handle('get-docx-list', async (event, wordDir) => {
    return new Promise((resolve) => {
      if (!wordDir || !fs.existsSync(wordDir)) {
        resolve([]);
        return;
      }
      fs.readdir(wordDir, (err, files) => {
        if (err) {
          resolve([]);
          return;
        }
        const docxFiles = files.filter(f => f.endsWith('.docx') && !f.startsWith('~$'));
        resolve(docxFiles);
      });
    });
  });

  ipcMain.handle('preview-docx', async (event, wordDir, filename = null) => {
    return new Promise((resolve) => {
      const args = ['-i', wordDir];
      if (filename) {
        args.push('-f', filename);
      }
      
      const config = getSpawnConfig(
        path.join('bin', 'preview_docx', 'preview_docx.exe'),
        path.join('votcenter', 'preview_docx.py'),
        args
      );
      
      console.log(`Spawning preview-docx: ${config.cmd} ${config.args.join(' ')}`);
      const proc = spawn(config.cmd, config.args);
      
      let stdoutData = '';
      let stderrData = '';
      
      proc.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdoutData.trim());
            resolve(parsed);
          } catch (e) {
            resolve({ status: 'error', message: 'Failed to parse JSON from preview script: ' + e.message });
          }
        } else {
          resolve({ status: 'error', message: stderrData.trim() || `Preview process exited with code ${code}` });
        }
      });
      
      proc.on('error', (err) => {
        resolve({ status: 'error', message: err.message });
      });
    });
  });

  ipcMain.on('start-slicing', (event, options) => {
    runPdfSlicer(options, event.sender);
  });

  ipcMain.on('start-matching', (event, options) => {
    runVoterAreaMatcher(options, event.sender);
  });

  ipcMain.on('start-extracting-text', (event, options) => {
    runVoterTextExtractor(options, event.sender);
  });

  ipcMain.handle('open-path', async (event, targetPath) => {
    if (targetPath) {
      try {
        const resolvedPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(__dirname, targetPath);
        return await shell.openPath(resolvedPath);
      } catch (e) {
        console.error("Error opening path:", e);
      }
    }
    return false;
  });

  ipcMain.handle('save-profile-defaults-to-code', async (event, profileData) => {
    try {
      // 1. Always save to AppData disk storage for permanent persistence in .exe production mode
      try {
        const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        const storageDir = path.join(appDataDir, 'voter-slip-generator');
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
        const userProfilesFile = path.join(storageDir, 'user_profiles.json');
        fs.writeFileSync(userProfilesFile, JSON.stringify(profileData, null, 2), 'utf8');
      } catch (e) {
        console.warn('Could not write user_profiles.json to AppData:', e);
      }

      // 2. In dev mode (not packaged), also update source index.html
      if (!app.isPackaged) {
        const htmlPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(htmlPath)) {
          let content = fs.readFileSync(htmlPath, 'utf8');

          const formatSection = (obj, indent = "      ") => {
            if (!obj || typeof obj !== "object") return "";
            return Object.entries(obj)
              .map(([k, v]) => {
                const num = Number(v);
                const valStr = (!isNaN(num) && typeof v !== "boolean" && v !== "") ? num : JSON.stringify(v);
                return `${indent}${k}: ${valStr}`;
              })
              .join(',\n');
          };

          const entries = Object.entries(profileData)
            .map(([profKey, profObj]) => {
              return `    ${profKey}: {\n${formatSection(profObj, "        ")}\n    }`;
            })
            .join(',\n');

          const formatted = `const PROFILE_DEFAULTS = {\n${entries}\n  };`;

          const regex = /const\s+PROFILE_DEFAULTS\s*=\s*\{[\s\S]*?\n\s*\};/;
          if (regex.test(content)) {
            content = content.replace(regex, formatted);
            fs.writeFileSync(htmlPath, content, 'utf8');
            console.log('✅ PROFILE_DEFAULTS successfully rewritten in index.html');
          }
        }
      }
      return { success: true };
    } catch (err) {
      console.error('Error saving profile defaults:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('load-user-profiles-from-disk', async () => {
    try {
      const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const userProfilesFile = path.join(appDataDir, 'voter-slip-generator', 'user_profiles.json');
      if (fs.existsSync(userProfilesFile)) {
        return JSON.parse(fs.readFileSync(userProfilesFile, 'utf8'));
      }
    } catch (e) {}
    return null;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
