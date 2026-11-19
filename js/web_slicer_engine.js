/**
 * Web Slicer & Extractor Engine for Voter Slip Generator
 * 100% In-Browser, Local-First, Zero-Cloud Processing
 * Powered by Mozilla PDF.js & HTML5 Canvas
 */

(function (window) {
  'use strict';

  // 1. Setup PDF.js Worker
  if (typeof window.pdfjsLib !== 'undefined') {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdf.worker.min.js';
  }

  // 2. Comprehensive Exact Bengali Glyph Mapping Table for Election Commission PDFs
  const EC_2024_GLYPHS = {
    '\u0117ীন': 'দ্দীন', 'ėীন': 'দ্দীন',
    '\u0117িন': 'দ্দিন', 'ėিন': 'দ্দিন',
    'উি\u0117ন': 'উদ্দিন', 'উিėন': 'উদ্দিন',
    'উ\u0117ীন': 'উদ্দীন', 'উėীন': 'উদ্দীন',
    'উ\u0117িন': 'উদ্দিন', 'উėিন': 'উদ্দিন',
    '\u0117': 'দ্দী', 'ė': 'দ্দী',
    '\u008c': 'ন্', 'Œ': 'ন্',
    '\u008e': 'ফ্ফ', 'Ž': 'গু',
    '\u008f': 'শু',
    '\u0091': 'শ', '‘': 'শ',
    '\u0092': 'র্য', '’': 'র্য',
    '\u0093': 'র্ব', '“': 'র্ব',
    '\u0097': 'স্টার', '—': 'স্টার',
    '\u0098': 'হ', '˜': 'হ',
    '\u00cb': '্য', 'Ë': '্য',
    '\u00cd': 'ব', 'Í': 'ব',
    '\u00ce': 'র্', 'Î': 'র্',
    '\u00cf': 'ে', 'Ï': 'ে',
    '\u00d0': 'সৈ', 'Ð': 'সৈ',
    '\u00d1': 'ব্বা', 'Ñ': 'ব্বা',
    '\u00d4': 'ক্স', 'Ô': 'ক্স',
    '\u00d7': 'ক্ত', '×': 'ক্ত',
    '\u00da': 'ক্ষ্মী', 'Ú': 'ক্ষ্মী',
    '\u00e0': 'গ্ধা', 'à': 'গ্ধা',
    '\u00e5': 'গ্র', 'å': 'গ্র',
    '\u00ea': 'ঙ্গ', 'ê': 'ঙ্গ',
    '\u00ee': 'চ্চু', 'î': 'চ্চু',
    '\u00f4': 'র্ব',
    '\u00f5': 'জ্জ', 'õ': 'জ্জ',
    '\u00f9': 'ত্র', 'Ù': 'ত্র',
    '\u00fa': 'জ্ব', 'ú': 'জ্ব',
    '\u00fb': 'ঞ্চল', 'û': 'ঞ্চল',
    '\u00fd': 'ঞ্জ', 'ý': 'ঞ্জ',
    '\u0103': 'ড্রা', 'ă': 'ড্রা',
    '\u0110': 'ওশ', 'Đ': 'ওশ',
    '\u0113': 'ত্ত', 'ē': 'ত্ত',
    '\u0114': 'ত্র', 'Ĕ': 'ত্র',
    '\u0119': 'দ্রি', 'ę': 'দ্রি',
    '\u0122': 'ন্ত', 'Ģ': 'ন্ত',
    '\u0124': 'ন্দ', 'Ĥ': 'ন্দ',
    '\u0125': 'ন্ম', 'ĥ': 'ন্ম',
    '\u0127': 'ন্দ্র', 'ħ': 'ন্দ্র',
    '\u0128': 'ন্না', 'Ĩ': 'ন্না',
    '\u0129': 'ন্স', 'ĩ': 'ন্স',
    '\u012f': 'ন্য', 'į': 'ন্য',
    '\u0130': 'ন্দা', 'İ': 'ন্দা',
    '\u0131': 'প্লি', 'ı': 'প্লি',
    '\u0133': 'ঞ্জা', 'ĳ': 'ঞ্জা',
    '\u0134': 'প্র', 'Ĵ': 'প্র',
    '\u013a': 'ব্দ', 'ĺ': 'ব্দ',
    '\u013c': 'ব্বা', 'ļ': 'ব্বা',
    '\u013d': 'ব্রা', 'Ľ': 'ব্রা',
    '\u0142': 'ম্পা', 'ł': 'ম্পা',
    '\u0144': 'ম্ব', 'ń': 'ম্ব',
    '\u0146': 'ম্রা', 'ņ': 'ম্রা',
    '\u0147': 'ম্ম', 'Ň': 'ম্ম',
    '\u014c': 'ল্লা', 'Ō': 'ল্লা',
    '\u0150': 'ল্প', 'Ő': 'ল্প',
    '\u0154': 'শ্চ', 'Ŕ': 'শ্চ',
    '\u0158': 'শ্র', 'Ř': 'শ্র',
    '\u0159': 'শ্যা', 'ř': 'শ্যা',
    '\u015e': 'স্ট', 'Ş': 'স্ট',
    '\u0161': 'ষ্প', 'š': 'ষ্প',
    '\u0162': 'স্ট্রেশ', 'Ţ': 'স্ট্রেশ',
    '\u0166': 'স্ক', 'Ŧ': 'স্ক',
    '\u0168': 'স্টা', 'Ũ': 'স্টা',
    '\u0169': 'স্তা', 'ũ': 'স্তা',
    '\u016b': 'স্না', 'ū': 'স্না',
    '\u016e': 'তু', 'Ů': 'তু',
    '\u016f': 'স্মৃ', 'ů': 'স্মৃ',
    '\u0170': 'স্রা', 'Ű': 'স্রা',
    '\u0171': 'স্ত্রী', 'ű': 'স্ত্রী',
    '\u017d': 'গু',
    '\u017e': 'সেম', 'ž': 'সেম',
    '\u017f': 'নু', 'ſ': 'নু',
    '\u0180': 'সু', 'ƀ': 'সু',
    '\u0181': 'রু', 'Ɓ': 'রু',
    '\u0182': 'রূপভা', 'Ƃ': 'রূপভা',
    '\u0183': 'দু', 'ƃ': 'দু',
    '\u0184': 'শুকি', 'Ƅ': 'শুকি',
    '\u0185': 'হৃ', 'ƅ': 'হৃ',
    '\u0186': 'হু', 'Ɔ': 'হু',
    '\u018f': 'ঁদ', 'Ə': 'ঁদ',
    '\u01a3': 'কু', 'ƣ': 'কু',
    '\u025cc': '', '◌': '',
    'োভাটার': 'ভোটার',
    'োমাঃ': 'মোঃ',
    'োমাছাঃ': 'মোছাঃ',
    'োমাহাম্মদ': 'মোহাম্মদ',
    'োবগম': 'বেগম',
    'োপশা': 'পেশা',
    'িঠকানা': 'ঠিকানা',
    'িপতা': 'পিতা',
    'িহকানা': 'ঠিকানা',
    'সামী': 'স্বামী',
    'স্বাামী': 'স্বামী',
    'জন তারিখ': 'জন্ম তারিখ',
    'বযবসা': 'ব্যবসা'
  };

  function fixBengaliGlyphs(str) {
    if (!str) return '';
    let out = str;
    for (const [k, v] of Object.entries(EC_2024_GLYPHS)) {
      if (out.indexOf(k) !== -1) {
        out = out.split(k).join(v);
      }
    }
    return out;
  }

  // 3. Excluded terms for cancelled/migrated voter cards
  const EXCLUDE_TERMS = [
    "কর্তন", "কৰ্ত্তন", "কৰ্তন", "কতÎন", "কতইন", "করতন", "কাটা",
    "মাইগ্রেশন", "মাইগ্ৰেশন", "মাইগ্রেশান", "মাইগ্ৰেশান", "মাইেåট",
    "স্থানান্তর", "স্থানান্তিৰত", "স্থানান্তরিত", "স্থান্তর",
    "সম্পূরক", "বাতিল", "KvZv", "gBRÖkb", "¯’vbvšÍi",
    "হেয়েছ", "হইয়াছে", "হয়েছে"
  ];

  const VALID_INDICATORS = ["নাম", "ভোটার", "Ïভাটার", "িপতা", "মাতা", "িঠকানা", "NID", "nid"];

  function isCancelledCard(text) {
    if (!text) return false;
    return EXCLUDE_TERMS.some(term => text.includes(term));
  }

  function hasValidVoterIndicator(text) {
    if (!text) return false;
    return VALID_INDICATORS.some(ind => text.includes(ind));
  }

  function getCardText(items, ptRect, pageH_pt = 597.6) {
    if (!items || !ptRect) return '';
    let cardWords = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.str || !item.str.trim()) continue;
      const tx = item.transform[4];
      const ty = item.transform[5];
      const py = pageH_pt - ty;
      if (tx >= ptRect.x0 - 2 && tx <= ptRect.x1 + 2 && py >= ptRect.y0 - 2 && py <= ptRect.y1 + 2) {
        cardWords.push(item.str);
      }
    }
    return cardWords.join(' ');
  }

  // 4. Ultra-Fast Smart Right-Whitespace Auto-Trim (Direct TypedArray Pixel Analysis)
  // Scans columns from right to left using pre-read page ImageData (zero GPU readback stalls)
  const sharedTrimCanvas = document.createElement('canvas');
  const sharedTrimCtx = sharedTrimCanvas.getContext('2d');

  function autoTrimRightWhitespaceFromPageData(pageImgData, srcCanvas, startX, startY, width, height, padRight = 22, is2LineMode = true) {
    startX = Math.max(0, Math.floor(startX));
    startY = Math.max(0, Math.floor(startY));
    const pW = pageImgData.width;
    const pH = pageImgData.height;
    if (startX >= pW || startY >= pH) return null;
    width = Math.min(Math.floor(width), pW - startX);
    height = Math.min(Math.floor(height), pH - startY);
    if (width <= 10 || height <= 10) return null;

    const data = pageImgData.data;

    // Ignore horizontal border lines across the card (if any row has >35% dark pixels, it's a border/line, not text)
    const isSolidLineRow = new Array(height).fill(false);
    for (let r = 0; r < height; r++) {
      let rDark = 0;
      const rowOffset = (startY + r) * pW * 4;
      for (let c = 0; c < width; c++) {
        const idx = rowOffset + (startX + c) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < 185) rDark++;
      }
      if (rDark > width * 0.35) {
        isSolidLineRow[r] = true;
      }
    }

    let maxCol = 0;
    let totalDark = 0;
    // Scan columns from right to left
    for (let col = width - 1; col >= 0; col--) {
      let darkCount = 0;
      const colX = startX + col;
      for (let row = 0; row < height; row++) {
        if (isSolidLineRow[row]) continue; // Ignore horizontal border lines
        const idx = ((startY + row) * pW + colX) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < 195) { // Sensitive to antialiased font pixels
          darkCount++;
        }
      }
      totalDark += darkCount;
      if (darkCount >= 2 && maxCol === 0) { // Require >= 2 dark pixels
        maxCol = col;
      }
    }

    // Discard only if completely blank with virtually no ink
    if (totalDark < 15) {
      return null;
    }

    // Exact match with python pdf_slice.py line 285-286:
    // min_w = int(250 * (resolutionScale / 2.0))
    // target_w = max(min_w, min(cropped_hide.shape[1], max_col + 22))
    const resolutionScale = (srcCanvas.width / 842.0) || 2.0;
    const minWidth = Math.round(250 * (resolutionScale / 2.0));
    const trimmedWidth = (maxCol > 0)
      ? Math.max(minWidth, Math.min(width, maxCol + padRight))
      : minWidth;

    // Smart Bottom Trim: Prune any Line 3 Father's name kar signs if present (matching pdf_slice.py line 290)
    let finalH = height;
    if (is2LineMode && finalH > 35) {
      const rowCounts = new Array(finalH).fill(0);
      for (let r = 0; r < finalH; r++) {
        const rowOffset = (startY + r) * pW * 4;
        for (let c = 0; c < trimmedWidth; c++) {
          const idx = rowOffset + (startX + c) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < 195) rowCounts[r]++;
        }
      }
      for (let r = finalH - 2; r >= Math.max(0, finalH - 6); r--) {
        if (rowCounts[r] <= 2 && rowCounts[r + 1] > 2) {
          finalH = r;
          break;
        }
      }
    }

    // Reusable canvas draw
    sharedTrimCanvas.width = trimmedWidth;
    sharedTrimCanvas.height = finalH;
    sharedTrimCtx.drawImage(
      srcCanvas,
      startX, startY, trimmedWidth, finalH,
      0, 0, trimmedWidth, finalH
    );

    return {
      canvas: sharedTrimCanvas,
      get dataUrl() {
        if (!this._dataUrl) {
          this._dataUrl = sharedTrimCanvas.toDataURL('image/jpeg', 0.85);
        }
        return this._dataUrl;
      },
      width: trimmedWidth,
      height: finalH
    };
  }

  function autoTrimRightWhitespace(srcCanvas, startX, startY, width, height, padRight = 22, is2LineMode = true) {
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    return autoTrimRightWhitespaceFromPageData(imgData, srcCanvas, startX, startY, width, height, padRight, is2LineMode);
  }

  // 5. Detect Card Boxes on a Page Canvas
  function detectPageCardBoxes(canvas, scale = 2.0, isFirstVoterPage = false) {
    const w = canvas.width;
    const h = canvas.height;

    // Check if Landscape or Portrait
    const isLandscape = w > h;
    const boxes = [];

    // Most Bangladesh Election Commission voter sheets are Landscape (A4 Landscape, 842.4 x 597.6 pt):
    // 3 Columns: Col 1 = 67.5pt (135px @ 2.0x, w=234pt/468px)
    //            Col 2 = 304.5pt (609px @ 2.0x, w=232.5pt/465px)
    //            Col 3 = 541.5pt (1083px @ 2.0x, w=232.5pt/465px)
    // Page 3 (First voter page): 5 rows starting at Y = 114.0pt (228px @ 2.0x)
    // Page 4+ (Subsequent pages): 6 rows starting at Y = 32.0pt (64px @ 2.0x)
    // Row step = 81.0pt (162px @ 2.0x), Height = 78.0pt (156px @ 2.0x)
    if (isLandscape) {
      const COL_DEFS_PT = [
        { x: 67.5, w: 234.0 },
        { x: 304.5, w: 232.5 },
        { x: 541.5, w: 232.5 }
      ];
      const CARD_H_PT = 78.0;
      const ROW_STEP_PT = 81.0;
      let startYPt = isFirstVoterPage ? 114.2 : 32.2;
      const maxRows = isFirstVoterPage ? 5 : 6;

      const scaleX = w / 842.4;
      const scaleY = h / 597.6;

      // Dynamic header detection (scans for horizontal table line matching python)
      if (canvas) {
        try {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const scanStartY = Math.round((isFirstVoterPage ? 111 : 27) * scaleY);
          const scanEndY = Math.round((isFirstVoterPage ? 120 : 38) * scaleY);
          const scanX = Math.round(70 * scaleX);
          const scanW = Math.round(150 * scaleX);
          const imgData = ctx.getImageData(scanX, scanStartY, scanW, scanEndY - scanStartY);
          const d = imgData.data;

          for (let ry = 0; ry < (scanEndY - scanStartY); ry++) {
            let darkCount = 0;
            const rOffset = ry * scanW * 4;
            for (let rx = 0; rx < scanW; rx++) {
              const idx = rOffset + rx * 4;
              const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
              if (lum < 185) darkCount++;
            }
            if (darkCount > scanW * 0.70) {
              startYPt = (scanStartY + ry) / scaleY;
              break;
            }
          }
        } catch (e) {
          // fallback to default
        }
      }

      for (let r = 0; r < maxRows; r++) {
        const rowYPt = startYPt + (r * ROW_STEP_PT);
        const rowY = Math.round(rowYPt * scaleY);
        const cardHeight = Math.round(CARD_H_PT * scaleY);
        if (rowY + cardHeight > h * 0.99) break;

        for (let c = 0; c < 3; c++) {
          const colDef = COL_DEFS_PT[c];
          const colX = Math.round(colDef.x * scaleX);
          const cardWidth = Math.round(colDef.w * scaleX);
          boxes.push({
            x: colX,
            y: rowY,
            w: cardWidth,
            h: cardHeight,
            row: r,
            col: c,
            ptRect: {
              x0: colDef.x,
              y0: rowYPt,
              x1: colDef.x + colDef.w,
              y1: rowYPt + CARD_H_PT
            }
          });
        }
      }
    } else {
      // Portrait Fallback: 2 Columns x 6 Rows
      const cardWidth = Math.round(w * 0.42);
      const cardHeight = Math.round(h * 0.12);
      const colXs = [Math.round(w * 0.06), Math.round(w * 0.52)];
      const headerOffset = Math.round(h * 0.15);
      const rowGap = Math.round(h * 0.135);

      for (let r = 0; r < 6; r++) {
        const rowY = headerOffset + (r * rowGap);
        if (rowY + cardHeight > h * 0.98) break;
        for (let c = 0; c < 2; c++) {
          boxes.push({
            x: colXs[c],
            y: rowY,
            w: cardWidth,
            h: cardHeight,
            row: r,
            col: c,
            ptRect: null
          });
        }
      }
    }

    return boxes;
  }

  // 6. Check if box is deleted / migrated / blank
  function isCancelledCard(text) {
    if (!text) return false;
    return EXCLUDE_TERMS.some(term => text.includes(term));
  }

  // 7. Core In-Browser PDF Slicer
  async function slicePdfFile(file, options = {}, callbacks = {}) {
    const { onProgress, onLog, onFinished } = callbacks;
    try {
      const lines = Number(options.lines || 2); // Default to 2 lines (Serial, Name, Voter No)
      // Exact ratio map matching python pdf_slice.py:
      const ratioMap = { 1: 0.15, 2: 0.25, 3: 0.415, 4: 0.54, 5: 0.675, 6: 0.82 };
      const lineRatio = ratioMap[lines] !== undefined ? ratioMap[lines] : Math.min(1.0, lines * 0.14);
      const resolutionScale = Number(options.resolutionScale) || 2.0;

      const defaultShave = Math.abs(resolutionScale - 3.0) < 0.2 ? 4 : 3;
      const shaveTop = (options.shaveTop !== undefined && options.shaveTop !== null) ? Number(options.shaveTop) : defaultShave;
      const shaveLeft = (options.shaveLeft !== undefined && options.shaveLeft !== null) ? Number(options.shaveLeft) : defaultShave;
      const padTop = Number(options.padTop || 0);
      const padBottom = Number(options.padBottom || 0);
      const padLeft = Number(options.padLeft || 0);
      const padRight = Number(options.padRight || 0);
      const hideBorders = options.hideBorders !== false;

      if (onLog) onLog(`📄 পিডিএফ ফাইল খোলা হচ্ছে: ${file.name}...\n`);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const totalPages = pdf.numPages;

      // Slicing starts from Page 3 if totalPages >= 3 (Pages 1 & 2 are Cover & Summary Pages), matching pdf_slice.py
      let startPageNum = totalPages >= 3 ? 3 : 1;
      if (startPageNum > totalPages) startPageNum = 1;

      // --- PREVIEW ONLY MODE ---
      if (options && options.previewOnly) {
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        const page = await pdf.getPage(startPageNum);
        const viewport = page.getViewport({ scale: resolutionScale });
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;

        // Ensure white canvas background so transparent PDFs don't appear black
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        await page.render({ canvasContext: pageCtx, viewport: viewport }).promise;

        const boxes = detectPageCardBoxes(pageCanvas, resolutionScale, startPageNum === 3);
        let selectedBox = null;
        let unhideDataUrl = "";
        let hideDataUrl = "";

        const minPreviewW = Math.round(250 * (resolutionScale / 2.0));

        for (let box of boxes) {
          const startY = Math.max(0, box.y + shaveTop + padTop);
          const rawCropH = Math.round(box.h * lineRatio);
          const targetH = Math.max(15, rawCropH - padBottom);

          const startX = Math.max(0, box.x + shaveLeft + padLeft);
          const rawCropW = box.w - 15 - padRight;
          const targetW = Math.max(30, rawCropW - (shaveLeft + padLeft));

          const trimmed = autoTrimRightWhitespace(pageCanvas, startX, startY, targetW, targetH, 22, lines === 2);
          if (trimmed && trimmed.dataUrl) {
            selectedBox = box;
            hideDataUrl = trimmed.dataUrl;
            break;
          }
        }

        if (!selectedBox && boxes.length > 0) {
          selectedBox = boxes[0];
        }

        if (selectedBox) {
          const uCanvas = document.createElement('canvas');
          uCanvas.width = selectedBox.w;
          uCanvas.height = selectedBox.h;
          const uCtx = uCanvas.getContext('2d');
          uCtx.drawImage(pageCanvas, selectedBox.x, selectedBox.y, selectedBox.w, selectedBox.h, 0, 0, selectedBox.w, selectedBox.h);
          unhideDataUrl = uCanvas.toDataURL('image/jpeg', 0.85);

          if (!hideDataUrl) {
            const startY = Math.max(0, selectedBox.y + shaveTop + padTop);
            const rawCropH = Math.round(selectedBox.h * lineRatio);
            const targetH = Math.max(15, rawCropH - padBottom);

            const startX = Math.max(0, selectedBox.x + shaveLeft + padLeft);
            const rawCropW = selectedBox.w - 15 - padRight;
            const targetW = Math.max(30, rawCropW - (shaveLeft + padLeft));

            const trimmed = autoTrimRightWhitespace(pageCanvas, startX, startY, targetW, targetH, 22, lines === 2);
            if (trimmed && trimmed.dataUrl) {
              hideDataUrl = trimmed.dataUrl;
            } else {
              // Guaranteed clamp to minPreviewW (250 px @ 2.0x, height 39 px) matching python pdf_slice.py line 285
              const clampW = Math.min(minPreviewW, targetW);
              const hCanvas = document.createElement('canvas');
              hCanvas.width = clampW;
              hCanvas.height = targetH;
              const hCtx = hCanvas.getContext('2d');
              hCtx.drawImage(pageCanvas, startX, startY, clampW, targetH, 0, 0, clampW, targetH);
              hideDataUrl = hCanvas.toDataURL('image/jpeg', 0.85);
            }
          }
        } else {
          // Proportional fallback from page
          const fbW = minPreviewW;
          const fbH = Math.max(15, Math.round(39 * (resolutionScale / 2.0)));
          const fbCanvas = document.createElement('canvas');
          fbCanvas.width = fbW;
          fbCanvas.height = fbH;
          const fbCtx = fbCanvas.getContext('2d');
          fbCtx.fillStyle = '#ffffff';
          fbCtx.fillRect(0, 0, fbW, fbH);
          fbCtx.drawImage(pageCanvas, 0, 0, fbW, fbH, 0, 0, fbW, fbH);
          unhideDataUrl = fbCanvas.toDataURL('image/jpeg', 0.85);
          hideDataUrl = unhideDataUrl;
        }

        if (onProgress) {
          onProgress({
            status: 'preview_ready',
            unhide_data_url: unhideDataUrl,
            hide_data_url: hideDataUrl || unhideDataUrl,
            unhide_full_path: unhideDataUrl,
            hide_full_path: hideDataUrl || unhideDataUrl
          });
        }
        if (onFinished) onFinished({ code: 0 });
        return;
      }

    // Output folder/job name matching get_pdf_output_folder_name in pdf_slice.py
    const codeMatch = file.name.match(/\b\d{6}\b/) || file.name.match(/\d{6}/);
    const code = codeMatch ? codeMatch[0] : null;
    let gender = null;
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes('female') || file.name.includes('মহিলা')) gender = 'female';
    else if (lowerName.includes('male') || file.name.includes('পুরুষ')) gender = 'male';
    const subFolderName = (code && gender) ? `${code}_${gender}` : (code || file.name.replace(/\.pdf$/i, ''));

    let subDirHandle = options.outputSubDirHandle || null;
    if (!subDirHandle && options.outputDirHandle) {
      try {
        subDirHandle = await options.outputDirHandle.getDirectoryHandle(subFolderName, { create: true });
      } catch (e) {
        console.warn("Could not create subfolder handle for", subFolderName, e);
      }
    }

    if (onLog) onLog(`মোট পাতা: ${totalPages} টি। ভোটার কার্ড স্লাইসিং শুরু হচ্ছে (পৃষ্ঠা ${startPageNum} থেকে ${totalPages})...\n`);

    const slicedCards = [];
    let totalCardsExtracted = 0;

    // Allocate reusable canvas for page rendering
    const pageCanvas = document.createElement('canvas');
    const pageCtx = pageCanvas.getContext('2d');

    // Process from startPageNum to totalPages
    for (let pageNum = startPageNum; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: resolutionScale });

      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;

      // Render PDF page to canvas with print intent for maximum performance
      await page.render({
        canvasContext: pageCtx,
        viewport: viewport,
        intent: 'print'
      }).promise;

      // Get page text to detect cancelled cards and page metadata (fast slice of header items)
      const textContent = await page.getTextContent();
      const pageHeader = (textContent.items || []).slice(0, 40).map(i => fixBengaliGlyphs(i.str)).join(' ');

      // Skip page if header indicates cancelled/migrated voter section (matching pdf_slice.py)
      if (["কর্তন", "কৰ্ত্তন", "মাইগ্রেশন", "স্থানান্তর", "বাতিল", "KvZv", "gBRÖkb"].some(kw => pageHeader.includes(kw))) {
        if (onLog) onLog(`পৃষ্ঠা ${pageNum}: কর্তন/মাইগ্রেশন সেকশন স্কিপ করা হয়েছে।\n`);
        continue;
      }

      // Pre-extract page pixel data ONCE per page (zero GPU stalls during card trimming)
      const pageImageData = pageCtx.getImageData(0, 0, pageCanvas.width, pageCanvas.height);
      const pageBatchToSave = [];
      const pageDiskWritePromises = [];

      // Detect card boxes on page (Page 3 has header at top with 5 rows; Page 4+ has 6 rows starting near top)
      const isFirstVoterPage = (pageNum === startPageNum);
      const boxes = detectPageCardBoxes(pageCanvas, resolutionScale, isFirstVoterPage);
      let pageExtracted = 0;

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];

        // Filter out deleted / cancelled / migrated cards using text
        if (box.ptRect && textContent && textContent.items) {
          const cardText = getCardText(textContent.items, box.ptRect, 597.6);
          if (isCancelledCard(cardText)) continue;
          if (!hasValidVoterIndicator(cardText)) continue;
        }

        // Crop based on hideBorders, shaveTop/shaveLeft, padTop/padBottom/padLeft/padRight (100% exact match with python pdf_slice.py)
        let trimmed;
        if (hideBorders) {
          const cropY = Math.max(0, box.y + shaveTop + padTop);
          const rawCropH = Math.round(box.h * lineRatio);
          const cropH = Math.max(15, rawCropH - padBottom);

          const cropX = Math.max(0, box.x + shaveLeft + padLeft);
          const rawCropW = box.w - 15 - padRight;
          const cropW = Math.max(30, rawCropW - (shaveLeft + padLeft));

          trimmed = autoTrimRightWhitespaceFromPageData(pageImageData, pageCanvas, cropX, cropY, cropW, cropH, 22, lines === 2);
        } else {
          const cropX = Math.max(0, box.x + padLeft);
          const cropY = Math.max(0, box.y + padTop);
          const cropW = Math.max(30, box.w - padRight - padLeft);
          const cropH = Math.max(30, box.h - padBottom - padTop);

          sharedTrimCanvas.width = cropW;
          sharedTrimCanvas.height = cropH;
          sharedTrimCtx.drawImage(pageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          trimmed = {
            canvas: sharedTrimCanvas,
            get dataUrl() {
              if (!this._dataUrl) this._dataUrl = sharedTrimCanvas.toDataURL('image/jpeg', 0.85);
              return this._dataUrl;
            },
            width: cropW,
            height: cropH
          };
        }
        if (!trimmed) continue; // Skip blank or cancelled card

        const cardIndex = totalCardsExtracted + 1;
        const cardFilename = `${subFolderName}_p${String(pageNum).padStart(3, '0')}_card${String(cardIndex).padStart(3, '0')}.jpg`;

        if (subDirHandle) {
          try {
            const blob = await new Promise(res => sharedTrimCanvas.toBlob(res, 'image/jpeg', 0.85));
            if (blob) {
              pageDiskWritePromises.push((async (b, fname) => {
                try {
                  const fileHandle = await subDirHandle.getFileHandle(fname, { create: true });
                  const writable = await fileHandle.createWritable();
                  await writable.write(b);
                  await writable.close();
                } catch (writeErr) {
                  console.error("Failed to write card to disk:", fname, writeErr);
                }
              })(blob, cardFilename));
            }
          } catch (blobErr) {
            console.error("Failed to create blob for card:", cardFilename, blobErr);
          }
        }

        // Collect card for high-speed batch save via local server API (only if running on localhost)
        const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocalHost && !subDirHandle && options.outputDir && typeof options.outputDir === 'string') {
          pageBatchToSave.push({
            fileName: cardFilename,
            base64: trimmed.dataUrl
          });
        }

        // Only store full dataUrl if ZIP fallback is needed (avoids browser out-of-memory stalls)
        const needsZipStorage = (!subDirHandle && options.saveMode !== 'direct') || options.saveMode === 'zip';
        slicedCards.push({
          name: cardFilename,
          pageNum: pageNum,
          cardIndex: cardIndex,
          dataUrl: needsZipStorage ? trimmed.dataUrl : null,
          subFolderName: subFolderName
        });

        totalCardsExtracted++;
        pageExtracted++;
      }

      // Concurrently flush all card files for this page in parallel:
      if (pageDiskWritePromises.length > 0) {
        await Promise.all(pageDiskWritePromises);
      }

      // High-speed batch save: writes all cards of this page in a single fast server call
      if (pageBatchToSave.length > 0 && options.outputDir && typeof options.outputDir === 'string') {
        try {
          await fetch('/api/save-cards-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              baseDir: options.outputDir,
              subDir: subFolderName,
              cards: pageBatchToSave
            })
          });
        } catch (apiErr) {
          console.error("Failed to batch save cards:", apiErr);
        }
      }

      const progressPercent = Math.min(99, Math.max(0, Math.round(((pageNum - startPageNum + 1) / (totalPages - startPageNum + 1)) * 100)));
      if (onProgress) {
        onProgress({
          status: 'processing_file',
          index: pageNum,
          total: totalPages,
          page: pageNum,
          totalPages: totalPages,
          percent: progressPercent,
          file: `${file.name} (পাতা ${pageNum}/${totalPages})`,
          boxes_detected: totalCardsExtracted
        });
      }

      // Async yield for UI responsiveness
      await new Promise(r => setTimeout(r, 0));
    }

    if (onProgress) {
      onProgress({
        status: 'file_completed',
        index: totalPages,
        total: totalPages,
        page: totalPages,
        totalPages: totalPages,
        percent: 100,
        boxes_detected: totalCardsExtracted
      });
    }

    if (onLog) onLog(`\n✅ স্লাইসিং সম্পন্ন! মোট ${totalCardsExtracted} টি ভোটার কার্ড ইমেজ সফলভাবে তৈরি হয়েছে।\n`);
    if (onFinished) onFinished({
      code: 0,
      totalCards: totalCardsExtracted,
      cards: slicedCards,
      fileName: subFolderName
    });

    return slicedCards;
  } catch (err) {
    console.error("PDF slicing error:", err);
    if (onProgress) {
      onProgress({
        status: 'preview_error',
        error: err.message || String(err)
      });
    }
    if (onFinished) onFinished({ code: -1, error: err.message || String(err) });
    return [];
  }
}

  // 8. Core In-Browser Text Extractor
  async function extractTextFromPdfFile(file, options = {}, callbacks = {}) {
    const { onProgress, onLog, onFinished } = callbacks;

    if (onLog) onLog(`📄 পিডিএফ থেকে বাংলা টেক্সট এক্সট্রাকশন শুরু হচ্ছে: ${file.name}...\n`);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;

    const votersList = [];
    let detectedCenter = "";
    let detectedArea = "";

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Collect raw lines and items
      const rawStrings = textContent.items.map(item => fixBengaliGlyphs(item.str));
      const fullPageText = rawStrings.join(' ');

      // Extract Center Name if not yet found
      if (!detectedCenter) {
        const centerMatch = fullPageText.match(/(?:ভোটকেন্দ্র|কেন্দ্রের\s*নাম|কেন্দ্র)\s*[:\-]?\s*([^\n,।]+)/i);
        if (centerMatch && centerMatch[1]) {
          detectedCenter = centerMatch[1].trim();
        }
      }

      // Extract Area Name
      if (!detectedArea) {
        const areaMatch = fullPageText.match(/(?:ভোটার\s*এলাকা|এলাকা)\s*[:\-]?\s*([^\n,।]+)/i);
        if (areaMatch && areaMatch[1]) {
          detectedArea = areaMatch[1].trim();
        }
      }

      // Parse voter entries on this page
      // Pattern: (Serial) (Name) ... (Voter No: 10-17 digits)
      const voterNoRegex = /(?:ভোটার\s*নং|নং)\s*[:\-]?\s*([\d\u09E6-\u09EF]{10,17})/g;
      let match;

      while ((match = voterNoRegex.exec(fullPageText)) !== null) {
        const voterNo = match[1];
        const matchIdx = match.index;

        // Look back for serial and name before this voter number
        const preText = fullPageText.substring(Math.max(0, matchIdx - 200), matchIdx);
        const nameMatch = preText.match(/(?:নাম|নামঃ)\s*[:\-]?\s*([^\n,।:–-]+)/i);
        const serialMatch = preText.match(/([\d\u09E6-\u09EF]{3,4})\s*[.]?\s*(?:নাম)?/);

        const serial = serialMatch ? serialMatch[1].trim() : String(votersList.length + 1).padStart(3, '০');
        const name = nameMatch ? nameMatch[1].trim() : "ভোটার নাম";

        // Clean name
        const cleanName = name.replace(/^(মোছাঃ|মোসাঃ|মোঃ|মোহাম্মদ|শ্রী|শ্রীমতি)\s+/, '$1 ').trim();

        // Exact 2-Line Format required by user
        const formattedBlock = `${serial}. নাম: ${cleanName}\nভোটার নং: ${voterNo}`;
        votersList.push(formattedBlock);
      }

      const progressPercent = Math.round((pageNum / totalPages) * 100);
      if (onProgress) {
        onProgress({
          index: pageNum,
          total: totalPages,
          percent: progressPercent,
          voters_found: votersList.length
        });
      }

      await new Promise(r => setTimeout(r, 0));
    }

    if (onLog) onLog(`\n✅ টেক্সট এক্সট্রাক্ট সম্পন্ন! মোট ${votersList.length} জন ভোটারের তথ্য উদ্ধার করা হয়েছে।\n`);
    if (onFinished) onFinished({ code: 0, voters: votersList, center: detectedCenter, area: detectedArea });

    return { voters: votersList, center: detectedCenter, area: detectedArea };
  }

  // 9. Core CSV Parser (for all_extracted_voters.csv)
  function parseCsvRow(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function parseVoterCsvText(csvText) {
    if (!csvText) return [];
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return [];

    // Parse header
    const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
    const serialIdx = headers.indexOf('serial');
    const nameIdx = headers.indexOf('name');
    const voterNoIdx = headers.indexOf('voter_no');
    const areaIdx = headers.indexOf('voter_area');
    const thanaIdx = headers.indexOf('thana');

    const voters = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvRow(lines[i]);
      if (!row || row.length < 3) continue;

      const cleanVal = (idx) => idx !== -1 && row[idx] ? row[idx].replace(/^["']|["']$/g, '').trim() : '';

      const serial = cleanVal(serialIdx) || String(i).padStart(3, '০');
      const name = cleanVal(nameIdx) || '';
      const voterNo = cleanVal(voterNoIdx) || '';
      const area = cleanVal(areaIdx) || '';
      const thana = cleanVal(thanaIdx) || '';

      if (name && voterNo) {
        // Exact 2-Line Format required by user
        const formattedBlock = `${serial}. নাম: ${name}\nভোটার নং: ${voterNo}`;
        voters.push({
          text: formattedBlock,
          serial: serial,
          name: name,
          voterNo: voterNo,
          area: area,
          thana: thana
        });
      }
    }
    return voters;
  }

  // 9. Pure JavaScript Store ZIP Generator for Web Batch Downloads
  function createZipBlob(files) {
    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c >>> 0;
    }
    function calcCrc(buf) {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    const parts = [];
    const cdEntries = [];
    let offset = 0;
    const encoder = new TextEncoder();

    for (const f of files) {
      const nameBytes = encoder.encode(f.name);
      const dataBytes = f.data;
      const crc = calcCrc(dataBytes);
      const size = dataBytes.length;

      // Local Header (30 bytes)
      const lh = new Uint8Array(30);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true); // UTF-8
      dv.setUint16(8, 0, true);      // Store (compression 0)
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);

      parts.push(lh, nameBytes, dataBytes);

      // Central Directory Entry (46 bytes)
      const cd = new Uint8Array(46);
      const cdv = new DataView(cd.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0x0800, true); // UTF-8
      cdv.setUint16(10, 0, true);     // Store
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint32(42, offset, true);

      cdEntries.push(cd, nameBytes);
      offset += 30 + nameBytes.length + size;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const p of cdEntries) cdSize += p.length;

    // End of Central Directory (22 bytes)
    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(8, files.length, true);
    edv.setUint16(10, files.length, true);
    edv.setUint32(12, cdSize, true);
    edv.setUint32(16, cdOffset, true);

    return new Blob([...parts, ...cdEntries, eocd], { type: 'application/zip' });
  }

  function cleanPathStr(p) {
    if (!p) return "";
    let s = String(p).trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    s = s.replace(/\s*\(\d+\s*টি\s*PDF[^\)]*\)/i, '').trim();
    if (s.length > 3 && /[\\\/]$/.test(s)) {
      s = s.replace(/[\\\/]+$/, '');
    }
    return s;
  }

  function isProbableLocalPath(p) {
    if (!p) return false;
    const clean = cleanPathStr(p);
    if (!clean || clean.startsWith('blob:') || clean.startsWith('data:')) return false;
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocal && !window.slicer?.isElectron) return false;
    return true;
  }

  // Dynamic Backend Discovery: Checks Localhost and Configured Cloud Python Microservice
  async function checkBackendAvailability() {
    const candidates = [];
    const custom = (localStorage.getItem('voterslip_cloud_slicer_url') || '').trim().replace(/\/+$/, '');
    if (custom) candidates.push(custom);
    candidates.push(''); // relative (for localhost)

    for (const base of candidates) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${base}/api/check-backend-slicer`, { signal: controller.signal }).catch(() => null);
        clearTimeout(tid);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.available) {
            return { available: true, base };
          }
        }
      } catch (e) {}
    }
    return { available: false, base: '' };
  }

  // Ultra-Fast Backend Python Slicer Runner (Native PyMuPDF + OpenCV C++ at ~80+ cards/sec)
  async function runBackendSlicing(options, files, outputDirPath, backendBase = '') {
    const rawVal = options.inputDir || (document.getElementById("slicerInputDir") ? document.getElementById("slicerInputDir").value : "");
    const cleanIn = cleanPathStr(rawVal);
    let uploadedPdfs = null;
    let inputDir = cleanIn;

    // If browser files are selected and no local path is resolved, convert files to base64
    if (!cleanIn && files && files.length > 0) {
      if (window.slicer && window.slicer.triggerLog) {
        window.slicer.triggerLog(`🚀 হাই-স্পিড পাইথন ইঞ্জিনে ফাইল প্রস্তুত করা হচ্ছে (${files.length} টি PDF)...\n`);
      }
      const filesToUpload = (options.previewOnly && files.length > 1) ? [files[0]] : files;
      uploadedPdfs = [];
      for (let i = 0; i < filesToUpload.length; i++) {
        const f = filesToUpload[i];
        const arrBuf = await f.arrayBuffer();
        const bytes = new Uint8Array(arrBuf);
        let binary = '';
        const chunk = 0x8000;
        for (let j = 0; j < bytes.length; j += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(j, j + chunk));
        }
        uploadedPdfs.push({
          name: f.name,
          base64: btoa(binary)
        });
      }
    }

    const payload = {
      ...options,
      inputDir: inputDir,
      outputDir: cleanPathStr(outputDirPath),
      uploadedPdfs: uploadedPdfs
    };

    let response;
    const controller = new AbortController();
    const isCloud = backendBase.startsWith('http://') || backendBase.startsWith('https://');
    const timeoutMs = isCloud ? 45000 : 15000; // 45s for Render free-tier cold starts (smart-mohuri architecture)
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let wakeupTimer = null;
    if (isCloud && window.slicer && window.slicer.triggerLog) {
      wakeupTimer = setTimeout(() => {
        window.slicer.triggerLog(`⏳ ক্লাউড পাইথন সার্ভার ওয়েকআপ হচ্ছে (Render Cold-Start)... অনুগ্রহ করে ১৫-২০ সেকেন্ড অপেক্ষা করুন...\n`);
      }, 2500);
    }

    try {
      response = await fetch(`${backendBase}/api/run-slicer-backend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (wakeupTimer) clearTimeout(wakeupTimer);
    } catch (netErr) {
      clearTimeout(timeoutId);
      if (wakeupTimer) clearTimeout(wakeupTimer);
      console.warn("Backend slicer fetch failed:", netErr);
      return false;
    }

    if (!response.ok) {
      let errMsg = 'সার্ভার এরর';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch (e) {
        try { errMsg = await response.text(); } catch (e2) {}
      }
      if (window.slicer && window.slicer.triggerFinished) {
        window.slicer.triggerFinished({ code: -1, error: errMsg });
      }
      return true;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastBoxesDetected = 0;
    let exitCode = 0;
    let finalOutDir = outputDirPath;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          if (data.status === 'exit') {
            exitCode = data.code;
            if (data.outputDir) finalOutDir = data.outputDir;
            continue;
          }
          if (data.status === 'error') {
            window.slicer.triggerFinished({ code: -1, error: data.error || data.message || 'Error running slicer' });
            return true;
          }
          if (data.status === 'stderr') {
            window.slicer.triggerStderr(data.message);
            continue;
          }
          if (data.status === 'zip_ready') {
            if (window.slicer && window.slicer.triggerLog) {
              window.slicer.triggerLog(`📦 মোট ${data.total_cards} টি ভোটার কার্ড ক্লাউড পাইথন দ্বারা সফলভাবে স্লাইস ও জিপ করা হয়েছে!\n`);
            }
            if (data.zip_data_url) {
              const a = document.createElement('a');
              a.href = data.zip_data_url;
              a.download = `Sliced_Voter_Cards_${Date.now()}.zip`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
            continue;
          }
          if (data.boxes_detected !== undefined) {
            lastBoxesDetected = data.boxes_detected;
          }
          window.slicer.triggerProgress(data);
        } catch (e) {
          window.slicer.triggerLog(line);
        }
      }
    }

    window.slicer.triggerFinished({
      code: exitCode,
      totalCards: lastBoxesDetected,
      outputDir: finalOutDir
    });

    return true;
  }

  // 10. Web-Native Bridge for window.slicer and window.extractor (Drop-in replacement for Electron)
  if (typeof window.slicer === 'undefined') {
    const slicerListeners = { progress: [], log: [], stderr: [], finished: [] };

    window.slicer = {
      isWebEngine: true,
      selectDirectory: async (title) => {
        if ('showDirectoryPicker' in window) {
          try {
            const handle = await window.showDirectoryPicker();
            return handle.name;
          } catch (e) {
            return null;
          }
        }
        return prompt(title || "ফোল্ডারের নাম দিন:");
      },
      startSlicing: async (options) => {
        const rawVal = options.inputDir || (document.getElementById("slicerInputDir") ? document.getElementById("slicerInputDir").value : "");
        const cleanIn = cleanPathStr(rawVal);
        const looksLikeLocalPath = isProbableLocalPath(cleanIn);

        let files = window.__webSelectedPdfs || [];

        // If a local path is present and files array is empty, load files from server API
        if (looksLikeLocalPath && files.length === 0) {
          try {
            const res = await fetch(`/api/list-pdfs?folder=${encodeURIComponent(cleanIn)}`).catch(() => null);
            if (res && res.ok) {
              const data = await res.json();
              if (data.success && data.files && data.files.length > 0) {
                files = data.files.map(f => ({
                  name: f.name,
                  path: f.path,
                  size: f.size,
                  arrayBuffer: async () => {
                    const r = await fetch(`/api/get-pdf?path=${encodeURIComponent(f.path)}`);
                    return await r.arrayBuffer();
                  }
                }));
                window.__webSelectedPdfs = files;
              }
            }
          } catch (e) {
            console.warn("Could not auto-fetch PDFs from local path:", e);
          }
        }

        // Preview Only handling
        if (options && options.previewOnly) {
          // Check backend availability (Localhost or Cloud Render Python Service)
          try {
            const backend = await checkBackendAvailability();
            if (backend.available) {
              const nativeDone = await runBackendSlicing({ ...options, inputDir: cleanIn }, files, "", backend.base);
              if (nativeDone) return;
            }
          } catch (e) {
            console.warn("Backend slicer preview attempt failed, falling back to browser engine:", e);
          }

          if (files.length > 0) {
            await slicePdfFile(files[0], { ...options, inputDir: cleanIn }, {
              onProgress: (p) => window.slicer.triggerProgress(p),
              onLog: (m) => window.slicer.triggerLog(m),
              onFinished: (res) => window.slicer.triggerFinished(res)
            });
            return;
          } else {
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (isLocal && cleanIn) {
              window.slicer.triggerFinished({
                code: -1,
                error: `ইনপুট ফোল্ডার বা ফাইলে কোনো পিডিএফ পাওয়া যায়নি (${cleanIn})`
              });
            }
            return;
          }
        }

        // For Full Slicing: Prompt for file picker ONLY if not a local path and no files selected
        if (!looksLikeLocalPath && files.length === 0) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf';
          input.multiple = true;
          const filesPromise = new Promise(resolve => {
            input.onchange = (e) => resolve(Array.from(e.target.files || []));
          });
          input.click();
          files = await filesPromise;
          if (files.length > 0) {
            window.__webSelectedPdfs = files;
          }
        }

        if (!looksLikeLocalPath && files.length === 0) {
          window.slicer.triggerFinished({ code: -1, error: 'কোনো পিডিএফ ফাইল সিলেক্ট করা হয়নি' });
          return;
        }

        let outputDirHandle = window.__slicerOutputDirHandle || null;
        let outputDirPath = options.outputDir || (document.getElementById("slicerOutputDir") ? document.getElementById("slicerOutputDir").value.trim() : "");

        if (!outputDirHandle && !outputDirPath) {
          window.slicer.triggerFinished({ code: -1, error: 'কোনো আউটপুট ফোল্ডার সিলেক্ট করা হয়নি।' });
          return;
        }

        // 1. Ultra-Fast Native Backend Slicer Runner (Python PyMuPDF + OpenCV C++ at ~80+ cards/sec)
        if (outputDirPath && !options.previewOnly) {
          try {
            const backend = await checkBackendAvailability();
            if (backend.available) {
              const nativeDone = await runBackendSlicing(options, files, outputDirPath, backend.base);
              if (nativeDone) return;
            }
          } catch (e) {
            console.warn("Backend slicer attempt failed, falling back to browser engine:", e);
          }
        }

        const totalPdfs = files.length;
        const allJobs = [];
        let totalAllCards = 0;

        if (outputDirHandle && typeof outputDirHandle.requestPermission === 'function') {
          try {
            const q = await outputDirHandle.queryPermission({ mode: 'readwrite' });
            if (q !== 'granted') {
              await outputDirHandle.requestPermission({ mode: 'readwrite' });
            }
          } catch (pe) {
            console.warn("Could not elevate outputDirHandle to readwrite:", pe);
          }
        }

        for (let fileIdx = 0; fileIdx < totalPdfs; fileIdx++) {
          const f = files[fileIdx];
          const codeMatch = f.name.match(/\b\d{6}\b/) || f.name.match(/\d{6}/);
          const code = codeMatch ? codeMatch[0] : null;
          let gender = null;
          const lowerName = f.name.toLowerCase();
          if (lowerName.includes('female') || f.name.includes('মহিলা')) gender = 'female';
          else if (lowerName.includes('male') || f.name.includes('পুরুষ')) gender = 'male';
          const subFolderName = (code && gender) ? `${code}_${gender}` : (code || f.name.replace(/\.pdf$/i, ''));

          let subDirHandle = null;
          if (outputDirHandle) {
            try {
              subDirHandle = await outputDirHandle.getDirectoryHandle(subFolderName, { create: true });
            } catch (err) {
              console.warn("Could not create subfolder handle for", f.name, err);
            }
          }

          window.slicer.triggerLog(`\n========================================\n[${fileIdx + 1}/${totalPdfs}] প্রসেস করা হচ্ছে: ${f.name}\n========================================\n`);

          const cards = await slicePdfFile(f, { ...options, outputDir: outputDirPath, outputSubDirHandle: subDirHandle }, {
            onProgress: (p) => {
              if (p.status === 'file_completed' || p.status === 'completed') {
                return; // Dispatched after all files and batch saves finish
              }
              const filePercent = (typeof p.percent === 'number') ? p.percent : 0;
              // Smooth overall percent capped at 99% during active processing:
              const overallPercent = Math.min(99, Math.max(0, Math.round(((fileIdx + (filePercent / 100)) / totalPdfs) * 100)));
              const currentCards = totalAllCards + (p.boxes_detected || 0);
              const ratioText = totalPdfs > 1 
                ? `ফাইল ${fileIdx + 1}/${totalPdfs} (পাতা ${p.index || 1}/${p.total || 1})`
                : `পাতা ${p.index || 1}/${p.total || 1}`;

              window.slicer.triggerProgress({
                status: 'processing_file',
                index: p.index || (fileIdx + 1),
                total: p.total || totalPdfs,
                page: p.index || 1,
                totalPages: p.total || 1,
                fileIdx: fileIdx + 1,
                totalFiles: totalPdfs,
                percent: overallPercent,
                fileRatioText: ratioText,
                file: `${f.name} (পাতা ${p.index || 1}/${p.total || 1})`,
                boxes_detected: currentCards
              });
            },
            onLog: (m) => window.slicer.triggerLog(m)
          });

          if (cards && cards.length > 0) {
            totalAllCards += cards.length;
            allJobs.push(...cards);
            window.slicer.triggerLog(`✅ [${fileIdx + 1}/${totalPdfs}] ${f.name} থেকে ${cards.length} টি কার্ড সম্পন্ন হয়েছে।\n`);
          }
        }

        // If not using a native directory handle and running in browser (Firebase Hosting / Static Web), auto-package into ZIP!
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!outputDirHandle && !isLocalHost && allJobs.length > 0) {
          try {
            window.slicer.triggerLog(`\n📦 মোট ${allJobs.length} টি ভোটার কার্ড জিপ ফাইলে প্যাকেজ করা হচ্ছে...\n`);
            const zipFiles = allJobs.filter(c => c.dataUrl).map(c => {
              const commaIdx = c.dataUrl.indexOf(',');
              const bStr = atob(c.dataUrl.substring(commaIdx + 1));
              const u8 = new Uint8Array(bStr.length);
              for (let i = 0; i < bStr.length; i++) u8[i] = bStr.charCodeAt(i);
              return {
                name: c.subFolderName ? `${c.subFolderName}/${c.name}` : c.name,
                data: u8
              };
            });
            if (zipFiles.length > 0) {
              const zipBlob = createZipBlob(zipFiles);
              const zipUrl = URL.createObjectURL(zipBlob);
              const a = document.createElement('a');
              a.href = zipUrl;
              const safeName = (outputDirPath || 'VoterCards').replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_');
              a.download = `${safeName}_${Date.now()}.zip`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(zipUrl), 60000);
              window.slicer.triggerLog(`💾 জিপ ফাইল "${a.download}" স্বয়ংক্রিয়ভাবে ডাউনলোড সম্পন্ন হয়েছে!\n`);
            }
          } catch (zipErr) {
            console.error("ZIP creation error:", zipErr);
          }
        }

        window.slicer.triggerProgress({
          status: 'completed',
          index: totalPdfs,
          total: totalPdfs,
          percent: 100,
          fileRatioText: totalPdfs > 1 ? `${totalPdfs}/${totalPdfs} ফাইল` : `সম্পূর্ণ`,
          boxes_detected: totalAllCards
        });

        window.slicer.triggerLog(`\n🎉 সম্পূর্ণ ব্যাচ সম্পন্ন! মোট ${totalPdfs} টি ফাইল থেকে ${totalAllCards} টি ভোটার কার্ড প্রসেস হয়েছে।\n`);

        window.slicer.triggerFinished({
          code: 0,
          totalCards: totalAllCards,
          outputDir: outputDirPath,
          outputDirName: outputDirHandle ? outputDirHandle.name : (outputDirPath ? outputDirPath.split(/[\\/]/).pop() : 'VoterCards')
        });
      },
      onProgress: (cb) => slicerListeners.progress.push(cb),
      onLog: (cb) => slicerListeners.log.push(cb),
      onStderr: (cb) => slicerListeners.stderr.push(cb),
      onFinished: (cb) => slicerListeners.finished.push(cb),
      triggerProgress: (data) => slicerListeners.progress.forEach(cb => cb(data)),
      triggerLog: (msg) => slicerListeners.log.forEach(cb => cb(msg)),
      triggerFinished: (res) => slicerListeners.finished.forEach(cb => cb(res))
    };
  }

  if (typeof window.extractor === 'undefined') {
    const extractorListeners = { progress: [], log: [], stderr: [], finished: [] };

    window.extractor = {
      isWebEngine: true,
      selectDirectory: async (title) => {
        if (typeof window.openFolderSelectorModal === 'function') {
          return new Promise(resolve => {
            window.__onFolderModalConfirmed = resolve;
            window.openFolderSelectorModal('extractor_input');
          });
        }
        return prompt(title || "ফোল্ডারের নাম দিন:");
      },
      startExtraction: async (options) => {
        let { inputDir, outputDir } = options || {};
        try {
          const res = await fetch('/api/run-extractor-backend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputDir, outputDir })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            window.extractor.triggerFinished({ code: -1, error: err.error || 'এক্সট্রাকশন সার্ভারে সমস্যা হয়েছে' });
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const data = JSON.parse(trimmed);
                if (data.status === 'exit') {
                  window.extractor.triggerFinished({ code: data.code });
                  continue;
                }
                if (data.status === 'stderr') {
                  extractorListeners.stderr.forEach(cb => cb(data.message));
                  continue;
                }
                if (data.type) {
                  window.extractor.triggerProgress(data);
                }
              } catch (e) {
                window.extractor.triggerLog(trimmed);
              }
            }
          }
        } catch (err) {
          window.extractor.triggerFinished({ code: -1, error: err.message });
        }
      },
      onProgress: (cb) => extractorListeners.progress.push(cb),
      onLog: (cb) => extractorListeners.log.push(cb),
      onStderr: (cb) => extractorListeners.stderr.push(cb),
      onFinished: (cb) => extractorListeners.finished.push(cb),
      triggerProgress: (data) => extractorListeners.progress.forEach(cb => cb(data)),
      triggerLog: (msg) => extractorListeners.log.forEach(cb => cb(msg)),
      triggerFinished: (res) => extractorListeners.finished.forEach(cb => cb(res)),
      readTextFile: async (filePath) => {
        try {
          const res = await fetch(`/api/read-text-file?path=${encodeURIComponent(filePath)}`);
          const data = await res.json();
          return data.content || null;
        } catch (e) {
          return null;
        }
      },
      listExtractedFiles: async (dir) => {
        try {
          const res = await fetch(`/api/list-extracted-files?folder=${encodeURIComponent(dir)}`);
          const data = await res.json();
          return data.files || [];
        } catch (e) {
          return [];
        }
      },
      openPath: (p) => {
        fetch('/api/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p })
        }).catch(e => console.warn("Failed to open folder:", e));
      }
    };
  }

  // Export engine to window
  window.WebSlicerEngine = {
    slicePdfFile: slicePdfFile,
    extractTextFromPdfFile: extractTextFromPdfFile,
    parseVoterCsvText: parseVoterCsvText,
    autoTrimRightWhitespace: autoTrimRightWhitespace,
    fixBengaliGlyphs: fixBengaliGlyphs
  };

})(window);
