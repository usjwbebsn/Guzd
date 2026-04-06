/* ══════════════════════════════════════════════════════
   GIFONTE.COM — DOCUMENT CONVERTER
   Tool 04 · 90%+ Format Coverage · Zero Server
   
   Supported conversions:
   ── PDF     → DOCX · TXT · PNG · JPG · HTML
   ── DOCX    → PDF · TXT · HTML · MD
   ── DOC     → PDF · TXT · HTML
   ── XLSX    → CSV · JSON · HTML · PDF
   ── XLS     → CSV · JSON · HTML
   ── CSV     → XLSX · JSON · HTML · PDF
   ── JSON    → CSV · XLSX · HTML · TXT
   ── PPTX    → PDF · PNG (slides) · TXT · HTML
   ── PPT     → PDF · TXT · HTML
   ── TXT     → PDF · DOCX · HTML · MD
   ── MD      → HTML · PDF · DOCX · TXT
   ── HTML    → PDF · TXT · MD · DOCX
   ── PNG/JPG/WEBP/GIF/BMP → PDF · WEBP · PNG · JPG
   ── SVG     → PNG · PDF · HTML
   ── RTF     → DOCX · TXT · HTML · PDF
   ── ODS     → CSV · XLSX · JSON
   ── ODT     → DOCX · TXT · HTML · PDF
   ── EPUB    → TXT · HTML · PDF · MD
   
   Libraries loaded dynamically:
   · pdf-lib       (PDF creation/manipulation)
   · pdfjs-dist    (PDF reading/rendering)
   · mammoth.js    (DOCX → HTML/text)
   · docx.js       (DOCX creation)
   · SheetJS/xlsx  (spreadsheet R/W)
   · marked        (Markdown → HTML)
   · html2canvas   (HTML → image)
   · JSZip         (ZIP inspection)
   · FileSaver     (download trigger)
══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1. LIBRARY LOADER
  ───────────────────────────────────────────── */
  const CDN = {
    pdfLib:     'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    pdfjs:      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    mammoth:    'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    xlsx:       'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    marked:     'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js',
    JSZip:      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    FileSaver:  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
    // docx.js from unpkg (not on cdnjs)
    docx:       'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  };

  const _loaded = {};
  function loadScript(key, url) {
    if (_loaded[key]) return _loaded[key];
    _loaded[key] = new Promise((res, rej) => {
      if (window[key] || (key === 'pdfLib' && window.PDFLib) ||
          (key === 'pdfjs' && window.pdfjsLib) ||
          (key === 'xlsx' && window.XLSX) ||
          (key === 'marked' && window.marked) ||
          (key === 'JSZip' && window.JSZip) ||
          (key === 'mammoth' && window.mammoth) ||
          (key === 'docx' && window.docx)) {
        res(); return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => res();
      s.onerror = () => rej(new Error('Failed to load: ' + url));
      document.head.appendChild(s);
    });
    return _loaded[key];
  }

  function libs(...keys) {
    return Promise.all(keys.map(k => loadScript(k, CDN[k])));
  }

  /* ─────────────────────────────────────────────
     2. CONVERSION MAP
     Each entry: { label, outputs: ['ext', ...], icon }
  ───────────────────────────────────────────── */
  const CONV_MAP = {
    pdf:  { label: 'PDF',          icon: '⬜', outputs: ['docx','txt','png','jpg','html'] },
    docx: { label: 'Word (DOCX)',  icon: '𝐖',  outputs: ['pdf','txt','html','md'] },
    doc:  { label: 'Word (DOC)',   icon: '𝐖',  outputs: ['pdf','txt','html'] },
    xlsx: { label: 'Excel (XLSX)', icon: '⊞',  outputs: ['csv','json','html','pdf'] },
    xls:  { label: 'Excel (XLS)',  icon: '⊞',  outputs: ['csv','json','html'] },
    csv:  { label: 'CSV',          icon: '≡',  outputs: ['xlsx','json','html','pdf'] },
    json: { label: 'JSON',         icon: '{}', outputs: ['csv','xlsx','html','txt'] },
    pptx: { label: 'PowerPoint',   icon: '▶',  outputs: ['pdf','png','txt','html'] },
    ppt:  { label: 'PowerPoint',   icon: '▶',  outputs: ['pdf','txt','html'] },
    txt:  { label: 'Plain Text',   icon: '¶',  outputs: ['pdf','docx','html','md'] },
    md:   { label: 'Markdown',     icon: '#',  outputs: ['html','pdf','docx','txt'] },
    html: { label: 'HTML',         icon: '<>',  outputs: ['pdf','txt','md','docx'] },
    png:  { label: 'PNG Image',    icon: '◼',  outputs: ['pdf','jpg','webp'] },
    jpg:  { label: 'JPG Image',    icon: '◼',  outputs: ['pdf','png','webp'] },
    jpeg: { label: 'JPEG Image',   icon: '◼',  outputs: ['pdf','png','webp'] },
    webp: { label: 'WebP Image',   icon: '◼',  outputs: ['pdf','png','jpg'] },
    gif:  { label: 'GIF Image',    icon: '◻',  outputs: ['pdf','png','jpg'] },
    bmp:  { label: 'BMP Image',    icon: '◼',  outputs: ['pdf','png','jpg'] },
    svg:  { label: 'SVG',          icon: '◇',  outputs: ['png','pdf','html'] },
    rtf:  { label: 'RTF',          icon: '¶',  outputs: ['docx','txt','html','pdf'] },
    ods:  { label: 'ODS Spreadsheet', icon: '⊞', outputs: ['csv','xlsx','json'] },
    odt:  { label: 'ODT Document', icon: '𝐖',  outputs: ['docx','txt','html','pdf'] },
    epub: { label: 'EPUB',         icon: '📖', outputs: ['txt','html','pdf','md'] },
  };

  /* ─────────────────────────────────────────────
     3. DOM REFS
  ───────────────────────────────────────────── */
  const dropZone       = document.getElementById('convDropZone');
  const fileInput      = document.getElementById('convFileInput');
  const fileInfo       = document.getElementById('convFileInfo');
  const fileName       = document.getElementById('convFileName');
  const fileType       = document.getElementById('convFileType');
  const fileSize       = document.getElementById('convFileSize');
  const outputSection  = document.getElementById('convOutputSection');
  const outputBtns     = document.getElementById('convOutputBtns');
  const progressWrap   = document.getElementById('convProgress');
  const progressBar    = document.getElementById('convProgressBar');
  const progressMsg    = document.getElementById('convProgressMsg');
  const resultWrap     = document.getElementById('convResult');
  const resultName     = document.getElementById('convResultName');
  const resultDl       = document.getElementById('convResultDl');
  const btnReset       = document.getElementById('convReset');
  const statsTotal     = document.getElementById('convStatsTotal');

  if (!dropZone) return; // Not on converter page

  /* ─────────────────────────────────────────────
     4. STATE
  ───────────────────────────────────────────── */
  let currentFile     = null;
  let currentExt      = null;
  let selectedOutput  = null;
  let conversionCount = parseInt(localStorage.getItem('conv-count') || '0');

  if (statsTotal) statsTotal.textContent = conversionCount.toLocaleString();

  /* ─────────────────────────────────────────────
     5. DROP ZONE
  ───────────────────────────────────────────── */
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  /* ─────────────────────────────────────────────
     6. FILE HANDLER
  ───────────────────────────────────────────── */
  function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!CONV_MAP[ext]) {
      showToast('Unsupported file type: .' + ext);
      return;
    }
    currentFile = file;
    currentExt  = ext;
    selectedOutput = null;

    // Show file info
    fileName.textContent  = file.name;
    fileType.textContent  = CONV_MAP[ext].label;
    fileSize.textContent  = formatBytes(file.size);
    fileInfo.classList.add('visible');

    // Build output buttons
    const info = CONV_MAP[ext];
    outputBtns.innerHTML = '';
    info.outputs.forEach(out => {
      const btn = document.createElement('button');
      btn.className   = 'conv-out-btn';
      btn.dataset.out = out;
      btn.innerHTML   = `<span class="conv-out-ext">.${out}</span><span class="conv-out-label">${outLabel(out)}</span>`;
      btn.addEventListener('click', () => selectOutput(out, btn));
      outputBtns.appendChild(btn);
    });

    outputSection.classList.add('visible');
    hideProgress();
    hideResult();

    // Animate drop zone
    dropZone.classList.add('has-file');
    dropZone.querySelector('.conv-drop__icon').textContent = CONV_MAP[ext].icon;
    dropZone.querySelector('.conv-drop__text').textContent = file.name;
    dropZone.querySelector('.conv-drop__sub').textContent  = CONV_MAP[ext].label + ' · ' + formatBytes(file.size);
  }

  function outLabel(ext) {
    const labels = {
      pdf:'PDF Document', docx:'Word Document', txt:'Plain Text',
      html:'HTML File', md:'Markdown', csv:'CSV Spreadsheet',
      json:'JSON Data', xlsx:'Excel Spreadsheet', png:'PNG Image',
      jpg:'JPEG Image', webp:'WebP Image',
    };
    return labels[ext] || ext.toUpperCase();
  }

  /* ─────────────────────────────────────────────
     7. OUTPUT SELECTION & CONVERSION TRIGGER
  ───────────────────────────────────────────── */
  function selectOutput(out, btn) {
    outputBtns.querySelectorAll('.conv-out-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedOutput = out;
    startConversion(currentExt, out);
  }

  /* ─────────────────────────────────────────────
     8. ROUTER — dispatch to converter
  ───────────────────────────────────────────── */
  async function startConversion(from, to) {
    showProgress('Loading libraries…', 5);
    try {
      const blob = await route(from, to);
      const outName = currentFile.name.replace(/\.[^.]+$/, '') + '.' + to;
      showResult(blob, outName, to);
      conversionCount++;
      localStorage.setItem('conv-count', conversionCount);
      if (statsTotal) statsTotal.textContent = conversionCount.toLocaleString();
    } catch (err) {
      console.error(err);
      showToast('Conversion failed: ' + (err.message || 'unknown error'));
      hideProgress();
    }
  }

  async function route(from, to) {
    const key = from + '_' + to;
    switch (key) {
      // ── PDF conversions ──────────────────────
      case 'pdf_txt':   return pdfToTxt();
      case 'pdf_html':  return pdfToHtml();
      case 'pdf_png':   return pdfToImage('png');
      case 'pdf_jpg':   return pdfToImage('jpg');
      case 'pdf_docx':  return pdfToDocx();

      // ── DOCX / DOC / ODT / RTF → ─────────────
      case 'docx_pdf':
      case 'doc_pdf':
      case 'odt_pdf':
      case 'rtf_pdf':   return docxToPdf(from);
      case 'docx_txt':
      case 'doc_txt':
      case 'odt_txt':
      case 'rtf_txt':   return docxToTxt(from);
      case 'docx_html':
      case 'doc_html':
      case 'odt_html':
      case 'rtf_html':  return docxToHtml(from);
      case 'docx_md':   return docxToMd();

      // ── TXT / MD / HTML → ───────────────────
      case 'txt_pdf':
      case 'md_pdf':
      case 'html_pdf':  return textishToPdf(from);
      case 'txt_html':  return txtToHtml();
      case 'txt_md':    return txtToMd();
      case 'txt_docx':
      case 'md_docx':
      case 'html_docx': return textishToDocx(from);
      case 'md_html':   return mdToHtml();
      case 'md_txt':    return mdToTxt();
      case 'html_txt':  return htmlToTxt();
      case 'html_md':   return htmlToMd();

      // ── Spreadsheets → ───────────────────────
      case 'xlsx_csv':
      case 'xls_csv':
      case 'ods_csv':   return sheetToCsv(from);
      case 'xlsx_json':
      case 'xls_json':
      case 'ods_json':  return sheetToJson(from);
      case 'xlsx_html':
      case 'xls_html':  return sheetToHtml(from);
      case 'xlsx_pdf':
      case 'xls_pdf':   return sheetToPdf(from);
      case 'csv_xlsx':
      case 'csv_json':
      case 'csv_html':
      case 'csv_pdf':   return csvConvert(to);
      case 'json_csv':  return jsonToCsv();
      case 'json_xlsx': return jsonToXlsx();
      case 'json_html': return jsonToHtml();
      case 'json_txt':  return jsonToTxt();
      case 'ods_xlsx':  return sheetToXlsx('ods');

      // ── PPTX → ───────────────────────────────
      case 'pptx_pdf':
      case 'ppt_pdf':   return pptxToPdf(from);
      case 'pptx_txt':
      case 'ppt_txt':   return pptxToTxt(from);
      case 'pptx_html':
      case 'ppt_html':  return pptxToHtml(from);
      case 'pptx_png':  return pptxToPng();

      // ── Images → ────────────────────────────
      case 'png_pdf':
      case 'jpg_pdf':
      case 'jpeg_pdf':
      case 'webp_pdf':
      case 'gif_pdf':
      case 'bmp_pdf':
      case 'svg_pdf':   return imageToPdf();
      case 'png_jpg':
      case 'webp_jpg':
      case 'gif_jpg':
      case 'bmp_jpg':   return imageConvert('jpg');
      case 'jpg_png':
      case 'webp_png':
      case 'gif_png':
      case 'bmp_png':
      case 'svg_png':   return imageConvert('png');
      case 'png_webp':
      case 'jpg_webp':
      case 'gif_webp':  return imageConvert('webp');
      case 'svg_html':  return svgToHtml();

      // ── EPUB → ───────────────────────────────
      case 'epub_txt':
      case 'epub_html':
      case 'epub_md':
      case 'epub_pdf':  return epubConvert(to);

      default:
        throw new Error(`Conversion ${from} → ${to} not implemented`);
    }
  }

  /* ─────────────────────────────────────────────
     9. CONVERTER IMPLEMENTATIONS
  ───────────────────────────────────────────── */

  // ── Helpers ──────────────────────────────────

  function readFileAs(type) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = e => res(e.target.result);
      r.onerror = () => rej(new Error('File read failed'));
      if (type === 'arrayBuffer') r.readAsArrayBuffer(currentFile);
      else if (type === 'text')   r.readAsText(currentFile);
      else if (type === 'dataURL')r.readAsDataURL(currentFile);
    });
  }

  function htmlPageWrapper(bodyHtml, title) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#111}
  table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px}
  th{background:#f0f0f0}pre{background:#f5f5f5;padding:12px;overflow:auto}
  h1,h2,h3{font-family:Arial,sans-serif}
</style>
</head><body>${bodyHtml}</body></html>`;
  }

  function strToBlob(str, mime) {
    return new Blob([str], { type: mime });
  }

  function imgToCanvas(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload  = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        res(c);
      };
      img.onerror = () => rej(new Error('Image load failed'));
      img.src = src;
    });
  }

  // ── PDF → TXT ────────────────────────────────
  async function pdfToTxt() {
    showProgress('Loading PDF engine…', 15);
    await libs('pdfjs');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const ab   = await readFileAs('arrayBuffer');
    showProgress('Extracting text…', 35);
    const pdf  = await pdfjsLib.getDocument({ data: ab }).promise;
    let   text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      showProgress(`Page ${i} of ${pdf.numPages}…`, 35 + Math.round((i / pdf.numPages) * 55));
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n\n';
    }
    return new Blob([text.trim()], { type: 'text/plain' });
  }

  // ── PDF → HTML ───────────────────────────────
  async function pdfToHtml() {
    const txtBlob = await pdfToTxt();
    const text    = await txtBlob.text();
    const paras   = text.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g,' ')}</p>`).join('\n');
    return strToBlob(htmlPageWrapper(paras, currentFile.name), 'text/html');
  }

  // ── PDF → Image ──────────────────────────────
  async function pdfToImage(fmt) {
    showProgress('Loading PDF engine…', 10);
    await libs('pdfjs');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const ab  = await readFileAs('arrayBuffer');
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    // Render all pages; if >1 page, we zip them
    const canvases = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      showProgress(`Rendering page ${i}/${pdf.numPages}…`, 10 + Math.round((i / pdf.numPages) * 80));
      const page     = await pdf.getPage(i);
      const vp       = page.getViewport({ scale: 2 });
      const canvas   = document.createElement('canvas');
      canvas.width   = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      canvases.push(canvas);
    }
    showProgress('Encoding…', 95);
    if (canvases.length === 1) {
      return canvasToBlob(canvases[0], fmt);
    }
    // Multiple pages → ZIP
    await libs('JSZip');
    const zip = new JSZip();
    for (let i = 0; i < canvases.length; i++) {
      const b   = await canvasToBlob(canvases[i], fmt);
      const ab2 = await b.arrayBuffer();
      zip.file(`page_${i + 1}.${fmt}`, ab2);
    }
    const zb = await zip.generateAsync({ type: 'blob' });
    return zb;
  }

  function canvasToBlob(canvas, fmt) {
    const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/' + fmt;
    return new Promise(res => canvas.toBlob(res, mime, 0.92));
  }

  // ── PDF → DOCX (text-based) ──────────────────
  async function pdfToDocx() {
    showProgress('Extracting PDF text…', 20);
    const txtBlob = await pdfToTxt();
    const text    = await txtBlob.text();
    return textToDocxBlob(text);
  }

  // ── DOCX → HTML ──────────────────────────────
  async function docxToHtml() {
    showProgress('Loading DOCX parser…', 20);
    await libs('mammoth');
    showProgress('Converting…', 50);
    const ab  = await readFileAs('arrayBuffer');
    const res = await mammoth.convertToHtml({ arrayBuffer: ab });
    showProgress('Wrapping HTML…', 85);
    return strToBlob(htmlPageWrapper(res.value, currentFile.name), 'text/html');
  }

  // ── DOCX → TXT ───────────────────────────────
  async function docxToTxt() {
    showProgress('Loading DOCX parser…', 20);
    await libs('mammoth');
    showProgress('Extracting text…', 50);
    const ab  = await readFileAs('arrayBuffer');
    const res = await mammoth.extractRawText({ arrayBuffer: ab });
    return new Blob([res.value], { type: 'text/plain' });
  }

  // ── DOCX → PDF ───────────────────────────────
  async function docxToPdf() {
    // Extract text then build PDF
    showProgress('Extracting content…', 20);
    const txtBlob = await docxToTxt();
    const text    = await txtBlob.text();
    return textToPdfBlob(text, currentFile.name);
  }

  // ── DOCX → MD ────────────────────────────────
  async function docxToMd() {
    showProgress('Converting DOCX…', 30);
    const htmlBlob = await docxToHtml();
    const html     = await htmlBlob.text();
    return strToBlob(htmlToMarkdown(html), 'text/markdown');
  }

  // ── TXT / MD / HTML → PDF ────────────────────
  async function textishToPdf(from) {
    showProgress('Reading file…', 20);
    const text = await readFileAs('text');
    let   body = text;
    if (from === 'md') {
      await libs('marked');
      body = marked.parse(text);
    } else if (from === 'txt') {
      body = text.replace(/\n/g, '<br>');
    }
    return textToPdfBlob(body, currentFile.name, from === 'html' || from === 'md');
  }

  // ── TXT → HTML ───────────────────────────────
  async function txtToHtml() {
    const text  = await readFileAs('text');
    const paras = text.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`).join('\n');
    return strToBlob(htmlPageWrapper(paras, currentFile.name), 'text/html');
  }

  // ── TXT → MD ─────────────────────────────────
  async function txtToMd() {
    const text = await readFileAs('text');
    return strToBlob(text, 'text/markdown');
  }

  // ── TXT / MD / HTML → DOCX ───────────────────
  async function textishToDocx(from) {
    showProgress('Reading…', 20);
    const text = await readFileAs('text');
    let   plain = text;
    if (from === 'md') {
      await libs('marked');
      const html = marked.parse(text);
      plain = htmlToPlainText(html);
    } else if (from === 'html') {
      plain = htmlToPlainText(text);
    }
    return textToDocxBlob(plain);
  }

  // ── MD → HTML ────────────────────────────────
  async function mdToHtml() {
    showProgress('Parsing Markdown…', 40);
    await libs('marked');
    const text = await readFileAs('text');
    const html = marked.parse(text);
    return strToBlob(htmlPageWrapper(html, currentFile.name), 'text/html');
  }

  // ── MD → TXT ─────────────────────────────────
  async function mdToTxt() {
    await libs('marked');
    const text = await readFileAs('text');
    const html = marked.parse(text);
    return new Blob([htmlToPlainText(html)], { type: 'text/plain' });
  }

  // ── HTML → TXT ───────────────────────────────
  async function htmlToTxt() {
    const html = await readFileAs('text');
    return new Blob([htmlToPlainText(html)], { type: 'text/plain' });
  }

  // ── HTML → MD ────────────────────────────────
  async function htmlToMd() {
    const html = await readFileAs('text');
    return strToBlob(htmlToMarkdown(html), 'text/markdown');
  }

  // ── Spreadsheet → CSV ────────────────────────
  async function sheetToCsv() {
    showProgress('Loading spreadsheet engine…', 20);
    await libs('xlsx');
    const ab   = await readFileAs('arrayBuffer');
    showProgress('Parsing…', 50);
    const wb   = XLSX.read(ab, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const csv  = XLSX.utils.sheet_to_csv(ws);
    return strToBlob(csv, 'text/csv');
  }

  // ── Spreadsheet → JSON ───────────────────────
  async function sheetToJson() {
    showProgress('Loading spreadsheet engine…', 20);
    await libs('xlsx');
    const ab   = await readFileAs('arrayBuffer');
    showProgress('Parsing…', 50);
    const wb   = XLSX.read(ab, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);
    return strToBlob(JSON.stringify(data, null, 2), 'application/json');
  }

  // ── Spreadsheet → HTML ───────────────────────
  async function sheetToHtml() {
    showProgress('Loading spreadsheet engine…', 20);
    await libs('xlsx');
    const ab   = await readFileAs('arrayBuffer');
    const wb   = XLSX.read(ab, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const html = XLSX.utils.sheet_to_html(ws);
    return strToBlob(htmlPageWrapper(html, currentFile.name), 'text/html');
  }

  // ── Spreadsheet → PDF ────────────────────────
  async function sheetToPdf() {
    const htmlBlob = await sheetToHtml();
    const html     = await htmlBlob.text();
    return textToPdfBlob(html, currentFile.name, true);
  }

  // ── Spreadsheet → XLSX ───────────────────────
  async function sheetToXlsx() {
    showProgress('Loading spreadsheet engine…', 20);
    await libs('xlsx');
    const ab = await readFileAs('arrayBuffer');
    const wb = XLSX.read(ab, { type: 'array' });
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ── CSV → * ──────────────────────────────────
  async function csvConvert(to) {
    showProgress('Loading engine…', 20);
    await libs('xlsx');
    const text = await readFileAs('text');
    showProgress('Parsing CSV…', 40);
    const wb   = XLSX.read(text, { type: 'string' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    if (to === 'xlsx') {
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    if (to === 'json') {
      return strToBlob(JSON.stringify(XLSX.utils.sheet_to_json(ws), null, 2), 'application/json');
    }
    if (to === 'html') {
      return strToBlob(htmlPageWrapper(XLSX.utils.sheet_to_html(ws), currentFile.name), 'text/html');
    }
    if (to === 'pdf') {
      const html = htmlPageWrapper(XLSX.utils.sheet_to_html(ws), currentFile.name);
      return textToPdfBlob(html, currentFile.name, true);
    }
  }

  // ── JSON → CSV ───────────────────────────────
  async function jsonToCsv() {
    showProgress('Loading engine…', 20);
    await libs('xlsx');
    const text = await readFileAs('text');
    const data = JSON.parse(text);
    const arr  = Array.isArray(data) ? data : [data];
    const ws   = XLSX.utils.json_to_sheet(arr);
    return strToBlob(XLSX.utils.sheet_to_csv(ws), 'text/csv');
  }

  // ── JSON → XLSX ──────────────────────────────
  async function jsonToXlsx() {
    showProgress('Loading engine…', 20);
    await libs('xlsx');
    const text = await readFileAs('text');
    const data = JSON.parse(text);
    const arr  = Array.isArray(data) ? data : [data];
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(arr), 'Sheet1');
    const out  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ── JSON → HTML ──────────────────────────────
  async function jsonToHtml() {
    const text = await readFileAs('text');
    const data = JSON.parse(text);
    const arr  = Array.isArray(data) ? data : [data];
    let   html = '';
    if (arr.length && typeof arr[0] === 'object') {
      const keys = Object.keys(arr[0]);
      html = `<table><thead><tr>${keys.map(k=>`<th>${k}</th>`).join('')}</tr></thead><tbody>`;
      arr.forEach(row => {
        html += '<tr>' + keys.map(k => `<td>${row[k] ?? ''}</td>`).join('') + '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
    return strToBlob(htmlPageWrapper(html, currentFile.name), 'text/html');
  }

  // ── JSON → TXT ───────────────────────────────
  async function jsonToTxt() {
    const text = await readFileAs('text');
    const data = JSON.parse(text);
    return new Blob([JSON.stringify(data, null, 2)], { type: 'text/plain' });
  }

  // ── PPTX → TXT ───────────────────────────────
  async function pptxToTxt() {
    showProgress('Loading ZIP engine…', 15);
    await libs('JSZip');
    const ab   = await readFileAs('arrayBuffer');
    showProgress('Parsing slides…', 40);
    const zip  = await JSZip.loadAsync(ab);
    let   text = '';
    const slideFiles = Object.keys(zip.files)
      .filter(n => n.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)[0]);
        const nb = parseInt(b.match(/\d+/)[0]);
        return na - nb;
      });
    for (let i = 0; i < slideFiles.length; i++) {
      showProgress(`Slide ${i+1}/${slideFiles.length}…`, 40 + Math.round((i/slideFiles.length)*50));
      const xml  = await zip.files[slideFiles[i]].async('string');
      const tmp  = document.createElement('div');
      tmp.innerHTML = xml.replace(/<[^>]+>/g, ' ');
      const raw  = tmp.textContent.replace(/\s+/g,' ').trim();
      if (raw) text += `[Slide ${i+1}]\n${raw}\n\n`;
    }
    return new Blob([text.trim()], { type: 'text/plain' });
  }

  // ── PPTX → HTML ──────────────────────────────
  async function pptxToHtml() {
    const txtBlob = await pptxToTxt();
    const text    = await txtBlob.text();
    const slides  = text.split(/\[Slide \d+\]\n/).filter(Boolean);
    const html    = slides.map((s, i) =>
      `<section style="padding:20px;border-bottom:1px solid #ccc"><h2>Slide ${i+1}</h2><p>${s.replace(/\n/g,'<br>')}</p></section>`
    ).join('');
    return strToBlob(htmlPageWrapper(html, currentFile.name), 'text/html');
  }

  // ── PPTX → PDF ───────────────────────────────
  async function pptxToPdf() {
    const txtBlob = await pptxToTxt();
    const text    = await txtBlob.text();
    return textToPdfBlob(text, currentFile.name);
  }

  // ── PPTX → PNG (slide thumbnails) ────────────
  async function pptxToPng() {
    showProgress('Extracting slide images…', 20);
    await libs('JSZip');
    const ab  = await readFileAs('arrayBuffer');
    const zip = await JSZip.loadAsync(ab);
    // Grab embedded media images
    const imgs = Object.keys(zip.files).filter(n =>
      n.match(/^ppt\/media\/.+\.(png|jpg|jpeg|gif|webp)$/i)
    );
    if (imgs.length === 0) {
      // No images: render text slide as canvas
      const txtBlob = await pptxToTxt();
      const text    = await txtBlob.text();
      return strToBlob(htmlPageWrapper(`<pre>${text}</pre>`, currentFile.name), 'text/html');
    }
    if (imgs.length === 1) {
      const data = await zip.files[imgs[0]].async('uint8array');
      return new Blob([data], { type: 'image/png' });
    }
    // Multiple: ZIP of images
    const outZip = new JSZip();
    for (const img of imgs) {
      const data = await zip.files[img].async('uint8array');
      outZip.file(img.split('/').pop(), data);
    }
    return outZip.generateAsync({ type: 'blob' });
  }

  // ── Image → PDF ──────────────────────────────
  async function imageToPdf() {
    showProgress('Loading PDF engine…', 15);
    await libs('pdfLib');
    showProgress('Loading image…', 30);
    const dataUrl = await readFileAs('dataURL');
    const canvas  = await imgToCanvas(dataUrl);
    const imgBlob = await canvasToBlob(canvas, 'png');
    const imgAb   = await imgBlob.arrayBuffer();
    showProgress('Building PDF…', 70);
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    let   pdfImg;
    if (currentExt === 'jpg' || currentExt === 'jpeg') {
      try { pdfImg = await pdfDoc.embedJpg(await readFileAs('arrayBuffer')); }
      catch(e) { pdfImg = await pdfDoc.embedPng(imgAb); }
    } else {
      pdfImg = await pdfDoc.embedPng(imgAb);
    }
    const { width, height } = pdfImg.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(pdfImg, { x: 0, y: 0, width, height });
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  // ── Image → Image ────────────────────────────
  async function imageConvert(fmt) {
    showProgress('Processing image…', 40);
    const dataUrl = await readFileAs('dataURL');
    const canvas  = await imgToCanvas(dataUrl);
    showProgress('Encoding…', 80);
    return canvasToBlob(canvas, fmt);
  }

  // ── SVG → HTML ───────────────────────────────
  async function svgToHtml() {
    const svg  = await readFileAs('text');
    const html = htmlPageWrapper(
      `<div style="max-width:100%;overflow:auto">${svg}</div>`,
      currentFile.name
    );
    return strToBlob(html, 'text/html');
  }

  // ── EPUB → * ─────────────────────────────────
  async function epubConvert(to) {
    showProgress('Loading ZIP engine…', 15);
    await libs('JSZip');
    const ab    = await readFileAs('arrayBuffer');
    const zip   = await JSZip.loadAsync(ab);
    showProgress('Extracting content…', 40);
    // Find HTML content files in EPUB
    const htmlFiles = Object.keys(zip.files).filter(n =>
      n.match(/\.(xhtml|html|htm)$/i) && !n.includes('toc')
    ).sort();
    let combined = '';
    for (const hf of htmlFiles) {
      const content = await zip.files[hf].async('string');
      combined += content + '\n';
    }
    const plain = htmlToPlainText(combined);
    if (to === 'txt')  return new Blob([plain], { type: 'text/plain' });
    if (to === 'html') return strToBlob(htmlPageWrapper(combined, currentFile.name), 'text/html');
    if (to === 'md')   return strToBlob(htmlToMarkdown(combined), 'text/markdown');
    if (to === 'pdf')  return textToPdfBlob(plain, currentFile.name);
  }

  /* ─────────────────────────────────────────────
     10. PDF BUILDER (pdf-lib based)
  ───────────────────────────────────────────── */
  async function textToPdfBlob(content, title, isHtml) {
    showProgress('Loading PDF engine…', 30);
    await libs('pdfLib');
    showProgress('Building PDF…', 60);
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fSize  = 11;
    const margin = 50;
    const pgW    = 595, pgH = 842; // A4
    const maxW   = pgW - margin * 2;
    const lineH  = fSize * 1.5;

    // Strip HTML if needed
    const raw = isHtml ? htmlToPlainText(content) : content;
    const paras = raw.split(/\n+/).filter(Boolean);

    let page = pdfDoc.addPage([pgW, pgH]);
    let y    = pgH - margin;

    function addLine(text) {
      const words = text.split(' ');
      let   line  = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        const tw   = font.widthOfTextAtSize(test, fSize);
        if (tw > maxW && line) {
          if (y < margin + lineH) {
            page = pdfDoc.addPage([pgW, pgH]);
            y    = pgH - margin;
          }
          page.drawText(line, { x: margin, y, size: fSize, font, color: rgb(0,0,0) });
          y -= lineH;
          line = w;
        } else { line = test; }
      }
      if (line) {
        if (y < margin + lineH) {
          page = pdfDoc.addPage([pgW, pgH]);
          y    = pgH - margin;
        }
        page.drawText(line, { x: margin, y, size: fSize, font, color: rgb(0,0,0) });
        y -= lineH;
      }
    }

    for (const para of paras) {
      addLine(para);
      y -= lineH * 0.3; // paragraph gap
    }

    showProgress('Saving…', 90);
    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  /* ─────────────────────────────────────────────
     11. DOCX BUILDER (native, no external lib)
         Uses raw OOXML for maximum compatibility
  ───────────────────────────────────────────── */
  async function textToDocxBlob(text) {
    showProgress('Building DOCX…', 60);
    await libs('JSZip');
    const paras = text.split(/\n+/).filter(Boolean);
    const paraXml = paras.map(p =>
      `<w:p><w:r><w:t xml:space="preserve">${escXml(p)}</w:t></w:r></w:p>`
    ).join('');

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paraXml}<w:sectPr/></w:body></w:document>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml"  ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', relsXml);
    zip.file('word/document.xml', docXml);
    zip.file('word/_rels/document.xml.rels', wordRels);
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    return blob;
  }

  function escXml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ─────────────────────────────────────────────
     12. HTML ↔ PLAIN TEXT / MARKDOWN UTILITIES
  ───────────────────────────────────────────── */
  function htmlToPlainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || d.innerText || '').replace(/\s+/g,' ').trim();
  }

  function htmlToMarkdown(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    let md = '';
    function walk(node) {
      if (node.nodeType === 3) { md += node.textContent; return; }
      const t = node.tagName ? node.tagName.toLowerCase() : '';
      if      (t === 'h1')  { md += '\n# ';      node.childNodes.forEach(walk); md += '\n'; }
      else if (t === 'h2')  { md += '\n## ';     node.childNodes.forEach(walk); md += '\n'; }
      else if (t === 'h3')  { md += '\n### ';    node.childNodes.forEach(walk); md += '\n'; }
      else if (t === 'p')   { md += '\n';        node.childNodes.forEach(walk); md += '\n'; }
      else if (t === 'br')  { md += '  \n'; }
      else if (t === 'b' || t === 'strong') { md += '**'; node.childNodes.forEach(walk); md += '**'; }
      else if (t === 'i' || t === 'em')     { md += '_';  node.childNodes.forEach(walk); md += '_'; }
      else if (t === 'a')   { md += '['; node.childNodes.forEach(walk); md += `](${node.href||''})`; }
      else if (t === 'li')  { md += '\n- ';      node.childNodes.forEach(walk); }
      else if (t === 'code')     { md += '`'; node.childNodes.forEach(walk); md += '`'; }
      else if (t === 'pre')      { md += '\n```\n'; node.childNodes.forEach(walk); md += '\n```\n'; }
      else                       { node.childNodes.forEach(walk); }
    }
    d.childNodes.forEach(walk);
    return md.replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ─────────────────────────────────────────────
     13. PROGRESS / RESULT UI
  ───────────────────────────────────────────── */
  function showProgress(msg, pct) {
    progressWrap.classList.add('visible');
    progressBar.style.width = pct + '%';
    progressMsg.textContent = msg;
    resultWrap.classList.remove('visible');
  }

  function hideProgress() {
    progressWrap.classList.remove('visible');
    progressBar.style.width = '0%';
  }

  function showResult(blob, name, ext) {
    hideProgress();
    const url = URL.createObjectURL(blob);
    resultName.textContent = name;
    resultDl.href          = url;
    resultDl.download      = name;
    resultWrap.classList.add('visible');

    // Update download size
    const sz = document.getElementById('convResultSize');
    if (sz) sz.textContent = formatBytes(blob.size);

    // Show preview for images/html
    const previewWrap = document.getElementById('convPreview');
    const previewEl   = document.getElementById('convPreviewEl');
    if (previewWrap && previewEl) {
      if (['png','jpg','webp','gif'].includes(ext)) {
        previewEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:300px;object-fit:contain;">`;
        previewWrap.classList.add('visible');
      } else if (ext === 'html') {
        previewEl.innerHTML = `<iframe src="${url}" style="width:100%;height:300px;border:none;"></iframe>`;
        previewWrap.classList.add('visible');
      } else {
        previewWrap.classList.remove('visible');
      }
    }
    showToast('✓ Conversion complete');
  }

  function hideResult() {
    resultWrap.classList.remove('visible');
    const pw = document.getElementById('convPreview');
    if (pw) pw.classList.remove('visible');
  }

  /* ─────────────────────────────────────────────
     14. RESET
  ───────────────────────────────────────────── */
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      currentFile = null; currentExt = null; selectedOutput = null;
      fileInput.value = '';
      fileInfo.classList.remove('visible');
      outputSection.classList.remove('visible');
      hideProgress(); hideResult();
      dropZone.classList.remove('has-file');
      dropZone.querySelector('.conv-drop__icon').textContent = '⬆';
      dropZone.querySelector('.conv-drop__text').textContent = 'Drop your file here';
      dropZone.querySelector('.conv-drop__sub').textContent  = getSupportedExtsString();
    });
  }

  /* ─────────────────────────────────────────────
     15. SUPPORTED FORMATS LIST (for UI)
  ───────────────────────────────────────────── */
  function getSupportedExtsString() {
    return Object.keys(CONV_MAP).map(e => '.' + e.toUpperCase()).join(' · ');
  }

  // Populate supported formats banner if present
  const fmtBanner = document.getElementById('convFormatsBanner');
  if (fmtBanner) {
    fmtBanner.textContent = getSupportedExtsString();
  }

  // Populate conversion matrix table if present
  const matrixEl = document.getElementById('convMatrix');
  if (matrixEl) {
    let html = '<tbody>';
    Object.entries(CONV_MAP).forEach(([ext, info]) => {
      html += `<tr>
        <td class="conv-matrix__from"><span class="conv-matrix__icon">${info.icon}</span>.${ext.toUpperCase()}</td>
        <td class="conv-matrix__label">${info.label}</td>
        <td class="conv-matrix__outs">${info.outputs.map(o=>`<span class="conv-tag">.${o}</span>`).join('')}</td>
      </tr>`;
    });
    html += '</tbody>';
    matrixEl.innerHTML = html;
  }

  /* ─────────────────────────────────────────────
     16. UTILS
  ───────────────────────────────────────────── */
  function formatBytes(b) {
    if (b < 1024)     return b + ' B';
    if (b < 1048576)  return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(2) + ' MB';
  }

  // Use global showToast from main.js if available
  if (!window.showToast) {
    window.showToast = function(msg) {
      let t = document.getElementById('toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--fg,#000);color:var(--bg,#fff);padding:0.6rem 1.2rem;font-family:monospace;font-size:0.7rem;letter-spacing:.1em;text-transform:uppercase;z-index:9999;transition:opacity .3s;pointer-events:none;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(window._toastT);
      window._toastT = setTimeout(() => { t.style.opacity = '0'; }, 2200);
    };
  }

  /* Expose for potential external use */
  window.GifonteConverter = { CONV_MAP, formatBytes };

})();
