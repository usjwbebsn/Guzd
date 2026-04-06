/* ══════════════════════════════════════════
   GIFONTE.COM — GIF CONVERTER v2.2
   FFmpeg.wasm — GitHub Pages compatible.
   
   KEY FIX: Downloads ffmpeg.js + worker chunk
   as blobs, patches the Worker constructor to
   use a blob URL. This bypasses the origin
   restriction on Worker scripts entirely.
   No SharedArrayBuffer / COI headers needed
   for the Worker itself — only for the WASM.
   COI is provided by coi-serviceworker.js.
══════════════════════════════════════════ */

(function () {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm';
  const FFMPEG_VER  = '0.12.6';
  const CORE_VER    = '0.12.6';
  const FFMPEG_BASE = `${CDN}/@ffmpeg/ffmpeg@${FFMPEG_VER}/dist/umd`;
  const CORE_BASE   = `${CDN}/@ffmpeg/core@${CORE_VER}/dist/umd`;

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
  const selWidth         = document.getElementById('selWidth');
  const selFps           = document.getElementById('selFps');
  const selStart         = document.getElementById('selStart');
  const selDuration      = document.getElementById('selDuration');
  const selQuality       = document.getElementById('selQuality');
  const selDither        = document.getElementById('selDither');
  const SETTINGS         = [selWidth, selFps, selStart, selDuration, selQuality, selDither];

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

  function lockUI() {
    isConverting = true;
    btnConvert.disabled = true;
    btnConvert.textContent = 'PROCESSING...';
    SETTINGS.forEach(el => { if (el) el.disabled = true; });
    dropZone.style.pointerEvents = 'none';
    dropZone.style.opacity = '0.4';
    fileInput.disabled = true;
    if (lockBanner) lockBanner.classList.add('visible');
  }

  function unlockUI() {
    isConverting = false;
    btnConvert.disabled = !videoFile;
    btnConvert.textContent = 'CONVERT TO GIF';
    SETTINGS.forEach(el => { if (el) el.disabled = false; });
    dropZone.style.pointerEvents = '';
    dropZone.style.opacity = '';
    fileInput.disabled = false;
    if (lockBanner) lockBanner.classList.remove('visible');
  }

  // ── Fetch as blob URL (bypasses CORS Worker restriction) ─
  async function fetchBlobURL(url, mimeType) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url} (${resp.status})`);
    const blob = new Blob([await resp.blob()], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  // ── Load FFmpeg.wasm — full blob patching ─────────────────
  // Downloads ffmpeg.js as TEXT, replaces the relative worker
  // chunk URL "814.ffmpeg.js" with the pre-fetched blob URL,
  // then executes it. This makes new Worker(workerBlobURL)
  // work from ANY origin with no CORS error.
  async function loadFFmpeg() {
    if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;

    setProgress(3, 'Fetching FFmpeg engine...');

    // 1. Download the worker chunk first as a blob URL
    const workerBlobURL = await fetchBlobURL(
      `${FFMPEG_BASE}/814.ffmpeg.js`,
      'text/javascript'
    );

    setProgress(10, 'Patching worker loader...');

    // 2. Download main ffmpeg.js as text and patch worker URL
    const ffmpegResp = await fetch(`${FFMPEG_BASE}/ffmpeg.js`);
    if (!ffmpegResp.ok) throw new Error('Failed to fetch ffmpeg.js');
    let ffmpegSrc = await ffmpegResp.text();

    // The UMD build contains: new Worker(new URL("./814.ffmpeg.js", import.meta.url))
    // OR a string reference to "814.ffmpeg.js" in a dynamic import
    // We replace ALL references to the chunk filename with our blob URL
    ffmpegSrc = ffmpegSrc
      .replace(/["']814\.ffmpeg\.js["']/g, JSON.stringify(workerBlobURL))
      .replace(/new URL\(["']\.\/814\.ffmpeg\.js["'][^)]*\)/g, `new URL(${JSON.stringify(workerBlobURL)})`);

    setProgress(16, 'Loading patched engine...');

    // 3. Execute patched source
    const patchedBlob   = new Blob([ffmpegSrc], { type: 'text/javascript' });
    const patchedBlobURL = URL.createObjectURL(patchedBlob);
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = patchedBlobURL;
      s.onload = resolve;
      s.onerror = () => reject(new Error('FFmpeg script failed to execute'));
      document.head.appendChild(s);
    });
    URL.revokeObjectURL(patchedBlobURL);

    // 4. Get FFmpeg class from global
    const NS = window.FFmpegWASM || window.FFmpeg;
    if (!NS || !NS.FFmpeg) throw new Error('FFmpeg.wasm did not expose global. Check CDN.');

    ffmpegInstance = new NS.FFmpeg();
    ffmpegInstance.on('progress', ({ progress }) => {
      if (!isConverting) return;
      setProgress(50 + Math.min(progress, 1) * 42, `Rendering... ${Math.round(progress * 100)}%`);
    });

    // 5. Load WASM core as blob URLs
    setProgress(22, 'Downloading WASM core (~8 MB)...');
    const coreURL = await fetchBlobURL(`${CORE_BASE}/ffmpeg-core.js`,   'text/javascript');
    setProgress(32, 'Downloading WASM binary...');
    const wasmURL = await fetchBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');

    setProgress(40, 'Initializing FFmpeg engine...');
    await ffmpegInstance.load({ coreURL, wasmURL });

    ffmpegLoaded = true;
    return ffmpegInstance;
  }

  // ── File drop / select ────────────────────
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
    videoPreview.src = URL.createObjectURL(f);
    videoPreview.onloadedmetadata = () => {
      videoDuration.innerHTML = `<strong>${videoPreview.duration.toFixed(1)}s</strong>`;
      videoRes.innerHTML      = `<strong>${videoPreview.videoWidth}×${videoPreview.videoHeight}</strong>`;
      videoSize.innerHTML     = `<strong>${formatBytes(f.size)}</strong>`;
    };
    videoPreviewWrap.style.display = 'block';
    btnConvert.disabled = false;
  }

  // ── Convert ───────────────────────────────
  btnConvert.addEventListener('click', startConvert);
  btnCancel.addEventListener('click',  cancelConvert);
  btnNew.addEventListener('click',     resetUI);
  btnDownload.addEventListener('click', downloadGif);

  async function startConvert() {
    if (!videoFile || isConverting) return;
    gifBlob = null;
    errorMsg.style.display = 'none';
    resultWrap.style.display = 'none';
    progressWrap.style.display = 'block';
    lockUI();
    setPhase(0);
    setProgress(2, 'Starting...');

    const targetWidth   = parseInt(selWidth.value, 10);
    const fps           = parseInt(selFps.value, 10);
    const startSec      = parseFloat(selStart.value) || 0;
    const duration      = Math.min(parseFloat(selDuration.value) || 5, 20);
    const quality       = parseInt(selQuality.value, 10);
    const dither        = selDither.value;
    const paletteColors = Math.round(256 - ((quality - 1) / 19) * 192);
    const ditherMode    = dither === 'none'       ? 'none' :
                          dither === 'bayer'       ? 'bayer:bayer_scale=3' :
                          dither === 'sierra2_4a'  ? 'sierra2_4a' : 'floyd_steinberg';

    try {
      // Phase 0: Load engine
      const ffmpeg = await loadFFmpeg();
      if (!isConverting) return;

      // Phase 1: Write video
      setPhase(1);
      setProgress(43, 'Loading video into memory...');
      const buf = await videoFile.arrayBuffer();
      if (!isConverting) return;
      await ffmpeg.writeFile('input.mp4', new Uint8Array(buf));

      // Phase 2: Encode
      setPhase(2);
      setProgress(47, 'Pass 1 — Generating color palette...');
      const vf = `fps=${fps},scale=${targetWidth}:-1:flags=lanczos`;

      await ffmpeg.exec([
        '-ss', String(startSec), '-t', String(duration),
        '-i', 'input.mp4',
        '-vf', `${vf},palettegen=max_colors=${paletteColors}:stats_mode=single`,
        '-y', 'palette.png'
      ]);
      if (!isConverting) return;

      setProgress(50, 'Pass 2 — Rendering GIF...');
      await ffmpeg.exec([
        '-ss', String(startSec), '-t', String(duration),
        '-i', 'input.mp4', '-i', 'palette.png',
        '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=${ditherMode}`,
        '-y', 'output.gif'
      ]);
      if (!isConverting) return;

      // Phase 3: Read result
      setPhase(3);
      setProgress(93, 'Reading output...');
      const data = await ffmpeg.readFile('output.gif');
      if (!isConverting) return;

      try { await ffmpeg.deleteFile('input.mp4');  } catch(e) {}
      try { await ffmpeg.deleteFile('palette.png'); } catch(e) {}
      try { await ffmpeg.deleteFile('output.gif');  } catch(e) {}

      gifBlob = new Blob([data.buffer], { type: 'image/gif' });
      setProgress(100, 'Done.');
      await new Promise(r => setTimeout(r, 300));

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

  function downloadGif() {
    if (!gifBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(gifBlob);
    a.download = 'gifonte_' + Date.now() + '.gif';
    a.click();
    if (typeof showToast === 'function') showToast('DOWNLOADING GIF');
  }

  function resetUI() {
    videoFile = null; gifBlob = null;
    videoPreviewWrap.style.display = 'none';
    resultWrap.style.display = 'none';
    progressWrap.style.display = 'none';
    errorMsg.style.display = 'none';
    videoPreview.src = ''; fileInput.value = '';
    setProgress(0, ''); setPhase(-1);
    unlockUI(); btnConvert.disabled = true;
  }

  document.querySelectorAll('input[type="range"]').forEach(r => {
    const out = r.nextElementSibling;
    if (out && out.classList.contains('range-val')) {
      r.addEventListener('input', () => { out.textContent = r.value + (r.dataset.unit || ''); });
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    btnConvert.disabled = true;
    setPhase(-1);
  });

})();
