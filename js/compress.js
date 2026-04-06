/* ══════════════════════════════════════════════════════
   GIFONTE.COM — IMAGE COMPRESSOR
   Tool 05 · Zero-upload · Pure canvas · Batch
   
   Features:
   · PNG, JPG, WebP, GIF, BMP, TIFF, AVIF input
   · Output: JPEG, PNG, WebP
   · Quality slider 1–100%
   · Resolution: 200p → 4K + custom
   · Fit modes: contain / cover / downscale
   · Color depth simulation
   · Noise reduction (box blur)
   · Sharpening (unsharp mask)
   · Strip metadata (auto)
   · Max file size targeting (binary search)
   · Batch + queue with per-item progress
   · Before/After split-view modal
   · Download single or ZIP (JSZip)
   · Presets: Web / Social / Balanced / Print / Lossless / Max
══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────────────────────────────
     CDN
  ───────────────────────────────────── */
  const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  let _jszipLoaded = null;
  function loadJSZip() {
    if (_jszipLoaded) return _jszipLoaded;
    _jszipLoaded = new Promise((res, rej) => {
      if (window.JSZip) { res(); return; }
      const s = document.createElement('script');
      s.src = JSZIP_CDN;
      s.onload = res; s.onerror = () => rej(new Error('JSZip load failed'));
      document.head.appendChild(s);
    });
    return _jszipLoaded;
  }

  /* ─────────────────────────────────────
     PRESETS
  ───────────────────────────────────── */
  const PRESETS = {
    web:       { quality: 72,  res: 'fhd',     format: 'webp',  sharp: '1', noise: '0', chroma: '4:2:0', maxSize: 200 },
    social:    { quality: 80,  res: '1080',     format: 'jpeg',  sharp: '1', noise: '0', chroma: '4:2:2', maxSize: 0   },
    balanced:  { quality: 82,  res: 'original', format: 'auto',  sharp: '1', noise: '0', chroma: '4:2:2', maxSize: 0   },
    print:     { quality: 95,  res: 'original', format: 'jpeg',  sharp: '2', noise: '1', chroma: '4:4:4', maxSize: 0   },
    lossless:  { quality: 100, res: 'original', format: 'png',   sharp: '0', noise: '0', chroma: '4:4:4', maxSize: 0   },
    max:       { quality: 35,  res: 'fhd',      format: 'webp',  sharp: '0', noise: '2', chroma: '4:2:0', maxSize: 100 },
  };

  /* ─────────────────────────────────────
     RESOLUTION MAP (max width in px)
  ───────────────────────────────────── */
  const RES_MAP = {
    original: null,
    '4k':     3840,
    '2k':     2560,
    fhd:      1920,
    hd:       1280,
    '720':    1280,
    '1080':   1920,
    '480':    854,
    '360':    640,
    '240':    426,
    '200':    356,
    custom:   null,
  };

  /* ─────────────────────────────────────
     STATE
  ───────────────────────────────────── */
  let queue    = [];   // { file, img, status, blob, origSize, outSize }
  let results  = [];
  let running  = false;

  /* ─────────────────────────────────────
     DOM
  ───────────────────────────────────── */
  const dropEl        = document.getElementById('cmpDrop');
  const inputEl       = document.getElementById('cmpInput');
  const settingsEl    = document.getElementById('cmpSettings');
  const queueEl       = document.getElementById('cmpQueue');
  const goBtn         = document.getElementById('cmpGoBtn');
  const goCount       = document.getElementById('cmpGoCount');
  const globalProg    = document.getElementById('cmpGlobalProgress');
  const gpBar         = document.getElementById('cmpGpBar');
  const gpPct         = document.getElementById('cmpGpPct');
  const gpLog         = document.getElementById('cmpGpLog');
  const gpPhases      = document.getElementById('cmpGpPhases');
  const resultsEl     = document.getElementById('cmpResults');
  const resultsList   = document.getElementById('cmpResultsList');
  const resultsStats  = document.getElementById('cmpResultsStats');
  const resetAllBtn   = document.getElementById('cmpResetAll');
  const dlAllBtn      = document.getElementById('cmpDownloadAll');
  const compareBtn    = document.getElementById('cmpCompareBtn');
  const modal         = document.getElementById('cmpModal');
  const modalBg       = document.getElementById('cmpModalBg');
  const modalClose    = document.getElementById('cmpModalClose');
  const modalSelect   = document.getElementById('cmpModalSelect');
  const statFiles     = document.getElementById('statFiles');
  const statSaved     = document.getElementById('statSaved');

  // Settings fields
  const rngQuality    = document.getElementById('rngQuality');
  const qualVal       = document.getElementById('qualVal');
  const resVal        = document.getElementById('resVal');
  const selFormat     = document.getElementById('selFormat');
  const selColor      = document.getElementById('selColor');
  const selChroma     = document.getElementById('selChroma');
  const selSharp      = document.getElementById('selSharp');
  const selFit        = document.getElementById('selFit');
  const selDpi        = document.getElementById('selDpi');
  const selMeta       = document.getElementById('selMeta');
  const selBg         = document.getElementById('selBg');
  const selNoise      = document.getElementById('selNoise');
  const selProgressive= document.getElementById('selProgressive');
  const selMaxSize    = document.getElementById('selMaxSize');
  const selNaming     = document.getElementById('selNaming');
  const customResRow  = document.getElementById('customResRow');
  const customW       = document.getElementById('customW');
  const customH       = document.getElementById('customH');

  if (!dropEl) return;

  /* ─────────────────────────────────────
     QUALITY SLIDER LIVE UPDATE
  ───────────────────────────────────── */
  let currentRes = 'original';

  rngQuality.addEventListener('input', () => {
    qualVal.textContent = rngQuality.value + '%';
    document.querySelector('[data-section="quality"] .cmp-section__val').textContent = rngQuality.value + '%';
  });

  /* ─────────────────────────────────────
     RESOLUTION BUTTONS
  ───────────────────────────────────── */
  document.querySelectorAll('.cmp-res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cmp-res-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRes = btn.dataset.res;
      const label = currentRes === 'original' ? 'Original' : btn.textContent;
      resVal.textContent = label;
      document.querySelector('[data-section="resolution"] .cmp-section__val').textContent = label;
      customResRow.style.display = currentRes === 'custom' ? 'flex' : 'none';
    });
  });

  /* ─────────────────────────────────────
     ACCORDION SECTIONS
  ───────────────────────────────────── */
  document.querySelectorAll('.cmp-section__head').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = 'sec' + btn.dataset.section.charAt(0).toUpperCase() + btn.dataset.section.slice(1);
      const body = document.getElementById(id);
      if (!body) return;
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      btn.classList.toggle('open', !isOpen);
    });
    // Init open state
    const id   = 'sec' + btn.dataset.section.charAt(0).toUpperCase() + btn.dataset.section.slice(1);
    const body = document.getElementById(id);
    if (body && body.classList.contains('open')) btn.classList.add('open');
  });

  /* ─────────────────────────────────────
     PRESETS
  ───────────────────────────────────── */
  document.querySelectorAll('.cmp-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cmp-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyPreset(btn.dataset.preset);
    });
  });

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    rngQuality.value     = p.quality;
    qualVal.textContent  = p.quality + '%';
    document.querySelector('[data-section="quality"] .cmp-section__val').textContent = p.quality + '%';
    selFormat.value      = p.format;
    selSharp.value       = p.sharp;
    selNoise.value       = p.noise;
    selChroma.value      = p.chroma;
    selMaxSize.value     = p.maxSize;
    // Resolution
    const resBtn = document.querySelector(`.cmp-res-btn[data-res="${p.res}"]`);
    if (resBtn) resBtn.click();
  }

  /* ─────────────────────────────────────
     DROP / INPUT
  ───────────────────────────────────── */
  dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('drag-over'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
  dropEl.addEventListener('drop', e => {
    e.preventDefault();
    dropEl.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });
  dropEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => handleFiles(Array.from(inputEl.files)));

  /* ─────────────────────────────────────
     FILE HANDLER
  ───────────────────────────────────── */
  function handleFiles(files) {
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (!valid.length) { toast('No valid image files found'); return; }

    valid.forEach(file => {
      const item = {
        id: Math.random().toString(36).slice(2),
        file,
        img: null,
        status: 'queued',
        blob: null,
        origSize: file.size,
        outSize: 0,
        outName: '',
        origUrl: null,
        outUrl: null,
      };
      queue.push(item);
      renderQueueItem(item);
    });

    dropEl.classList.add('has-files');
    settingsEl.classList.add('visible');
    goBtn.disabled = false;
    goCount.textContent = `(${queue.length} file${queue.length > 1 ? 's' : ''})`;
  }

  /* ─────────────────────────────────────
     QUEUE UI
  ───────────────────────────────────── */
  function renderQueueItem(item) {
    const div = document.createElement('div');
    div.className = 'cmp-queue-item';
    div.id = 'qi_' + item.id;

    const thumb = document.createElement('img');
    thumb.className = 'cmp-queue-item__thumb';
    thumb.alt = '';

    // Load thumbnail
    const fr = new FileReader();
    fr.onload = e => {
      thumb.src = e.target.result;
      item.origUrl = e.target.result;
    };
    fr.readAsDataURL(item.file);

    const info = document.createElement('div');
    info.className = 'cmp-queue-item__info';
    info.innerHTML = `
      <div class="cmp-queue-item__name">${item.file.name}</div>
      <div class="cmp-queue-item__meta">${fmtBytes(item.file.size)} · ${item.file.type.split('/')[1].toUpperCase()}</div>
    `;

    const status = document.createElement('div');
    status.className = 'cmp-queue-item__status';
    status.id = 'qis_' + item.id;
    status.textContent = 'QUEUED';

    const progressBar = document.createElement('div');
    progressBar.className = 'cmp-queue-item__progress';
    progressBar.id = 'qip_' + item.id;

    div.appendChild(thumb);
    div.appendChild(info);
    div.appendChild(status);
    div.appendChild(progressBar);
    queueEl.appendChild(div);
  }

  function updateItemStatus(id, status, text) {
    const el = document.getElementById('qis_' + id);
    if (el) { el.textContent = text; el.className = 'cmp-queue-item__status ' + status; }
  }

  function updateItemProgress(id, pct) {
    const el = document.getElementById('qip_' + id);
    if (el) el.style.width = pct + '%';
  }

  /* ─────────────────────────────────────
     MAIN COMPRESS BUTTON
  ───────────────────────────────────── */
  goBtn.addEventListener('click', () => {
    if (running || !queue.length) return;
    runBatch();
  });

  /* ─────────────────────────────────────
     BATCH RUNNER
  ───────────────────────────────────── */
  async function runBatch() {
    running = true;
    goBtn.disabled = true;
    resultsEl.classList.remove('visible');
    globalProg.classList.add('visible');
    results = [];

    const total = queue.length;
    let done = 0;

    setPhase(0);
    updateProgress(0, 'Starting…');

    for (const item of queue) {
      if (item.status === 'done') { done++; continue; }
      updateItemStatus(item.id, 'processing', 'PROCESSING');
      try {
        await compressOne(item, (pct, msg) => {
          updateItemProgress(item.id, pct);
          const overall = Math.round(((done + pct / 100) / total) * 100);
          updateProgress(overall, msg + ` · ${item.file.name}`);
        });
        item.status = 'done';
        updateItemStatus(item.id, 'done', `✓ ${fmtBytes(item.outSize)}`);
        updateItemProgress(item.id, 100);
        results.push(item);
      } catch (err) {
        item.status = 'error';
        updateItemStatus(item.id, 'error', 'ERROR');
        console.error(err);
      }
      done++;
      updateProgress(Math.round((done / total) * 100), `Done ${done}/${total}`);
    }

    updateProgress(100, 'All done!');
    setTimeout(() => {
      globalProg.classList.remove('visible');
      showResults();
      running = false;
    }, 600);
  }

  /* ─────────────────────────────────────
     COMPRESS ONE IMAGE
  ───────────────────────────────────── */
  async function compressOne(item, onProgress) {
    onProgress(5, 'Loading image');
    setPhase(0);

    // Load image into canvas
    const img = await loadImage(item.origUrl || await readFileAsDataURL(item.file));
    item.img  = img;
    onProgress(20, 'Loaded');

    // Get settings
    const quality   = parseInt(rngQuality.value) / 100;
    const format    = getOutputFormat(item.file.type, selFormat.value);
    const fitMode   = selFit.value;
    const sharpLvl  = parseInt(selSharp.value);
    const noiseLvl  = parseInt(selNoise.value);
    const maxSizeKB = parseInt(selMaxSize.value);
    const bgColor   = selBg.value === 'black' ? '#000' : selBg.value === 'transparent' ? null : '#fff';

    // Target dimensions
    setPhase(1);
    onProgress(30, 'Calculating dimensions');
    const { w, h } = getTargetDimensions(img.naturalWidth, img.naturalHeight, fitMode);

    // Draw to canvas
    onProgress(40, 'Rendering');
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Background
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw image with fit
    drawFit(ctx, img, w, h, fitMode);
    onProgress(55, 'Drawn');

    // Noise reduction (box blur)
    setPhase(2);
    if (noiseLvl > 0) {
      onProgress(60, 'Noise reduction');
      applyBoxBlur(ctx, w, h, noiseLvl);
    }

    // Sharpening (unsharp mask approx)
    if (sharpLvl > 0) {
      onProgress(65, 'Sharpening');
      applySharpen(ctx, w, h, sharpLvl);
    }

    // Color depth simulation
    const colorDepth = selColor.value;
    if (colorDepth !== 'auto' && colorDepth !== 'full') {
      onProgress(68, 'Color processing');
      applyColorDepth(ctx, w, h, colorDepth);
    }

    onProgress(70, 'Encoding');
    setPhase(3);

    // Encode
    const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    let blob;

    if (maxSizeKB > 0 && mime !== 'image/png') {
      // Binary search for quality that fits
      blob = await encodeToTargetSize(canvas, mime, quality, maxSizeKB * 1024, onProgress);
    } else {
      blob = await canvasToBlob(canvas, mime, quality);
    }

    // Output name
    const naming  = selNaming.value;
    const base    = item.file.name.replace(/\.[^.]+$/, '');
    const ext     = format === 'jpeg' ? 'jpg' : format;
    if      (naming === 'suffix')  item.outName = base + '_compressed.' + ext;
    else if (naming === 'prefix')  item.outName = 'compressed_' + base + '.' + ext;
    else                           item.outName = base + '.' + ext;

    item.blob    = blob;
    item.outSize = blob.size;
    item.outUrl  = URL.createObjectURL(blob);

    onProgress(100, 'Saved');
    setPhase(3, true);
  }

  /* ─────────────────────────────────────
     TARGET DIMENSIONS
  ───────────────────────────────────── */
  function getTargetDimensions(ow, oh, fitMode) {
    let maxW = null;
    if (currentRes === 'custom') {
      maxW = parseInt(customW.value) || null;
      const maxH = parseInt(customH.value) || null;
      if (maxW && maxH) {
        const ratio = Math.min(maxW / ow, maxH / oh);
        if (fitMode === 'downscale' && ratio >= 1) return { w: ow, h: oh };
        return { w: Math.round(ow * ratio), h: Math.round(oh * ratio) };
      }
    } else {
      maxW = RES_MAP[currentRes];
    }

    if (!maxW) return { w: ow, h: oh };
    if (fitMode === 'downscale' && ow <= maxW) return { w: ow, h: oh };

    const ratio = maxW / ow;
    return { w: maxW, h: Math.round(oh * ratio) };
  }

  /* ─────────────────────────────────────
     DRAW WITH FIT MODE
  ───────────────────────────────────── */
  function drawFit(ctx, img, w, h, fitMode) {
    const ow = img.naturalWidth, oh = img.naturalHeight;
    if (fitMode === 'fill') {
      ctx.drawImage(img, 0, 0, w, h);
      return;
    }
    if (fitMode === 'cover') {
      const ratio = Math.max(w / ow, h / oh);
      const nw = ow * ratio, nh = oh * ratio;
      const ox = (w - nw) / 2, oy = (h - nh) / 2;
      ctx.drawImage(img, ox, oy, nw, nh);
      return;
    }
    // contain / downscale
    const ratio = Math.min(w / ow, h / oh);
    const nw = ow * ratio, nh = oh * ratio;
    const ox = (w - nw) / 2, oy = (h - nh) / 2;
    ctx.drawImage(img, ox, oy, nw, nh);
  }

  /* ─────────────────────────────────────
     IMAGE PROCESSING FILTERS
  ───────────────────────────────────── */
  function applyBoxBlur(ctx, w, h, lvl) {
    const radius = lvl;
    for (let pass = 0; pass < radius; pass++) {
      const d = ctx.getImageData(0, 0, w, h);
      const src = new Uint8ClampedArray(d.data);
      const dst = d.data;
      const r = 1;
      for (let y = r; y < h - r; y++) {
        for (let x = r; x < w - r; x++) {
          let rr = 0, g = 0, b = 0, cnt = 0;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const idx = ((y + dy) * w + (x + dx)) * 4;
              rr += src[idx]; g += src[idx+1]; b += src[idx+2];
              cnt++;
            }
          }
          const i = (y * w + x) * 4;
          dst[i]   = rr / cnt;
          dst[i+1] = g  / cnt;
          dst[i+2] = b  / cnt;
        }
      }
      ctx.putImageData(d, 0, 0);
    }
  }

  function applySharpen(ctx, w, h, lvl) {
    const amount = lvl * 0.4; // 0.4, 0.8, 1.2
    const d = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(d.data);
    const dst = d.data;
    // Unsharp mask: dst = src + amount * (src - blur)
    // We use a single-pass Laplacian kernel as approximation
    const kernel = [0, -1, 0, -1, 4+1/amount, -1, 0, -1, 0];
    const kw = 3, kh = 3;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let rr = 0, g = 0, b = 0;
        for (let ky = 0; ky < kh; ky++) {
          for (let kx = 0; kx < kw; kx++) {
            const pidx = ((y + ky - 1) * w + (x + kx - 1)) * 4;
            const k    = kernel[ky * kw + kx];
            rr += src[pidx] * k;
            g  += src[pidx+1] * k;
            b  += src[pidx+2] * k;
          }
        }
        const i = (y * w + x) * 4;
        dst[i]   = Math.min(255, Math.max(0, rr * amount + src[i]   * (1 - amount)));
        dst[i+1] = Math.min(255, Math.max(0, g  * amount + src[i+1] * (1 - amount)));
        dst[i+2] = Math.min(255, Math.max(0, b  * amount + src[i+2] * (1 - amount)));
      }
    }
    ctx.putImageData(d, 0, 0);
  }

  function applyColorDepth(ctx, w, h, depth) {
    const steps = { high: 64, medium: 32, low: 8 };
    const step  = steps[depth] || 32;
    const d = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i]   = Math.round(d.data[i]   / step) * step;
      d.data[i+1] = Math.round(d.data[i+1] / step) * step;
      d.data[i+2] = Math.round(d.data[i+2] / step) * step;
    }
    ctx.putImageData(d, 0, 0);
  }

  /* ─────────────────────────────────────
     ENCODE TO TARGET SIZE (binary search)
  ───────────────────────────────────── */
  async function encodeToTargetSize(canvas, mime, preferredQ, maxBytes, onProgress) {
    let lo = 0.05, hi = preferredQ, best = null;
    for (let i = 0; i < 8; i++) {
      const mid  = (lo + hi) / 2;
      const blob = await canvasToBlob(canvas, mime, mid);
      if (blob.size <= maxBytes) { best = blob; lo = mid; }
      else hi = mid;
      onProgress(70 + Math.round(i / 8 * 25), `Optimizing quality…`);
    }
    return best || await canvasToBlob(canvas, mime, lo);
  }

  /* ─────────────────────────────────────
     HELPERS
  ───────────────────────────────────── */
  function getOutputFormat(mimeType, sel) {
    if (sel !== 'auto') return sel;
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    return 'jpeg';
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(res => canvas.toBlob(res, mime, quality));
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload  = () => res(i);
      i.onerror = () => rej(new Error('Image load failed'));
      i.src = src;
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload  = e => res(e.target.result);
      fr.onerror = () => rej(new Error('Read failed'));
      fr.readAsDataURL(file);
    });
  }

  function fmtBytes(b) {
    if (b < 1024)    return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  function fmtSaving(orig, out) {
    const pct = Math.round((1 - out / orig) * 100);
    return (pct > 0 ? '-' : '+') + Math.abs(pct) + '%';
  }

  /* ─────────────────────────────────────
     PROGRESS UI
  ───────────────────────────────────── */
  function updateProgress(pct, msg) {
    gpBar.style.width = pct + '%';
    gpPct.textContent = pct + '%';
    gpLog.textContent = msg;
  }

  function setPhase(idx, done) {
    const phases = gpPhases.querySelectorAll('.phase');
    phases.forEach((p, i) => {
      p.classList.remove('active', 'done');
      if (done && i <= idx) p.classList.add('done');
      else if (!done && i === idx) p.classList.add('active');
      else if (i < idx) p.classList.add('done');
    });
  }

  /* ─────────────────────────────────────
     RESULTS
  ───────────────────────────────────── */
  function showResults() {
    resultsEl.classList.add('visible');
    resultsList.innerHTML = '';

    let totalOrig = 0, totalOut = 0;

    results.forEach(item => {
      totalOrig += item.origSize;
      totalOut  += item.outSize;

      const row = document.createElement('div');
      row.className = 'cmp-result-item';

      const thumb = document.createElement('img');
      thumb.className = 'cmp-result-item__thumb';
      thumb.src = item.outUrl;
      thumb.alt = '';

      row.innerHTML = `
        <div class="cmp-result-item__info">
          <div class="cmp-result-item__name">${item.outName}</div>
          <div class="cmp-result-item__sizes">${fmtBytes(item.origSize)} → ${fmtBytes(item.outSize)}</div>
        </div>
        <div class="cmp-result-item__saving">${fmtSaving(item.origSize, item.outSize)}</div>
        <button class="cmp-result-item__dl" data-id="${item.id}">↓ Save</button>
      `;
      row.insertBefore(thumb, row.firstChild);

      row.querySelector('.cmp-result-item__dl').addEventListener('click', () => downloadItem(item));
      resultsList.appendChild(row);
    });

    const saved    = totalOrig - totalOut;
    const savedPct = Math.round((saved / totalOrig) * 100);

    resultsStats.innerHTML = `
      <div class="cmp-results__stat"><strong>${results.length}</strong><span>Files</span></div>
      <div class="cmp-results__stat"><strong>${fmtBytes(totalOrig)}</strong><span>Original</span></div>
      <div class="cmp-results__stat"><strong>${fmtBytes(totalOut)}</strong><span>Compressed</span></div>
      <div class="cmp-results__stat"><strong>${savedPct}%</strong><span>Saved</span></div>
    `;

    // Update sidebar stats
    const totalConverted = parseInt(localStorage.getItem('cmp-count') || '0') + results.length;
    localStorage.setItem('cmp-count', totalConverted);
    if (statFiles) statFiles.textContent = totalConverted.toLocaleString();

    const totalSavedBytes = parseInt(localStorage.getItem('cmp-saved') || '0') + saved;
    localStorage.setItem('cmp-saved', totalSavedBytes);
    if (statSaved) statSaved.textContent = fmtBytes(Math.max(0, totalSavedBytes));

    // Build modal selector
    buildModalSelect();

    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ─────────────────────────────────────
     DOWNLOAD
  ───────────────────────────────────── */
  function downloadItem(item) {
    const a = document.createElement('a');
    a.href     = item.outUrl;
    a.download = item.outName;
    a.click();
  }

  dlAllBtn.addEventListener('click', async () => {
    if (results.length === 1) { downloadItem(results[0]); return; }
    toast('Building ZIP…');
    await loadJSZip();
    const zip = new JSZip();
    for (const item of results) {
      const ab = await item.blob.arrayBuffer();
      zip.file(item.outName, ab);
    }
    const zBlob = await zip.generateAsync({ type: 'blob' });
    const a     = document.createElement('a');
    a.href       = URL.createObjectURL(zBlob);
    a.download   = 'gifonte_compressed.zip';
    a.click();
  });

  /* ─────────────────────────────────────
     BEFORE / AFTER MODAL
  ───────────────────────────────────── */
  compareBtn.addEventListener('click', () => openModal(0));
  modalClose.addEventListener('click', closeModal);
  modalBg.addEventListener('click', closeModal);

  function buildModalSelect() {
    modalSelect.innerHTML = '';
    results.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.className   = 'cmp-modal-sel-btn' + (i === 0 ? ' active' : '');
      btn.textContent = item.file.name.length > 18 ? item.file.name.slice(0, 16) + '…' : item.file.name;
      btn.addEventListener('click', () => {
        modalSelect.querySelectorAll('.cmp-modal-sel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCompare(i);
      });
      modalSelect.appendChild(btn);
    });
  }

  function openModal(idx) {
    if (!results.length) return;
    modal.classList.add('visible');
    modalBg.classList.add('visible');
    renderCompare(idx);
  }

  function closeModal() {
    modal.classList.remove('visible');
    modalBg.classList.remove('visible');
  }

  async function renderCompare(idx) {
    const item = results[idx];
    if (!item) return;

    const canvasBefore = document.getElementById('cmpCanvasBefore');
    const canvasAfter  = document.getElementById('cmpCanvasAfter');
    const lblBefore    = document.getElementById('cmpLabelBefore');
    const lblAfter     = document.getElementById('cmpLabelAfter');

    // Before
    const imgBefore = await loadImage(item.origUrl);
    canvasBefore.width  = imgBefore.naturalWidth;
    canvasBefore.height = imgBefore.naturalHeight;
    canvasBefore.getContext('2d').drawImage(imgBefore, 0, 0);
    lblBefore.textContent = ' · ' + fmtBytes(item.origSize);

    // After
    const imgAfter = await loadImage(item.outUrl);
    canvasAfter.width  = imgAfter.naturalWidth;
    canvasAfter.height = imgAfter.naturalHeight;
    canvasAfter.getContext('2d').drawImage(imgAfter, 0, 0);
    lblAfter.textContent = ' · ' + fmtBytes(item.outSize) + ' (' + fmtSaving(item.origSize, item.outSize) + ')';
  }

  /* ─────────────────────────────────────
     RESET
  ───────────────────────────────────── */
  resetAllBtn.addEventListener('click', resetAll);

  function resetAll() {
    queue   = [];
    results = [];
    running = false;
    queueEl.innerHTML = '';
    resultsList.innerHTML = '';
    resultsEl.classList.remove('visible');
    globalProg.classList.remove('visible');
    settingsEl.classList.remove('visible');
    dropEl.classList.remove('has-files');
    goBtn.disabled = true;
    goCount.textContent = '';
    inputEl.value = '';
    closeModal();
    updateProgress(0, 'Ready…');
  }

  /* ─────────────────────────────────────
     TOAST
  ───────────────────────────────────── */
  function toast(msg) {
    if (window.showToast) { window.showToast(msg); return; }
    let t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._cmpToast);
    window._cmpToast = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ─────────────────────────────────────
     INIT: load persisted stats
  ───────────────────────────────────── */
  const storedFiles = parseInt(localStorage.getItem('cmp-count') || '0');
  const storedSaved = parseInt(localStorage.getItem('cmp-saved') || '0');
  if (statFiles) statFiles.textContent = storedFiles.toLocaleString();
  if (statSaved) statSaved.textContent = fmtBytes(Math.max(0, storedSaved));

})();
