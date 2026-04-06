/* ══════════════════════════════════════════
   GIFONTE.COM — COLOR PALETTE EXTRACTOR
   K-means clustering · WCAG contrast check
   Export: HEX, RGB, HSL, CSS vars,
   Tailwind, SCSS, JSON
   Zero dependencies. 100% inline.
══════════════════════════════════════════ */
(function () {
  'use strict';

  let extractedColors = [];
  let currentFile     = null;

  // ── DOM ──────────────────────────────────
  const dropZone      = document.getElementById('dropZone');
  const fileInput     = document.getElementById('fileInput');
  const previewWrap   = document.getElementById('previewWrap');
  const previewImg    = document.getElementById('previewImg');
  const previewName   = document.getElementById('previewName');
  const previewDims   = document.getElementById('previewDims');
  const previewSize   = document.getElementById('previewSize');
  const btnExtract    = document.getElementById('btnExtract');
  const btnReset      = document.getElementById('btnReset');
  const btnCopyAll    = document.getElementById('btnCopyAll');
  const selCount      = document.getElementById('selCount');
  const selMode       = document.getElementById('selMode');
  const paletteSection = document.getElementById('paletteSection');
  const colorStrip    = document.getElementById('colorStrip');
  const colorsGrid    = document.getElementById('colorsGrid');
  const exportPanel   = document.getElementById('exportPanel');
  const exportPre     = document.getElementById('exportPre');
  const exportCopyBtn = document.getElementById('exportCopyBtn');
  const paletteEmpty  = document.getElementById('paletteEmpty');
  const extractedCount = document.getElementById('extractedCount');

  // ── Helpers ──────────────────────────────
  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function toRGB(r, g, b) { return `rgb(${r}, ${g}, ${b})`; }

  function toHSL(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function contrastRatio(r1, g1, b1, r2, g2, b2) {
    const l1 = luminance(r1, g1, b1);
    const l2 = luminance(r2, g2, b2);
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function wcagBadges(r, g, b) {
    const onWhite = contrastRatio(r, g, b, 255, 255, 255);
    const onBlack = contrastRatio(r, g, b, 0, 0, 0);
    const best = Math.max(onWhite, onBlack);
    const badges = [];
    if (best >= 7)   badges.push({ label: 'AAA', pass: true });
    else             badges.push({ label: 'AAA', pass: false });
    if (best >= 4.5) badges.push({ label: 'AA',  pass: true });
    else             badges.push({ label: 'AA',  pass: false });
    if (best >= 3)   badges.push({ label: 'AA Large', pass: true });
    else             badges.push({ label: 'AA Large', pass: false });
    return badges;
  }

  function colorName(idx) {
    return `color-${String(idx + 1).padStart(2, '0')}`;
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  // ── File handling ─────────────────────────
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  function handleFile(f) {
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      showToast('Please select an image or video file.');
      return;
    }
    currentFile = f;
    const url = URL.createObjectURL(f);

    if (f.type.startsWith('video/')) {
      // Extract first frame from video
      const vid = document.createElement('video');
      vid.muted = true; vid.preload = 'metadata';
      vid.src = url;
      vid.onloadedmetadata = () => {
        vid.currentTime = Math.min(1, vid.duration * 0.1);
      };
      vid.onseeked = () => {
        const c = document.createElement('canvas');
        c.width = vid.videoWidth; c.height = vid.videoHeight;
        c.getContext('2d').drawImage(vid, 0, 0);
        previewImg.src = c.toDataURL('image/jpeg', 0.9);
        previewName.textContent = f.name;
        previewDims.innerHTML = `<strong>${vid.videoWidth}×${vid.videoHeight}</strong>`;
        previewSize.innerHTML = `<strong>${formatBytes(f.size)}</strong>`;
        previewWrap.style.display = 'block';
        btnExtract.disabled = false;
      };
    } else {
      previewImg.src = url;
      previewImg.onload = () => {
        previewName.textContent = f.name;
        previewDims.innerHTML = `<strong>${previewImg.naturalWidth}×${previewImg.naturalHeight}</strong>`;
        previewSize.innerHTML = `<strong>${formatBytes(f.size)}</strong>`;
        previewWrap.style.display = 'block';
        btnExtract.disabled = false;
      };
    }
  }

  // ══════════════════════════════════════════
  //  K-MEANS COLOR CLUSTERING
  // ══════════════════════════════════════════
  function kMeans(pixels, k, iterations) {
    iterations = iterations || 10;
    const n = pixels.length;
    if (n === 0) return [];

    // Init centroids from random pixels
    let centroids = [];
    const step = Math.max(1, Math.floor(n / k));
    for (let i = 0; i < k; i++) {
      const p = pixels[Math.min(i * step, n - 1)];
      centroids.push([p[0], p[1], p[2]]);
    }

    let assignments = new Int32Array(n);

    for (let iter = 0; iter < iterations; iter++) {
      // Assign
      for (let i = 0; i < n; i++) {
        const [r, g, b] = pixels[i];
        let best = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const [cr, cg, cb] = centroids[c];
          const d = (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
          if (d < bestD) { bestD = d; best = c; }
        }
        assignments[i] = best;
      }
      // Update centroids
      const sums  = Array.from({length: k}, () => [0,0,0]);
      const count = new Int32Array(k);
      for (let i = 0; i < n; i++) {
        const c = assignments[i];
        sums[c][0] += pixels[i][0];
        sums[c][1] += pixels[i][1];
        sums[c][2] += pixels[i][2];
        count[c]++;
      }
      centroids = sums.map((s, c) =>
        count[c] > 0 ? [Math.round(s[0]/count[c]), Math.round(s[1]/count[c]), Math.round(s[2]/count[c])] : centroids[c]
      );
    }

    // Count cluster sizes for sorting
    const sizes = new Int32Array(k);
    for (let i = 0; i < n; i++) sizes[assignments[i]]++;

    return centroids.map((c, i) => ({ r: c[0], g: c[1], b: c[2], count: sizes[i] }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  // ══════════════════════════════════════════
  //  EXTRACT
  // ══════════════════════════════════════════
  btnExtract.addEventListener('click', extractPalette);

  async function extractPalette() {
    const k    = parseInt(selCount.value, 10);
    const mode = selMode.value;

    btnExtract.disabled = true;
    btnExtract.textContent = 'EXTRACTING...';

    // Draw image to canvas and sample pixels
    const img = previewImg;
    const canvas = document.createElement('canvas');
    const maxDim = 200; // downsample for speed
    const scale  = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    canvas.width  = Math.round((img.naturalWidth  || img.width)  * scale);
    canvas.height = Math.round((img.naturalHeight || img.height) * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Sample pixels (skip transparent)
    const pixels = [];
    const sampleStep = mode === 'vibrant' ? 2 : mode === 'muted' ? 3 : 1;
    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      if (data[i+3] < 128) continue; // skip transparent
      const r = data[i], g = data[i+1], b = data[i+2];

      if (mode === 'vibrant') {
        // Only keep saturated colors
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        if (max - min < 40) continue;
      } else if (mode === 'muted') {
        // Only keep desaturated / neutral
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        if (max - min > 80) continue;
      }
      pixels.push([r, g, b]);
    }

    // Yield to browser
    await new Promise(r => setTimeout(r, 0));

    const clusters = kMeans(pixels, k, 12);
    extractedColors = clusters.slice(0, k);

    renderPalette();
    btnExtract.disabled = false;
    btnExtract.textContent = 'EXTRACT PALETTE';
  }

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════
  function renderPalette() {
    paletteSection.style.display = 'block';
    paletteEmpty.style.display   = extractedColors.length === 0 ? 'block' : 'none';
    extractedCount.textContent   = extractedColors.length + ' colors extracted';

    // Strip
    colorStrip.innerHTML = '';
    extractedColors.forEach((c, i) => {
      const hex = toHex(c.r, c.g, c.b);
      const div = document.createElement('div');
      div.className = 'color-strip__swatch';
      div.style.background = hex;
      div.title = hex;
      div.innerHTML = `<span class="color-strip__swatch-label">${hex}</span>`;
      div.addEventListener('click', () => { copyText(hex); showToast('Copied ' + hex); });
      colorStrip.appendChild(div);
    });

    // Cards
    colorsGrid.innerHTML = '';
    extractedColors.forEach((c, i) => {
      const hex = toHex(c.r, c.g, c.b);
      const rgb = toRGB(c.r, c.g, c.b);
      const hsl = toHSL(c.r, c.g, c.b);
      const badges = wcagBadges(c.r, c.g, c.b);
      const lum = luminance(c.r, c.g, c.b);
      const textCol = lum > 0.35 ? '#000' : '#fff';

      const card = document.createElement('div');
      card.className = 'color-card';
      card.innerHTML = `
        <div class="color-card__swatch" style="background:${hex}" data-copy="${hex}" title="Click to copy HEX"></div>
        <div class="color-card__info">
          <div class="color-card__rank">${String(i+1).padStart(2,'0')} · ${Math.round(c.count / extractedColors.reduce((a,x)=>a+x.count,0)*100)}%</div>
          <div class="color-card__values">
            <div class="color-card__val" data-copy="${hex}">
              <span>${hex}</span><span class="color-card__val-label">HEX</span>
            </div>
            <div class="color-card__val" data-copy="${rgb}">
              <span>${rgb}</span><span class="color-card__val-label">RGB</span>
            </div>
            <div class="color-card__val" data-copy="${hsl}">
              <span>${hsl}</span><span class="color-card__val-label">HSL</span>
            </div>
          </div>
          <div class="color-card__wcag">
            ${badges.map(b => `<span class="wcag-badge wcag-badge--${b.pass?'pass':'fail'}">${b.label}</span>`).join('')}
          </div>
        </div>
      `;

      // Click to copy
      card.querySelectorAll('[data-copy]').forEach(el => {
        el.addEventListener('click', () => {
          const val = el.dataset.copy;
          copyText(val);
          showToast('Copied ' + val);
        });
      });

      colorsGrid.appendChild(card);
    });

    // Show export panel
    exportPanel.classList.add('visible');
    renderExport(document.querySelector('.export-tab.active')?.dataset.format || 'css');
  }

  // ══════════════════════════════════════════
  //  EXPORT FORMATS
  // ══════════════════════════════════════════
  function renderExport(format) {
    const colors = extractedColors;
    let code = '';

    switch (format) {
      case 'css':
        code = `:root {\n${colors.map((c,i) => `  --${colorName(i)}: ${toHex(c.r,c.g,c.b)};`).join('\n')}\n}`;
        break;
      case 'hex':
        code = colors.map((c,i) => `${colorName(i)}: ${toHex(c.r,c.g,c.b)}`).join('\n');
        break;
      case 'rgb':
        code = colors.map((c,i) => `${colorName(i)}: ${toRGB(c.r,c.g,c.b)}`).join('\n');
        break;
      case 'hsl':
        code = colors.map((c,i) => `${colorName(i)}: ${toHSL(c.r,c.g,c.b)}`).join('\n');
        break;
      case 'tailwind':
        code = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${colors.map((c,i) => `        '${colorName(i)}': '${toHex(c.r,c.g,c.b)}',`).join('\n')}\n      },\n    },\n  },\n};`;
        break;
      case 'scss':
        code = colors.map((c,i) => `$${colorName(i)}: ${toHex(c.r,c.g,c.b)};`).join('\n')
          + `\n\n$palette: (\n${colors.map((c,i) => `  '${colorName(i)}': $${colorName(i)},`).join('\n')}\n);`;
        break;
      case 'json':
        const obj = {};
        colors.forEach((c,i) => {
          obj[colorName(i)] = { hex: toHex(c.r,c.g,c.b), rgb: toRGB(c.r,c.g,c.b), hsl: toHSL(c.r,c.g,c.b) };
        });
        code = JSON.stringify(obj, null, 2);
        break;
    }

    exportPre.textContent = code;
  }

  // Export tabs
  document.querySelectorAll('.export-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.export-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderExport(tab.dataset.format);
    });
  });

  // Export copy
  exportCopyBtn.addEventListener('click', () => {
    copyText(exportPre.textContent);
    showToast('CODE COPIED');
  });

  // Copy all HEX
  btnCopyAll.addEventListener('click', () => {
    const hexList = extractedColors.map(c => toHex(c.r, c.g, c.b)).join(', ');
    copyText(hexList);
    showToast('ALL COLORS COPIED');
  });

  // Reset
  btnReset.addEventListener('click', () => {
    currentFile = null;
    extractedColors = [];
    previewWrap.style.display = 'none';
    paletteSection.style.display = 'none';
    exportPanel.classList.remove('visible');
    previewImg.src = '';
    fileInput.value = '';
    btnExtract.disabled = true;
  });

  document.addEventListener('DOMContentLoaded', () => {
    btnExtract.disabled = true;
    paletteSection.style.display = 'none';
  });

})();
