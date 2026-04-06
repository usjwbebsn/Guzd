/* ══════════════════════════════════════
   FONTCRAFT — FONT.JS
   30 Unicode text style transformations
══════════════════════════════════════ */

(function () {
  'use strict';

  // ── Base char ranges ─────────────────
  const A = 65, a = 97, Z = 90, z = 122, N0 = 48;

  function mapAlpha(text, Ustart, Lstart, Dstart) {
    return text.split('').map(c => {
      const cu = c.charCodeAt(0);
      if (cu >= A && cu <= Z && Ustart) return String.fromCodePoint(Ustart + cu - A);
      if (cu >= a && cu <= z && Lstart) return String.fromCodePoint(Lstart + cu - a);
      if (cu >= N0 && cu <= N0 + 9 && Dstart) return String.fromCodePoint(Dstart + cu - N0);
      return c;
    }).join('');
  }

  // ── Lookup maps ──────────────────────
  const SMALL_CAPS = {
    a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',
    m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
  };
  const SUPERSCRIPT = {
    a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',
    m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'ᵠ',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ',
    '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'
  };
  const SUBSCRIPT = {
    a:'ₐ',b:'b',c:'c',d:'d',e:'ₑ',f:'f',g:'g',h:'ₕ',i:'ᵢ',j:'ⱼ',k:'ₖ',l:'ₗ',
    m:'ₘ',n:'ₙ',o:'ₒ',p:'ₚ',q:'q',r:'ᵣ',s:'ₛ',t:'ₜ',u:'ᵤ',v:'ᵥ',w:'w',x:'ₓ',y:'y',z:'z',
    '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'
  };
  const INVERTED = {
    a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',
    m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',
    A:'∀',B:'q',C:'Ɔ',D:'p',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ɾ',K:'ʞ',L:'˥',
    M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'⅄',Z:'Z',
    '0':'0','1':'Ɩ','2':'ᄅ','3':'Ɛ','4':'ᔭ','5':'ϛ','6':'9','7':'ㄥ','8':'8','9':'6',
    '!':'¡','?':'¿',',':'\'','\'':',','.':'˙','(':')',')':'('
  };
  const CIRCLED = {
    a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',
    m:'ⓜ',n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',
    A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',
    M:'Ⓜ',N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ',
    '0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨'
  };
  const NEG_CIRCLED = {
    a:'🅐',b:'🅑',c:'🅒',d:'🅓',e:'🅔',f:'🅕',g:'🅖',h:'🅗',i:'🅘',j:'🅙',k:'🅚',l:'🅛',
    m:'🅜',n:'🅝',o:'🅞',p:'🅟',q:'🅠',r:'🅡',s:'🅢',t:'🅣',u:'🅤',v:'🅥',w:'🅦',x:'🅧',y:'🅨',z:'🅩',
    A:'🅐',B:'🅑',C:'🅒',D:'🅓',E:'🅔',F:'🅕',G:'🅖',H:'🅗',I:'🅘',J:'🅙',K:'🅚',L:'🅛',
    M:'🅜',N:'🅝',O:'🅞',P:'🅟',Q:'🅠',R:'🅡',S:'🅢',T:'🅣',U:'🅤',V:'🅥',W:'🅦',X:'🅧',Y:'🅨',Z:'🅩'
  };
  const SQUARED = {
    a:'🄰',b:'🄱',c:'🄲',d:'🄳',e:'🄴',f:'🄵',g:'🄶',h:'🄷',i:'🄸',j:'🄹',k:'🄺',l:'🄻',
    m:'🄼',n:'🄽',o:'🄾',p:'🄿',q:'🅀',r:'🅁',s:'🅂',t:'🅃',u:'🅄',v:'🅅',w:'🅆',x:'🅇',y:'🅈',z:'🅉',
    A:'🄰',B:'🄱',C:'🄲',D:'🄳',E:'🄴',F:'🄵',G:'🄶',H:'🄷',I:'🄸',J:'🄹',K:'🄺',L:'🄻',
    M:'🄼',N:'🄽',O:'🄾',P:'🄿',Q:'🅀',R:'🅁',S:'🅂',T:'🅃',U:'🅄',V:'🅅',W:'🅆',X:'🅇',Y:'🅈',Z:'🅉'
  };
  const NEG_SQUARED = {
    a:'🅰',b:'🅱',c:'c',d:'d',e:'🅴',f:'f',g:'g',h:'h',i:'🅸',j:'j',k:'k',l:'l',
    m:'m',n:'🅽',o:'🅾',p:'🅿',q:'q',r:'r',s:'s',t:'t',u:'u',v:'v',w:'w',x:'x',y:'y',z:'z',
    A:'🅰',B:'🅱',C:'C',D:'D',E:'🅴',F:'F',G:'G',H:'H',I:'🅸',J:'J',K:'K',L:'L',
    M:'M',N:'🅽',O:'🅾',P:'🅿',Q:'Q',R:'R',S:'S',T:'T',U:'U',V:'V',W:'W',X:'X',Y:'Y',Z:'Z'
  };

  function mapLookup(text, map) {
    return text.split('').map(c => map[c] || c).join('');
  }

  // Zalgo diacritics pool
  const ZALGO_UP = ['̍','̎','̄','̅','̿','̑','̆','̐','͒','͗','͑','̇','̈','̊','͂','̓','̈́','͊','͋','͌','̃','̂','̌','͐','́','͘','̇'];
  const ZALGO_MID = ['̕','̛','̀','́','͘','̡','̢','̧','̨','̴','̵','̶','͜','͝','͞','͟','͠','͢','̸','̷','͡'];
  const ZALGO_DN = ['̖','̗','̘','̙','̜','̝','̞','̟','̠','̤','̥','̦','̩','̪','̫','̬','̭','̮','̯','̰','̱','̲','̳','̹','̺','̻','̼','ͅ','͇','͈','͉','͍','͎'];

  function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── 30 Style Definitions ─────────────
  const STYLES = [
    // ── Mathematical Unicode ──
    {
      id: 'math-bold',
      name: 'Mathematical Bold',
      category: 'Mathematical',
      transform: t => mapAlpha(t, 0x1D400, 0x1D41A, 0x1D7CE)
    },
    {
      id: 'math-italic',
      name: 'Math Italic',
      category: 'Mathematical',
      transform: t => mapAlpha(t, 0x1D434, 0x1D44E, null)
    },
    {
      id: 'math-bold-italic',
      name: 'Bold Italic',
      category: 'Mathematical',
      transform: t => mapAlpha(t, 0x1D468, 0x1D482, null)
    },
    {
      id: 'math-script',
      name: 'Script',
      category: 'Calligraphy',
      transform: t => mapAlpha(t, 0x1D49C, 0x1D4B6, null)
    },
    {
      id: 'math-script-bold',
      name: 'Bold Script',
      category: 'Calligraphy',
      transform: t => mapAlpha(t, 0x1D4D0, 0x1D4EA, null)
    },
    {
      id: 'fraktur',
      name: 'Fraktur',
      category: 'Gothic',
      transform: t => mapAlpha(t, 0x1D504, 0x1D51E, null)
    },
    {
      id: 'fraktur-bold',
      name: 'Bold Fraktur',
      category: 'Gothic',
      transform: t => mapAlpha(t, 0x1D56C, 0x1D586, null)
    },
    {
      id: 'double-struck',
      name: 'Double-Struck',
      category: 'Mathematical',
      transform: t => mapAlpha(t, 0x1D538, 0x1D552, 0x1D7D8)
    },
    {
      id: 'sans',
      name: 'Sans-Serif',
      category: 'Sans',
      transform: t => mapAlpha(t, 0x1D5A0, 0x1D5BA, 0x1D7E2)
    },
    {
      id: 'sans-bold',
      name: 'Sans Bold',
      category: 'Sans',
      transform: t => mapAlpha(t, 0x1D5D4, 0x1D5EE, 0x1D7EC)
    },
    {
      id: 'sans-italic',
      name: 'Sans Italic',
      category: 'Sans',
      transform: t => mapAlpha(t, 0x1D608, 0x1D622, null)
    },
    {
      id: 'sans-bold-italic',
      name: 'Sans Bold Italic',
      category: 'Sans',
      transform: t => mapAlpha(t, 0x1D63C, 0x1D656, null)
    },
    {
      id: 'monospace',
      name: 'Monospace',
      category: 'Mathematical',
      transform: t => mapAlpha(t, 0x1D670, 0x1D68A, 0x1D7F6)
    },
    // ── Symbols / Decorative ──
    {
      id: 'circled',
      name: 'Circled',
      category: 'Symbols',
      transform: t => mapLookup(t, CIRCLED)
    },
    {
      id: 'neg-circled',
      name: 'Neg. Circled',
      category: 'Symbols',
      transform: t => mapLookup(t, NEG_CIRCLED)
    },
    {
      id: 'squared',
      name: 'Squared',
      category: 'Symbols',
      transform: t => mapLookup(t, SQUARED)
    },
    {
      id: 'neg-squared',
      name: 'Neg. Squared',
      category: 'Symbols',
      transform: t => mapLookup(t, NEG_SQUARED)
    },
    // ── Stylized ──
    {
      id: 'small-caps',
      name: 'Small Caps',
      category: 'Stylized',
      transform: t => t.split('').map(c => SMALL_CAPS[c.toLowerCase()] || c).join('')
    },
    {
      id: 'fullwidth',
      name: 'Full Width',
      category: 'Stylized',
      transform: t => t.split('').map(c => {
        const cu = c.charCodeAt(0);
        if (cu >= 33 && cu <= 126) return String.fromCharCode(cu + 0xFF01 - 33);
        return c;
      }).join('')
    },
    {
      id: 'superscript',
      name: 'Superscript',
      category: 'Stylized',
      transform: t => mapLookup(t, SUPERSCRIPT)
    },
    {
      id: 'subscript',
      name: 'Subscript',
      category: 'Stylized',
      transform: t => mapLookup(t, SUBSCRIPT)
    },
    {
      id: 'inverted',
      name: 'Inverted',
      category: 'Stylized',
      transform: t => t.split('').map(c => INVERTED[c] || c).reverse().join('')
    },
    // ── Aesthetic ──
    {
      id: 'aesthetic',
      name: 'Aesthetic',
      category: 'Aesthetic',
      transform: t => t.split('').join(' ')
    },
    {
      id: 'aesthetic-dots',
      name: 'Dotted Aesthetic',
      category: 'Aesthetic',
      transform: t => t.split('').join('·')
    },
    {
      id: 'aesthetic-bars',
      name: 'Bar Separated',
      category: 'Aesthetic',
      transform: t => t.split('').join('｜')
    },
    {
      id: 'strikethrough',
      name: 'Strikethrough',
      category: 'Diacritic',
      transform: t => t.split('').join('\u0336')
    },
    {
      id: 'underline',
      name: 'Underline',
      category: 'Diacritic',
      transform: t => t.split('').join('\u0332')
    },
    {
      id: 'overline',
      name: 'Overline',
      category: 'Diacritic',
      transform: t => t.split('').join('\u0305')
    },
    {
      id: 'double-underline',
      name: 'Double Underline',
      category: 'Diacritic',
      transform: t => t.split('').join('\u0333')
    },
    {
      id: 'zalgo',
      name: 'Zalgo Glitch',
      category: 'Glitch',
      transform: t => t.split('').map(c => {
        if (c === ' ') return c;
        const u = Math.floor(Math.random() * 3) + 1;
        const m = Math.floor(Math.random() * 2);
        const d = Math.floor(Math.random() * 3) + 1;
        let r = c;
        for (let i = 0; i < u; i++) r += rnd(ZALGO_UP);
        for (let i = 0; i < m; i++) r += rnd(ZALGO_MID);
        for (let i = 0; i < d; i++) r += rnd(ZALGO_DN);
        return r;
      }).join('')
    }
  ];

  // ── Categories ──────────────────────
  const CATEGORIES = ['All', 'Mathematical', 'Calligraphy', 'Gothic', 'Sans', 'Symbols', 'Stylized', 'Aesthetic', 'Diacritic', 'Glitch'];

  // ── DOM ──────────────────────────────
  let currentFilter = 'All';
  let currentText = '';

  function getInput() {
    const el = document.getElementById('mainInput');
    return el ? el.value.trim() : '';
  }

  function renderResults(text, filter) {
    const grid = document.getElementById('resultsGrid');
    const countEl = document.getElementById('styleCount');
    if (!grid) return;

    if (!text) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">TYPE SOMETHING</div>
          <div class="empty-state__text">Enter text above to generate 30 font styles</div>
        </div>`;
      if (countEl) countEl.textContent = '30 STYLES';
      return;
    }

    const filtered = filter === 'All' ? STYLES : STYLES.filter(s => s.category === filter);
    if (countEl) countEl.textContent = `${filtered.length} STYLES`;

    grid.innerHTML = filtered.map((s, i) => {
      const result = s.transform(text);
      return `
        <div class="result-card" data-text="${escAttr(result)}" onclick="handleCardClick(this)">
          <div class="result-card__meta">
            <span class="result-card__num">${String(i + 1).padStart(2, '0')}</span>
            <span class="result-card__name">${s.name}</span>
            <span class="result-card__category">${s.category}</span>
          </div>
          <div class="result-card__text">${escHtml(result)}</div>
          <div class="result-card__action">
            <button class="btn-copy" onclick="event.stopPropagation(); copyCard(this, '${escAttr(result)}')">COPY</button>
          </div>
        </div>`;
    }).join('');
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escAttr(s) {
    return s.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  window.handleCardClick = function (card) {
    const text = card.getAttribute('data-text');
    if (text) copyText(text);
  };

  window.copyCard = function (btn, text) {
    const decoded = text
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    copyText(decoded);
    btn.classList.add('copied');
    btn.textContent = 'COPIED';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = 'COPY';
    }, 1800);
  };

  // ── Filter buttons ───────────────────
  function buildFilters() {
    const bar = document.getElementById('filterBar');
    if (!bar) return;
    bar.innerHTML = CATEGORIES.map(cat =>
      `<button class="filter-btn${cat === 'All' ? ' active' : ''}" data-cat="${cat}">${cat}</button>`
    ).join('');

    bar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.cat;
        renderResults(currentText, currentFilter);
      });
    });
  }

  // ── Init ─────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    buildFilters();
    renderResults('', currentFilter);

    const input = document.getElementById('mainInput');
    const btnGenerate = document.getElementById('btnGenerate');
    const btnClear = document.getElementById('btnClear');
    const btnCopyAll = document.getElementById('btnCopyAll');

    if (input) {
      input.addEventListener('input', function () {
        currentText = this.value.trim();
        renderResults(currentText, currentFilter);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          currentText = this.value.trim();
          renderResults(currentText, currentFilter);
        }
      });
    }

    if (btnGenerate) {
      btnGenerate.addEventListener('click', () => {
        currentText = getInput();
        renderResults(currentText, currentFilter);
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (input) input.value = '';
        currentText = '';
        renderResults('', currentFilter);
        input && input.focus();
      });
    }

    if (btnCopyAll) {
      btnCopyAll.addEventListener('click', () => {
        if (!currentText) { showToast('TYPE SOMETHING FIRST'); return; }
        const filtered = currentFilter === 'All' ? STYLES : STYLES.filter(s => s.category === currentFilter);
        const all = filtered.map(s => `[${s.name}]\n${s.transform(currentText)}`).join('\n\n');
        copyText(all);
        showToast(`COPIED ${filtered.length} STYLES`);
      });
    }
  });

})();
