/* coi-serviceworker.js — Cross-Origin Isolation for GitHub Pages
   Injects COOP + COEP headers via Service Worker so SharedArrayBuffer
   is available for FFmpeg.wasm. On first load, registers the SW and
   reloads the page. On second load, the SW is active and sets headers.
   Source: https://github.com/gzuidhof/coi-serviceworker (MIT License)
*/
"use strict";

/* ── If we ARE the service worker ── */
if (typeof importScripts === "function") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
  self.addEventListener("fetch", (e) => {
    const req = e.request;
    // Don't intercept non-GET or opaque responses
    if (req.method !== "GET") return;
    if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
    e.respondWith(
      fetch(req).then((res) => {
        if (!res || res.status === 0 || res.type === "opaque") return res;
        const h = new Headers(res.headers);
        h.set("Cross-Origin-Opener-Policy", "same-origin");
        h.set("Cross-Origin-Embedder-Policy", "credentialless");
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
      }).catch(() => fetch(req))
    );
  });
  return; // stop here — the rest is for the main thread
}

/* ── Main thread: register the SW ── */
(function () {
  if (!("serviceWorker" in navigator)) return;

  // Already isolated — nothing to do
  if (window.crossOriginIsolated) return;

  // Flag to avoid infinite reload loops
  const RELOAD_KEY = "coiReloadedBySelf";
  const reloadedBySelf = sessionStorage.getItem(RELOAD_KEY);
  sessionStorage.removeItem(RELOAD_KEY);

  navigator.serviceWorker.register(document.currentScript.src)
    .then((reg) => {
      // If there's no controller yet, we need a reload after the SW activates
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!reloadedBySelf) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            location.reload();
          }
        });
      }
      // Handle SW updates
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            location.reload();
          }
        });
      });
    })
    .catch((err) => console.warn("[coi-sw] Registration failed:", err));
})();
