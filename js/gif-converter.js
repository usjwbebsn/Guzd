/* ══════════════════════════════════════════
   GIFONTE.COM — GIF CONVERTER v5.0
   
   FAST PATH:  WebCodecs API (Chrome 94+)
               Hardware-accelerated frame decode
               via VideoDecoder + mp4box.js demuxer
   
   SLOW PATH:  Canvas seek fallback
               Works everywhere, no dependencies
   
   Encoding:   Inline NeuQuant + LZW — no Workers,
               no CDN, no SharedArrayBuffer needed.
══════════════════════════════════════════ */
(function () {
  'use strict';

  const MP4BOX_CDN = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';

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

  // ── UI ───────────────────────────────────
  function setPhase(idx) {
    phases.forEach((p,i) => {
      p.classList.remove('active','done');
      if (i < idx) p.classList.add('done');
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
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(2) + ' MB';
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

  // ── File drop ─────────────────────────────
  dropZone.addEventListener('dragover', e => { if (!isConverting) { e.preventDefault(); dropZone.classList.add('drag-over'); } });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    if (isConverting) return;
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => { if (!isConverting && e.target.files[0]) handleFile(e.target.files[0]); });

  function handleFile(f) {
    if (!f.type.startsWith('video/')) { showError('Please select a video file.'); return; }
    videoFile = f;
    errorMsg.style.display = 'none';
    resultWrap.style.display = progressWrap.style.display = 'none';
    videoPreview.src = URL.createObjectURL(f);
    videoPreview.onloadedmetadata = () => {
      videoDuration.innerHTML = `<strong>${videoPreview.duration.toFixed(1)}s</strong>`;
      videoRes.innerHTML      = `<strong>${videoPreview.videoWidth}×${videoPreview.videoHeight}</strong>`;
      videoSize.innerHTML     = `<strong>${formatBytes(f.size)}</strong>`;
    };
    videoPreviewWrap.style.display = 'block';
    btnConvert.disabled = false;
  }

  btnConvert.addEventListener('click',  startConvert);
  btnCancel.addEventListener('click',   () => { isConverting = false; progressWrap.style.display='none'; setProgress(0,''); setPhase(-1); unlockUI(); });
  btnNew.addEventListener('click',      resetAll);
  btnDownload.addEventListener('click', downloadGif);

  // ══════════════════════════════════════════
  //  FAST PATH: WebCodecs + mp4box demuxer
  // ══════════════════════════════════════════
  function hasWebCodecs() {
    return typeof VideoDecoder !== 'undefined' && typeof VideoFrame !== 'undefined';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function extractFramesWebCodecs(file, startSec, duration, targetFps, gifW, gifH, onFrame, onProgress) {
    await loadScript(MP4BOX_CDN);
    const MP4Box = window.MP4Box;
    if (!MP4Box) throw new Error('mp4box not available');

    const frameInterval = 1 / targetFps; // seconds between wanted frames
    const endSec = startSec + duration;

    return new Promise(async (resolve, reject) => {
      const frames = [];
      let totalFrames = 0;
      let decodedCount = 0;
      let mp4boxFile = null;
      let decoder = null;
      let trackInfo = null;
      let nextWantedTime = startSec;
      let cancelled = false;

      const canvas = new OffscreenCanvas(gifW, gifH);
      const ctx    = canvas.getContext('2d');

      function cleanup() {
        try { if (decoder && decoder.state !== 'closed') decoder.close(); } catch(e) {}
        try { if (mp4boxFile) mp4boxFile.stop(); } catch(e) {}
      }

      decoder = new VideoDecoder({
        output: async (videoFrame) => {
          if (cancelled) { videoFrame.close(); return; }
          const ts = videoFrame.timestamp / 1e6; // microseconds → seconds
          if (ts >= startSec && ts <= endSec) {
            // Only keep frames at target fps intervals
            if (ts >= nextWantedTime - 0.001) {
              ctx.drawImage(videoFrame, 0, 0, gifW, gifH);
              const imgData = ctx.getImageData(0, 0, gifW, gifH);
              frames.push(imgData.data);
              nextWantedTime += frameInterval;
              decodedCount++;
              const pct = 5 + (Math.min(ts - startSec, duration) / duration) * 40;
              onProgress(pct, `Decoded frame ${decodedCount}`);
            }
          }
          videoFrame.close();
          if (ts > endSec) {
            cleanup();
            resolve(frames);
          }
        },
        error: (e) => { cleanup(); reject(new Error('VideoDecoder error: ' + e.message)); }
      });

      mp4boxFile = MP4Box.createFile();

      mp4boxFile.onReady = (info) => {
        trackInfo = info.videoTracks[0];
        if (!trackInfo) { reject(new Error('No video track found')); return; }

        const desc = getTrackDescription(mp4boxFile, trackInfo.id);
        decoder.configure({
          codec:            trackInfo.codec,
          codedWidth:       trackInfo.video.width,
          codedHeight:      trackInfo.video.height,
          description:      desc,
        });

        mp4boxFile.setExtractionOptions(trackInfo.id, null, { nbSamples: 1000 });
        mp4boxFile.start();
      };

      mp4boxFile.onSamples = (trackId, ref, samples) => {
        for (const sample of samples) {
          if (!isConverting) { cancelled = true; cleanup(); resolve(frames); return; }
          const ts = sample.cts / sample.timescale;
          if (ts > endSec + 1) { cleanup(); resolve(frames); return; }

          const chunk = new EncodedVideoChunk({
            type:      sample.is_sync ? 'key' : 'delta',
            timestamp: sample.cts * 1e6 / sample.timescale,
            duration:  sample.duration * 1e6 / sample.timescale,
            data:      sample.data,
          });
          decoder.decode(chunk);
        }
      };

      // Read file and feed to mp4box
      const fileBuffer = await file.arrayBuffer();
      const buf = fileBuffer.slice(0);
      buf.fileStart = 0;
      mp4boxFile.appendBuffer(buf);
      mp4boxFile.flush();

      // Timeout safety: flush decoder after a bit
      setTimeout(async () => {
        try {
          if (decoder.state !== 'closed') {
            await decoder.flush();
            cleanup();
            resolve(frames);
          }
        } catch(e) { resolve(frames); }
      }, Math.max(5000, duration * 1500));
    });
  }

  function getTrackDescription(mp4boxFile, trackId) {
    const track = mp4boxFile.getTrackById(trackId);
    for (const entry of track.mdia.minf.stbl.stsd.entries) {
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box) {
        const stream = new mp4box.DataStream(undefined, 0, mp4box.DataStream.BIG_ENDIAN);
        box.write(stream);
        return new Uint8Array(stream.buffer, 8);
      }
    }
    return undefined;
  }

  // ══════════════════════════════════════════
  //  SLOW PATH: Canvas seek (universal)
  // ══════════════════════════════════════════
  async function extractFramesCanvas(video, startSec, duration, targetFps, gifW, gifH, onProgress) {
    const frameCount = Math.round(duration * targetFps);
    const canvas = document.createElement('canvas');
    canvas.width = gifW; canvas.height = gifH;
    const ctx = canvas.getContext('2d');
    const frames = [];

    await new Promise((resolve, reject) => {
      let current = 0;
      function next() {
        if (!isConverting) { reject(new Error('CANCELLED')); return; }
        if (current >= frameCount) { resolve(); return; }
        video.currentTime = startSec + (current / targetFps);
      }
      video.onseeked = () => {
        if (!isConverting) { reject(new Error('CANCELLED')); return; }
        ctx.clearRect(0, 0, gifW, gifH);
        ctx.drawImage(video, 0, 0, gifW, gifH);
        frames.push(ctx.getImageData(0, 0, gifW, gifH).data);
        const pct = 5 + (current / frameCount) * 40;
        onProgress(pct, `Frame ${current+1} / ${frameCount}`);
        current++;
        requestAnimationFrame(next);
      };
      video.onerror = () => reject(new Error('Video seek error.'));
      video.pause();
      video.currentTime = startSec;
    });

    return frames;
  }

  // ══════════════════════════════════════════
  //  NeuQuant color quantizer
  // ══════════════════════════════════════════
  function quantize(pixels, samplefac) {
    const N = 256;
    samplefac = Math.max(1, Math.min(30, samplefac));
    // Simple median-cut approximation for speed, NeuQuant for quality
    // Using fast k-means variant
    const net = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { net[i*3]=net[i*3+1]=net[i*3+2] = (i * 255 / (N-1)); }

    const step = Math.max(1, Math.floor(pixels.length / 4 / (10000 / samplefac)));
    for (let iter = 0; iter < 3; iter++) {
      const sums  = new Float64Array(N * 3);
      const count = new Uint32Array(N);
      for (let p = 0; p < pixels.length >> 2; p += step) {
        const r = pixels[p*4], g = pixels[p*4+1], b = pixels[p*4+2];
        let best = 0, bestD = Infinity;
        for (let i = 0; i < N; i++) {
          const dr=net[i*3]-r, dg=net[i*3+1]-g, db=net[i*3+2]-b;
          const d = dr*dr+dg*dg+db*db;
          if (d < bestD) { bestD=d; best=i; }
        }
        sums[best*3]+=r; sums[best*3+1]+=g; sums[best*3+2]+=b; count[best]++;
      }
      for (let i = 0; i < N; i++) {
        if (count[i] > 0) { net[i*3]=sums[i*3]/count[i]; net[i*3+1]=sums[i*3+1]/count[i]; net[i*3+2]=sums[i*3+2]/count[i]; }
      }
    }

    const palette = new Uint8Array(N * 3);
    for (let i = 0; i < N; i++) { palette[i*3]=Math.round(net[i*3]); palette[i*3+1]=Math.round(net[i*3+1]); palette[i*3+2]=Math.round(net[i*3+2]); }

    function lookup(r,g,b) {
      let best=0, bestD=Infinity;
      for (let i=0;i<N;i++) { const dr=palette[i*3]-r,dg=palette[i*3+1]-g,db=palette[i*3+2]-b; const d=dr*dr+dg*dg+db*db; if(d<bestD){bestD=d;best=i;} }
      return best;
    }
    return { palette, lookup };
  }

  // ══════════════════════════════════════════
  //  LZW + GIF writer
  // ══════════════════════════════════════════
  function lzwEncode(indices) {
    const minCode = 8, clear = 256, eof = 257;
    let nextCode = 258, codeBits = 9;
    let bitBuf = 0, bitLen = 0;
    const bytes = [];
    const table = new Map();

    function emit(code) {
      bitBuf |= (code << bitLen); bitLen += codeBits;
      while (bitLen >= 8) { bytes.push(bitBuf & 0xFF); bitBuf >>= 8; bitLen -= 8; }
      if (nextCode >= (1 << codeBits) && codeBits < 12) codeBits++;
    }

    emit(clear);
    let str = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const key = str * 65536 + indices[i];
      if (table.has(key)) { str = table.get(key); }
      else {
        emit(str < 256 ? str : (table.get(str) || str));
        if (nextCode <= 4095) { table.set(key, nextCode++); }
        else { emit(clear); table.clear(); nextCode = 258; codeBits = 9; }
        str = indices[i];
      }
    }
    emit(str < 256 ? str : 0);
    emit(eof);
    if (bitLen > 0) bytes.push(bitBuf & 0xFF);

    const out = [minCode];
    for (let i = 0; i < bytes.length;) {
      const len = Math.min(255, bytes.length - i);
      out.push(len);
      for (let j = 0; j < len; j++) out.push(bytes[i++]);
    }
    out.push(0);
    return new Uint8Array(out);
  }

  function buildGIF(encodedFrames, w, h, delayCentisec) {
    const parts = [];
    parts.push(new TextEncoder().encode('GIF89a'));
    const lsd = new Uint8Array(7);
    lsd[0]=w&0xFF; lsd[1]=(w>>8)&0xFF; lsd[2]=h&0xFF; lsd[3]=(h>>8)&0xFF; lsd[4]=0x70;
    parts.push(lsd);

    for (const {palette, indices} of encodedFrames) {
      // GCE
      parts.push(new Uint8Array([0x21,0xF9,0x04,0x00,delayCentisec&0xFF,(delayCentisec>>8)&0xFF,0,0]));
      // Image descriptor with local color table (256 colors)
      const id = new Uint8Array(10);
      id[0]=0x2C; id[5]=w&0xFF; id[6]=(w>>8)&0xFF; id[7]=h&0xFF; id[8]=(h>>8)&0xFF; id[9]=0x87;
      parts.push(id);
      parts.push(palette);
      parts.push(lzwEncode(indices));
    }
    parts.push(new Uint8Array([0x3B]));

    let total = 0; parts.forEach(p => total += p.length);
    const out = new Uint8Array(total); let off = 0;
    parts.forEach(p => { out.set(p, off); off += p.length; });
    return out;
  }

  // ══════════════════════════════════════════
  //  MAIN CONVERT
  // ══════════════════════════════════════════
  async function startConvert() {
    if (!videoFile || isConverting) return;
    gifBlob = null;
    errorMsg.style.display = 'none';
    resultWrap.style.display = 'none';
    progressWrap.style.display = 'block';
    lockUI(); setPhase(0); setProgress(2, 'Starting...');

    const gifW     = parseInt(selWidth.value, 10);
    const fps      = parseInt(selFps.value, 10);
    const startSec = parseFloat(selStart.value) || 0;
    const duration = Math.min(parseFloat(selDuration.value) || 5, 20);
    const quality  = parseInt(selQuality.value, 10);
    const dither   = selDither.value !== 'none';
    const vidW     = videoPreview.videoWidth  || 640;
    const vidH     = videoPreview.videoHeight || 360;
    const gifH     = Math.round(gifW * (vidH / vidW));
    const samplefac= Math.round(1 + (quality-1) * 1.5);
    const delayCentisec = Math.round(100 / fps);

    try {
      // ── Phase 1: Extract frames ───────────
      setPhase(1);
      let rawFrames;
      const onProgress = (pct, msg) => { if (isConverting) setProgress(pct, msg); };

      if (hasWebCodecs() && videoFile.type === 'video/mp4') {
        setProgress(3, '⚡ WebCodecs — hardware decode...');
        try {
          rawFrames = await extractFramesWebCodecs(videoFile, startSec, duration, fps, gifW, gifH, null, onProgress);
        } catch(e) {
          console.warn('WebCodecs failed, falling back:', e.message);
          rawFrames = null;
        }
      }

      if (!rawFrames || rawFrames.length === 0) {
        setProgress(5, 'Extracting frames...');
        rawFrames = await extractFramesCanvas(videoPreview, startSec, duration, fps, gifW, gifH, onProgress);
      }

      if (!isConverting) return;
      if (rawFrames.length === 0) throw new Error('No frames extracted. Try different settings.');

      // ── Phase 2: Quantize + dither ────────
      setPhase(2);
      const encodedFrames = [];
      // Build global palette from first frame for speed
      const { palette: globalPalette, lookup } = quantize(rawFrames[0], samplefac);

      for (let i = 0; i < rawFrames.length; i++) {
        if (!isConverting) return;
        const px = rawFrames[i];
        const indices = new Uint8Array(gifW * gifH);

        if (dither) {
          const buf = new Float32Array(px.length);
          for (let j = 0; j < px.length; j++) buf[j] = px[j];
          for (let y = 0; y < gifH; y++) {
            for (let x = 0; x < gifW; x++) {
              const p = y * gifW + x;
              const r = Math.max(0,Math.min(255,buf[p*4]));
              const g = Math.max(0,Math.min(255,buf[p*4+1]));
              const b = Math.max(0,Math.min(255,buf[p*4+2]));
              const idx = lookup(r, g, b);
              indices[p] = idx;
              const er = r - globalPalette[idx*3];
              const eg = g - globalPalette[idx*3+1];
              const eb = b - globalPalette[idx*3+2];
              if (x+1 < gifW)             { buf[p*4+4]  +=er*7/16; buf[p*4+5]  +=eg*7/16; buf[p*4+6]  +=eb*7/16; }
              if (y+1 < gifH) {
                if (x > 0)                { buf[(p+gifW-1)*4]  +=er*3/16; buf[(p+gifW-1)*4+1]+=eg*3/16; buf[(p+gifW-1)*4+2]+=eb*3/16; }
                                            buf[(p+gifW)*4]    +=er*5/16; buf[(p+gifW)*4+1]  +=eg*5/16; buf[(p+gifW)*4+2]  +=eb*5/16;
                if (x+1 < gifW)           { buf[(p+gifW+1)*4] +=er*1/16; buf[(p+gifW+1)*4+1]+=eg*1/16; buf[(p+gifW+1)*4+2]+=eb*1/16; }
              }
            }
          }
        } else {
          for (let p = 0; p < gifW * gifH; p++) indices[p] = lookup(px[p*4], px[p*4+1], px[p*4+2]);
        }

        encodedFrames.push({ palette: globalPalette, indices });
        const pct = 47 + ((i+1) / rawFrames.length) * 45;
        setProgress(pct, `Encoding frame ${i+1} / ${rawFrames.length}`);
        if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
      }

      if (!isConverting) return;

      // ── Phase 3: Write GIF ────────────────
      setPhase(3); setProgress(94, 'Writing GIF...');
      await new Promise(r => setTimeout(r, 0));
      const gifBytes = buildGIF(encodedFrames, gifW, gifH, delayCentisec);
      gifBlob = new Blob([gifBytes], { type: 'image/gif' });

      setProgress(100, 'Done!');
      await new Promise(r => setTimeout(r, 250));

      const url = URL.createObjectURL(gifBlob);
      resultImg.src            = url;
      resDimension.textContent = `${gifW}×${gifH}`;
      resFrames.textContent    = String(encodedFrames.length);
      resFps.textContent       = `${fps} fps`;
      resSize.textContent      = formatBytes(gifBlob.size);

      progressWrap.style.display = 'none';
      resultWrap.style.display   = 'block';

    } catch(err) {
      if (!isConverting || err.message === 'CANCELLED') {
        progressWrap.style.display = 'none'; setProgress(0,'');
      } else {
        console.error('[GIF]', err);
        showError(err.message || 'Conversion failed. Try a shorter clip or lower resolution.');
      }
    } finally {
      unlockUI(); setPhase(-1);
    }
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
    videoPreviewWrap.style.display = resultWrap.style.display =
    progressWrap.style.display = errorMsg.style.display = 'none';
    videoPreview.src = ''; fileInput.value = '';
    setProgress(0,''); setPhase(-1); unlockUI(); btnConvert.disabled = true;
  }

  document.querySelectorAll('input[type="range"]').forEach(r => {
    const out = r.nextElementSibling;
    if (out && out.classList.contains('range-val'))
      r.addEventListener('input', () => { out.textContent = r.value + (r.dataset.unit||''); });
  });

  document.addEventListener('DOMContentLoaded', () => { btnConvert.disabled = true; setPhase(-1); });
})();
