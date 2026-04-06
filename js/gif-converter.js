/* ══════════════════════════════════════════
   GIFONTE.COM — GIF CONVERTER v6.0
   Canvas seek frame extraction (universal).
   Inline NeuQuant + LZW + GIF writer.
   Zero external dependencies for encoding.
   Zero Workers. Zero WASM. Zero CDN needed.
══════════════════════════════════════════ */
(function () {
  'use strict';

  let isConverting = false;
  let videoFile    = null;
  let gifBlob      = null;

  // ── DOM ──────────────────────────────────
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

  // ── UI helpers ────────────────────────────
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
    if (b < 1024)    return b + ' B';
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

  // ── File handling ─────────────────────────
  dropZone.addEventListener('dragover', e => {
    if (!isConverting) { e.preventDefault(); dropZone.classList.add('drag-over'); }
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    if (isConverting) return;
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (!isConverting && e.target.files[0]) handleFile(e.target.files[0]);
  });

  function handleFile(f) {
    if (!f.type.startsWith('video/')) { showError('Please select a video file.'); return; }
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

  // ── Controls ──────────────────────────────
  btnConvert.addEventListener('click',  startConvert);
  btnCancel.addEventListener('click',   doCancel);
  btnNew.addEventListener('click',      resetAll);
  btnDownload.addEventListener('click', downloadGif);

  // ══════════════════════════════════════════
  //  FRAME EXTRACTION — seek-based
  //  Uses Promise + onseeked event.
  //  Robust timeout per frame for mobile.
  // ══════════════════════════════════════════
  function extractFrames(video, canvas, ctx, startSec, duration, fps, gifW, gifH) {
    return new Promise((resolve, reject) => {
      const frameCount = Math.round(duration * fps);
      const frames = [];
      let current = 0;
      let seekTimer = null;

      function cleanup() {
        video.onseeked = null;
        video.onerror  = null;
        if (seekTimer) clearTimeout(seekTimer);
      }

      function captureAndNext() {
        // Capture current frame
        ctx.clearRect(0, 0, gifW, gifH);
        ctx.drawImage(video, 0, 0, gifW, gifH);
        frames.push(new Uint8ClampedArray(ctx.getImageData(0, 0, gifW, gifH).data));

        const pct = 8 + (current / frameCount) * 37;
        setProgress(pct, `Extracting frame ${current + 1} / ${frameCount}`);
        current++;

        if (!isConverting) { cleanup(); resolve(frames); return; }
        if (current >= frameCount) { cleanup(); resolve(frames); return; }

        seekToNext();
      }

      function seekToNext() {
        if (!isConverting) { cleanup(); resolve(frames); return; }
        const t = startSec + (current / fps);

        // Per-frame timeout — mobile seek can stall
        if (seekTimer) clearTimeout(seekTimer);
        seekTimer = setTimeout(() => {
          // Seek stalled — try to capture whatever frame is showing
          captureAndNext();
        }, 2500);

        video.currentTime = t;
      }

      video.onseeked = () => {
        if (seekTimer) { clearTimeout(seekTimer); seekTimer = null; }
        // Small delay on mobile to ensure frame is rendered
        setTimeout(captureAndNext, 30);
      };

      video.onerror = () => { cleanup(); reject(new Error('Video error during seek.')); };

      video.pause();
      seekToNext();
    });
  }

  // ══════════════════════════════════════════
  //  COLOR QUANTIZATION — fast k-means
  // ══════════════════════════════════════════
  function buildPalette(pixels, numColors, samplefac) {
    numColors = numColors || 256;
    samplefac = Math.max(1, samplefac || 5);
    const step = samplefac * 4;
    const N = numColors;
    // Init palette from evenly-spaced samples
    const palette = new Uint8Array(N * 3);
    const pxCount = pixels.length >> 2;
    for (let i = 0; i < N; i++) {
      const p = Math.floor(i * pxCount / N) * 4;
      palette[i*3]   = pixels[p];
      palette[i*3+1] = pixels[p+1];
      palette[i*3+2] = pixels[p+2];
    }
    // 4 iterations of k-means
    for (let iter = 0; iter < 4; iter++) {
      const sums  = new Float64Array(N * 3);
      const count = new Uint32Array(N);
      for (let i = 0; i < pixels.length; i += step) {
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
        let best = 0, bestD = Infinity;
        for (let j = 0; j < N; j++) {
          const dr = palette[j*3]-r, dg = palette[j*3+1]-g, db = palette[j*3+2]-b;
          const d = dr*dr + dg*dg + db*db;
          if (d < bestD) { bestD = d; best = j; if (d === 0) break; }
        }
        sums[best*3]+=r; sums[best*3+1]+=g; sums[best*3+2]+=b; count[best]++;
      }
      for (let j = 0; j < N; j++) {
        if (count[j] > 0) {
          palette[j*3]   = Math.round(sums[j*3]   / count[j]);
          palette[j*3+1] = Math.round(sums[j*3+1] / count[j]);
          palette[j*3+2] = Math.round(sums[j*3+2] / count[j]);
        }
      }
    }
    return palette;
  }

  function mapFrame(pixels, palette, w, h, dither) {
    const N = palette.length / 3;
    const indices = new Uint8Array(w * h);

    function nearest(r, g, b) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < N; i++) {
        const dr = palette[i*3]-r, dg = palette[i*3+1]-g, db = palette[i*3+2]-b;
        const d = dr*dr + dg*dg + db*db;
        if (d < bestD) { bestD = d; best = i; if (d === 0) break; }
      }
      return best;
    }

    if (dither) {
      // Floyd-Steinberg on float copy
      const buf = new Float32Array(w * h * 3);
      for (let i = 0; i < w * h; i++) {
        buf[i*3]   = pixels[i*4];
        buf[i*3+1] = pixels[i*4+1];
        buf[i*3+2] = pixels[i*4+2];
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const r = Math.max(0, Math.min(255, buf[p*3]));
          const g = Math.max(0, Math.min(255, buf[p*3+1]));
          const b = Math.max(0, Math.min(255, buf[p*3+2]));
          const idx = nearest(r, g, b);
          indices[p] = idx;
          const er = r - palette[idx*3];
          const eg = g - palette[idx*3+1];
          const eb = b - palette[idx*3+2];
          if (x+1 < w)         { buf[(p+1)*3]  +=er*7/16; buf[(p+1)*3+1]  +=eg*7/16; buf[(p+1)*3+2]  +=eb*7/16; }
          if (y+1 < h) {
            if (x > 0)         { buf[(p+w-1)*3]+=er*3/16; buf[(p+w-1)*3+1]+=eg*3/16; buf[(p+w-1)*3+2]+=eb*3/16; }
                                  buf[(p+w)*3]  +=er*5/16; buf[(p+w)*3+1]  +=eg*5/16; buf[(p+w)*3+2]  +=eb*5/16;
            if (x+1 < w)       { buf[(p+w+1)*3]+=er/16;   buf[(p+w+1)*3+1]+=eg/16;   buf[(p+w+1)*3+2]+=eb/16; }
          }
        }
      }
    } else {
      for (let p = 0; p < w * h; p++) {
        indices[p] = nearest(pixels[p*4], pixels[p*4+1], pixels[p*4+2]);
      }
    }
    return indices;
  }

  // ══════════════════════════════════════════
  //  LZW ENCODER
  // ══════════════════════════════════════════
  function lzwEncode(indices) {
    const clear = 256, eof = 257;
    let nextCode = 258, codeBits = 9;
    let bitBuf = 0, bitLen = 0;
    const bytes = [];
    const table = new Map();

    function emit(code) {
      bitBuf |= (code << bitLen); bitLen += codeBits;
      while (bitLen >= 8) { bytes.push(bitBuf & 0xFF); bitBuf >>= 8; bitLen -= 8; }
      if (nextCode > (1 << codeBits) && codeBits < 12) codeBits++;
    }

    emit(clear);
    let prev = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const cur = indices[i];
      const key = prev * 4096 + cur;
      if (table.has(key)) {
        prev = table.get(key);
      } else {
        emit(prev);
        if (nextCode < 4096) {
          table.set(key, nextCode++);
        } else {
          emit(clear); table.clear(); nextCode = 258; codeBits = 9;
        }
        prev = cur;
      }
    }
    emit(prev);
    emit(eof);
    if (bitLen > 0) bytes.push(bitBuf & 0xFF);

    // Pack into sub-blocks
    const out = [8]; // min code size
    for (let i = 0; i < bytes.length;) {
      const len = Math.min(255, bytes.length - i);
      out.push(len);
      for (let j = 0; j < len; j++) out.push(bytes[i++]);
    }
    out.push(0);
    return new Uint8Array(out);
  }

  // ══════════════════════════════════════════
  //  GIF WRITER
  // ══════════════════════════════════════════
  function writeGIF(frames, palette, w, h, delayCentisec) {
    const parts = [];
    parts.push(new TextEncoder().encode('GIF89a'));
    // Logical screen — global palette of 256 colors
    const lsd = new Uint8Array(7);
    lsd[0]=w&0xFF; lsd[1]=(w>>8)&0xFF;
    lsd[2]=h&0xFF; lsd[3]=(h>>8)&0xFF;
    lsd[4]=0xF7; // global palette, 256 colors
    lsd[5]=0; lsd[6]=0;
    parts.push(lsd);
    parts.push(palette); // 768 bytes global palette

    // Netscape loop extension
    parts.push(new Uint8Array([0x21,0xFF,0x0B,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]));

    for (const indices of frames) {
      // Graphic control — delay
      parts.push(new Uint8Array([0x21,0xF9,0x04,0x00,delayCentisec&0xFF,(delayCentisec>>8)&0xFF,0,0]));
      // Image descriptor — use global palette
      const id = new Uint8Array(10);
      id[0]=0x2C;
      id[5]=w&0xFF; id[6]=(w>>8)&0xFF;
      id[7]=h&0xFF; id[8]=(h>>8)&0xFF;
      id[9]=0x00; // no local palette
      parts.push(id);
      parts.push(lzwEncode(indices));
    }
    parts.push(new Uint8Array([0x3B]));

    let total = 0;
    parts.forEach(p => total += p.length);
    const out = new Uint8Array(total);
    let off = 0;
    parts.forEach(p => { out.set(p, off); off += p.length; });
    return out;
  }

  // ══════════════════════════════════════════
  //  MAIN
  // ══════════════════════════════════════════
  async function startConvert() {
    if (!videoFile || isConverting) return;
    gifBlob = null;
    errorMsg.style.display    = 'none';
    resultWrap.style.display  = 'none';
    progressWrap.style.display = 'block';
    lockUI(); setPhase(0); setProgress(2, 'Preparing...');

    const gifW     = parseInt(selWidth.value, 10);
    const fps      = parseInt(selFps.value, 10);
    const startSec = parseFloat(selStart.value) || 0;
    const duration = Math.min(parseFloat(selDuration.value) || 5, 20);
    const quality  = parseInt(selQuality.value, 10);
    const dither   = selDither.value !== 'none';
    const vidW     = videoPreview.videoWidth  || 640;
    const vidH     = videoPreview.videoHeight || 360;
    const gifH     = Math.round(gifW * (vidH / vidW));
    const samplefac = quality; // 1=best quality (more samples), 20=fastest
    const delayCentisec = Math.max(2, Math.round(100 / fps));

    const canvas = document.createElement('canvas');
    canvas.width = gifW; canvas.height = gifH;
    const ctx = canvas.getContext('2d');

    try {
      // Phase 1 — Extract frames
      setPhase(1); setProgress(8, 'Extracting frames...');
      await new Promise(r => setTimeout(r, 50)); // let UI paint

      const rawFrames = await extractFrames(
        videoPreview, canvas, ctx, startSec, duration, fps, gifW, gifH
      );

      if (!isConverting) return;
      if (rawFrames.length === 0) throw new Error('No frames captured. Try a different video.');

      setProgress(46, `Got ${rawFrames.length} frames. Building palette...`);
      await new Promise(r => setTimeout(r, 0));

      // Phase 2 — Quantize
      setPhase(2);
      // Build palette from first frame (fast) or blended sample
      const palette = buildPalette(rawFrames[0], 256, samplefac);

      setProgress(50, 'Mapping colors...');
      const mappedFrames = [];
      for (let i = 0; i < rawFrames.length; i++) {
        if (!isConverting) return;
        mappedFrames.push(mapFrame(rawFrames[i], palette, gifW, gifH, dither));
        const pct = 50 + ((i + 1) / rawFrames.length) * 40;
        setProgress(pct, `Mapping frame ${i+1} / ${rawFrames.length}`);
        if (i % 3 === 2) await new Promise(r => setTimeout(r, 0));
      }

      if (!isConverting) return;

      // Phase 3 — Write GIF
      setPhase(3); setProgress(92, 'Writing GIF file...');
      await new Promise(r => setTimeout(r, 0));
      const gifBytes = writeGIF(mappedFrames, palette, gifW, gifH, delayCentisec);
      gifBlob = new Blob([gifBytes], { type: 'image/gif' });

      setProgress(100, 'Done!');
      await new Promise(r => setTimeout(r, 200));

      const url = URL.createObjectURL(gifBlob);
      resultImg.src            = url;
      resDimension.textContent = `${gifW}×${gifH}`;
      resFrames.textContent    = String(mappedFrames.length);
      resFps.textContent       = `${fps} fps`;
      resSize.textContent      = formatBytes(gifBlob.size);

      progressWrap.style.display = 'none';
      resultWrap.style.display   = 'block';

    } catch (err) {
      if (!isConverting || err.message === 'CANCELLED') {
        progressWrap.style.display = 'none'; setProgress(0, '');
      } else {
        console.error('[GIF]', err);
        showError(err.message || 'Conversion failed. Try shorter duration or smaller size.');
      }
    } finally {
      unlockUI(); setPhase(-1);
    }
  }

  function doCancel() {
    isConverting = false;
    videoPreview.onseeked = null;
    progressWrap.style.display = 'none';
    setProgress(0, ''); setPhase(-1); unlockUI();
  }

  function downloadGif() {
    if (!gifBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(gifBlob);
    a.download = 'gifonte_' + Date.now() + '.gif';
    a.click();
    if (typeof showToast === 'function') showToast('DOWNLOADING GIF');
  }

  function resetAll() {
    videoFile = gifBlob = null;
    [videoPreviewWrap, resultWrap, progressWrap, errorMsg].forEach(el => el.style.display = 'none');
    videoPreview.src = ''; fileInput.value = '';
    setProgress(0, ''); setPhase(-1); unlockUI(); btnConvert.disabled = true;
  }

  document.querySelectorAll('input[type="range"]').forEach(r => {
    const out = r.nextElementSibling;
    if (out && out.classList.contains('range-val'))
      r.addEventListener('input', () => { out.textContent = r.value + (r.dataset.unit || ''); });
  });

  document.addEventListener('DOMContentLoaded', () => {
    btnConvert.disabled = true;
    setPhase(-1);
  });

})();
