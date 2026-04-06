/* ══════════════════════════════════════════
   GIFONTE.COM — GIF CONVERTER ENGINE v2.1
   FFmpeg.wasm + coi-serviceworker for GitHub Pages
   — Patches worker URL issue in UMD build
   — Inputs locked during conversion
══════════════════════════════════════════ */

(function () {
  'use strict';

  // jsdelivr is more reliable for CORS than unpkg for WASM files
  const FFMPEG_JS_URL  = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
  const CORE_BASE      = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

  let ffmpegInstance = null;
  let ffmpegLoaded   = false;
  let isConverting   = false;
  let videoFile      = null;
  let gifBlob        = null;

  // ── DOM refs ─────────────────────────────
  const dropZone         = document.getElementById('dropZone');
  const fileInput        = document.getElementById('fileInput');
  const videoPreviewWrap = document.getElementById('videoPreviewWrap');
  const videoPreview     = document.getElementById('videoPreview');
  const videoDuration    = document.getElementById('videoDuration');
  const videoRes         = document.getElementById('videoRes');
  const videoSize        = document.getElementById('videoSize');
  const progressWrap     = document.getElementById('progressWrap');
  const resultWrap       = document.getElementById('resultWrap');
  const errorMsg         = document.getElementById('errorMsg');
  const btnConvert       = document.getElementById('btnConvert');
  const btnCancel        = document.getElementById('btnCancel');
  const btnNew           = document.getElementById('btnNew');
  const btnDownload      = document.getElementById('btnDownload');
  const progressFill     = document.getElementById('progressFill');
  const progressPct      = document.getElementById('progressPct');
  const progressLog      = document.getElementById('progressLog');
  const resultImg        = document.getElementById('resultImg');
  const resDimension     = document.getElementById('resDimension');
  const resFrames        = document.getElementById('resFrames');
  const resFps           = document.getElementById('resFps');
  const resSize          = document.getElementById('resSize');
  const phases           = document.querySelectorAll('.phase-item');
  const lockBanner       = document.getElementById('conversionLockBanner');

  const selWidth    = document.getElementById('selWidth');
  const selFps      = document.getElementById('selFps');
  const selStart    = document.getElementById('selStart');
  const selDuration = document.getElementById('selDuration');
  const selQuality  = document.getElementById('selQuality');
  const selDither   = document.getElementById('selDither');

  const SETTINGS_INPUTS = [selWidth, selFps, selStart, selDuration, selQuality, selDither];

  // ── Helpers ──────────────────────────────
  function setPhase(idx) {
    phases.forEach((p, i) => {
      p.classList.remove('active', 'done');
      if (i < idx)  p.classList.add('done');
      if (i === idx) p.classList.add('active');
    });
  }

  function setProgress(pct, log) {
    const c = Math.min(100, Math.max(0, pct));
    progressFill.style.width = c + '%';
    progressPct.textContent  = Math.round(c) + '%';
    if (log) progressLog.textContent = log;
  }

  function showError(msg) {
    errorMsg.textContent = '✕ ' + msg;
    errorMsg.style.display = 'block';
    progressWrap.style.display = 'none';
    unlockUI();
  }

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  // ── UI lock/unlock ────────────────────────
  function lockUI() {
    isConverting = true;
    btnConvert.disabled = true;
    btnConvert.textContent = 'PROCESSING...';
    SETTINGS_INPUTS.forEach(el => { if (el) el.disabled = true; });
    dropZone.style.pointerEvents = 'none';
    dropZone.style.opacity = '0.4';
    fileInput.disabled = true;
    if (lockBanner) lockBanner.classList.add('visible');
  }

  function unlockUI() {
    isConverting = false;
    btnConvert.disabled = !videoFile;
    btnConvert.textContent = 'CONVERT TO GIF';
    SETTINGS_INPUTS.forEach(el => { if (el) el.disabled = false; });
    dropZone.style.pointerEvents = '';
    dropZone.style.opacity = '';
    fileInput.disabled = false;
    if (lockBanner) lockBanner.classList.remove('visible');
  }

  // ── Load FFmpeg.wasm ─────────────────────
  // Fetches ffmpeg.js as text, patches the worker blob URL so
  // the "814.ffmpeg.js" chunk is loaded correctly from CDN
  // instead of failing with a relative-path Worker error.
  async function loadFFmpegPatched() {
    if (window.__ffmpegPatched) return;

    setProgress(5, 'Downloading FFmpeg engine...');

    // Fetch the main ffmpeg.js text
    const resp = await fetch(FFMPEG_JS_URL);
    if (!resp.ok) throw new Error('Failed to fetch FFmpeg library (' + resp.status + ')');
    let src = await resp.text();

    // Patch: replace the relative worker chunk URL with an absolute CDN one
    // The UMD build uses new Worker(workerURL) where workerURL ends up as
    // a relative "814.ffmpeg.js" that breaks on GitHub Pages.
    // We patch it to always point to the CDN absolute URL.
    const workerURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js';
    // Replace the dynamic chunk pattern — it looks like: new Worker(new URL("./814.ffmpeg.js",...)
    src = src.replace(
      /new Worker\(new URL\([^)]+\)[^)]*\)/g,
      `new Worker((()=>{const b=new Blob([],{type:'application/javascript'});const u=URL.createObjectURL(b);return u})(), {type:'classic'})` // fallback placeholder — overridden below
    );
    // Better approach: patch the string literal for the chunk filename
    src = src.replace(/"814\.ffmpeg\.js"/g, JSON.stringify(workerURL));
    src = src.replace(/'814\.ffmpeg\.js'/g, JSON.stringify(workerURL));

    // Eval the patched source in global scope
    const blob = new Blob([src], { type: 'text/javascript' });
    const blobURL = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = blobURL;
      s.onload = resolve;
      s.onerror = () => reject(new Error('FFmpeg script load failed'));
      document.head.appendChild(s);
    });
    URL.revokeObjectURL(blobURL);
    window.__ffmpegPatched = true;
  }

  async function getFFmpeg() {
    if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;

    await loadFFmpegPatched();

    // The UMD build exposes window.FFmpegWASM or window.FFmpeg
    const FFmpegNS = window.FFmpegWASM || window.FFmpeg;
    if (!FFmpegNS || !FFmpegNS.FFmpeg) {
      throw new Error('FFmpeg.wasm failed to load. Check your internet connection.');
    }

    ffmpegInstance = new FFmpegNS.FFmpeg();

    ffmpegInstance.on('progress', ({ progress }) => {
      if (!isConverting) return;
      const pct = 45 + Math.min(progress, 1) * 45;
      setProgress(pct, 'Rendering GIF... ' + Math.round(progress * 100) + '%');
    });

    setProgress(20, 'Loading WASM core (~5 MB)...');

    // Load core as blob URLs to avoid CORS issues
    const toBlobURL = async (url, type) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to fetch ' + url);
      const b = await r.blob();
      return URL.createObjectURL(new Blob([b], { type }));
    };

    const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`,   'text/javascript');
    const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');

    setProgress(35, 'Initializing engine...');
    await ffmpegInstance.load({ coreURL, wasmURL });

    ffmpegLoaded = true;
    return ffmpegInstance;
  }

  // ── File handling ────────────────────────
  dropZone.addEventListener('dragover', e => {
    if (isConverting) return;
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    if (isConverting) return;
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  fileInput.addEventListener('change', e => {
    if (isConverting) return;
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  function handleFile(f) {
    if (!f.type.startsWith('video/')) {
      showError('Please select a video file (MP4, WebM, MOV, etc.)');
      return;
    }
    videoFile = f;
    errorMsg.style.display = 'none';
    resultWrap.style.display = 'none';
    progressWrap.style.display = 'none';
    const url = URL.createObjectURL(f);
    videoPreview.src = url;
    videoPreview.onloadedmetadata = () => {
      videoDuration.innerHTML = `<strong>${videoPreview.duration.toFixed(1)}s</strong>`;
      videoRes.innerHTML      = `<strong>${videoPreview.videoWidth}×${videoPreview.videoHeight}</strong>`;
      videoSize.innerHTML     = `<strong>${formatBytes(f.size)}</strong>`;
    };
    videoPreviewWrap.style.display = 'block';
    btnConvert.disabled = false;
  }

  // ── Convert ──────────────────────────────
  btnConvert.addEventListener('click', startConvert);
  btnCancel.addEventListener('click', cancelConvert);
  btnNew.addEventListener('click', resetUI);
  btnDownload.addEventListener('click', downloadGif);

  async function startConvert() {
    if (!videoFile || isConverting) return;
    gifBlob = null;
    errorMsg.style.display = 'none';
    resultWrap.style.display = 'none';
    progressWrap.style.display = 'block';
    lockUI();
    setPhase(0);
    setProgress(2, 'Initializing...');

    const targetWidth = parseInt(selWidth.value, 10);
    const fps         = parseInt(selFps.value, 10);
    const startSec    = parseFloat(selStart.value) || 0;
    const duration    = Math.min(parseFloat(selDuration.value) || 5, 20);
    const quality     = parseInt(selQuality.value, 10);
    const dither      = selDither.value;

    // quality 1–20 → palette colors 256–64
    const paletteColors = Math.round(256 - ((quality - 1) / 19) * 192);

    const ditherMode = dither === 'none'       ? 'none' :
                       dither === 'bayer'      ? 'bayer:bayer_scale=3' :
                       dither === 'sierra2_4a' ? 'sierra2_4a' :
                                                 'floyd_steinberg';

    try {
      // Phase 0: Engine
      const ffmpeg = await getFFmpeg();
      if (!isConverting) return;

      // Phase 1: Write video to WASM FS
      setPhase(1);
      setProgress(38, 'Reading video into memory...');
      const buf = await videoFile.arrayBuffer();
      if (!isConverting) return;
      await ffmpeg.writeFile('input.mp4', new Uint8Array(buf));
      setProgress(42, 'Video buffered. Generating palette...');

      // Phase 2: 2-pass FFmpeg encoding
      setPhase(2);
      const vfBase = `fps=${fps},scale=${targetWidth}:-1:flags=lanczos`;

      await ffmpeg.exec([
        '-ss', String(startSec), '-t', String(duration),
        '-i',  'input.mp4',
        '-vf', `${vfBase},palettegen=max_colors=${paletteColors}:stats_mode=single`,
        '-y',  'palette.png'
      ]);
      if (!isConverting) return;

      setProgress(45, 'Pass 2 — Rendering GIF...');
      await ffmpeg.exec([
        '-ss', String(startSec), '-t', String(duration),
        '-i',  'input.mp4',
        '-i',  'palette.png',
        '-lavfi', `${vfBase}[x];[x][1:v]paletteuse=dither=${ditherMode}`,
        '-y',  'output.gif'
      ]);
      if (!isConverting) return;

      // Phase 3: Read result
      setPhase(3);
      setProgress(92, 'Reading output...');
      const data = await ffmpeg.readFile('output.gif');
      if (!isConverting) return;

      try { await ffmpeg.deleteFile('input.mp4');  } catch(e) {}
      try { await ffmpeg.deleteFile('palette.png'); } catch(e) {}
      try { await ffmpeg.deleteFile('output.gif');  } catch(e) {}

      gifBlob = new Blob([data.buffer], { type: 'image/gif' });
      setProgress(100, 'Done.');
      await new Promise(r => setTimeout(r, 280));

      const gifUrl = URL.createObjectURL(gifBlob);
      const gifImg = new Image();
      await new Promise(r => { gifImg.onload = r; gifImg.src = gifUrl; });

      resultImg.src            = gifUrl;
      resDimension.textContent = `${gifImg.naturalWidth}×${gifImg.naturalHeight}`;
      resFrames.textContent    = String(Math.round(duration * fps));
      resFps.textContent       = `${fps} fps`;
      resSize.textContent      = formatBytes(gifBlob.size);

      progressWrap.style.display = 'none';
      resultWrap.style.display   = 'block';

    } catch (err) {
      if (!isConverting) {
        progressWrap.style.display = 'none';
        setProgress(0, '');
      } else {
        console.error('[GIF]', err);
        showError(err.message || 'Conversion failed. Try a shorter clip or lower quality.');
      }
    } finally {
      unlockUI();
      setPhase(-1);
    }
  }

  // ── Cancel ───────────────────────────────
  async function cancelConvert() {
    if (!isConverting) return;
    const was = isConverting;
    unlockUI();
    if (was && ffmpegInstance) {
      try { ffmpegInstance.terminate(); } catch(e) {}
      ffmpegInstance = null;
      ffmpegLoaded   = false;
    }
    progressWrap.style.display = 'none';
    setProgress(0, '');
    setPhase(-1);
    if (videoFile) btnConvert.disabled = false;
  }

  // ── Download ─────────────────────────────
  function downloadGif() {
    if (!gifBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(gifBlob);
    a.download = 'gifonte_' + Date.now() + '.gif';
    a.click();
    if (typeof showToast === 'function') showToast('DOWNLOADING GIF');
  }

  // ── Reset ────────────────────────────────
  function resetUI() {
    videoFile = null;
    gifBlob   = null;
    videoPreviewWrap.style.display = 'none';
    resultWrap.style.display       = 'none';
    progressWrap.style.display     = 'none';
    errorMsg.style.display         = 'none';
    videoPreview.src = '';
    fileInput.value  = '';
    setProgress(0, '');
    setPhase(-1);
    unlockUI();
    btnConvert.disabled = true;
  }

  // ── Range live values ────────────────────
  document.querySelectorAll('input[type="range"]').forEach(r => {
    const out = r.nextElementSibling;
    if (out && out.classList.contains('range-val')) {
      r.addEventListener('input', () => { out.textContent = r.value + (r.dataset.unit || ''); });
    }
  });

  // ── Init ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    btnConvert.disabled = true;
    setPhase(-1);
    // Pre-load FFmpeg silently in background after 1.5s
    setTimeout(() => { getFFmpeg().catch(() => {}); }, 1500);
  });

})();
