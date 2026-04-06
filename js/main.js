/* ══════════════════════════════════════
   FONTCRAFT — MAIN.JS
   Dark mode toggle · Mobile menu · Utils
══════════════════════════════════════ */

(function () {
  'use strict';

  // ── Dark Mode ──────────────────────────
  const THEME_KEY = 'fc-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('btnTheme');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '◐';
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Init on load
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getTheme());

    const btn = document.getElementById('btnTheme');
    if (btn) btn.addEventListener('click', toggleTheme);

    // ── Mobile Menu ──────────────────────
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');

    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', function () {
        mobileMenu.classList.toggle('open');
        const spans = hamburger.querySelectorAll('span');
        if (mobileMenu.classList.contains('open')) {
          spans[0].style.transform = 'rotate(45deg) translate(4px, 4px)';
          spans[1].style.opacity = '0';
          spans[2].style.transform = 'rotate(-45deg) translate(4px, -4px)';
        } else {
          spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
        }
      });

      // Close on link click
      mobileMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          mobileMenu.classList.remove('open');
          hamburger.querySelectorAll('span').forEach(s => {
            s.style.transform = ''; s.style.opacity = '';
          });
        });
      });
    }

    // ── Active nav link ──────────────────
    const path = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });

    // ── Scroll-reveal for sections ──────
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.style.opacity = '1';
            e.target.style.transform = 'translateY(0)';
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll('.reveal').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        io.observe(el);
      });
    }
  });

  // ── Toast utility ────────────────────
  window.showToast = function (msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // ── Copy to clipboard ────────────────
  window.copyText = function (text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('COPIED TO CLIPBOARD'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('COPIED TO CLIPBOARD');
    }
  };
})();
