/* coi-serviceworker v0.1.7 — adapted for gifonte.com / GitHub Pages
   Adds COOP + COEP headers via Service Worker so SharedArrayBuffer
   (required by FFmpeg.wasm) works on GitHub Pages.
   Original: https://github.com/gzuidhof/coi-serviceworker
*/
"use strict";

const coi = self.coi || {
  shouldRegister: () => true,
  shouldDeregister: () => false,
  quiet: false,
  doReload: () => location.reload(),
};

const reloadedBySelf = sessionStorage.getItem("coiReloadedBySelf");
sessionStorage.removeItem("coiReloadedBySelf");

function isWorker() {
  return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
}

if (isWorker()) {
  // In a worker — intercept fetches and inject headers
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", (e) => {
    const request = e.request;
    if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) return response;
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => {
          console.error("[coi-sw] fetch error:", e);
          return new Response("", { status: 503, statusText: "Service Unavailable" });
        })
    );
  });
} else {
  // In the main page — register the service worker
  if (!("serviceWorker" in navigator)) {
    !coi.quiet && console.log("[coi-sw] Service workers not supported.");
  } else if (window.crossOriginIsolated !== false) {
    !coi.quiet && console.log("[coi-sw] Already cross-origin isolated. No registration needed.");
  } else if (coi.shouldDeregister()) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.unregister().then(() => !coi.quiet && console.log("[coi-sw] Deregistered."));
      }
    });
  } else if (!coi.shouldRegister()) {
    !coi.quiet && console.log("[coi-sw] Skipping registration (shouldRegister returned false).");
  } else {
    navigator.serviceWorker
      .register(document.currentScript ? document.currentScript.src : "coi-serviceworker.js")
      .then((registration) => {
        !coi.quiet && console.log("[coi-sw] Registered.", registration.scope);

        registration.addEventListener("updatefound", () => {
          !coi.quiet && console.log("[coi-sw] Update found — reloading after install.");
          registration.installing.addEventListener("statechange", (e) => {
            if (e.target.state === "installed") {
              sessionStorage.setItem("coiReloadedBySelf", "updatefound");
              coi.doReload();
            }
          });
        });

        if (registration.active && !navigator.serviceWorker.controller) {
          // Active but not yet controlling — need a reload
          !coi.quiet && console.log("[coi-sw] Active but not controlling — reloading.");
          sessionStorage.setItem("coiReloadedBySelf", "notcontrolling");
          coi.doReload();
        }
      })
      .catch((e) => {
        !coi.quiet && console.error("[coi-sw] Registration failed:", e);
      });

    // If newly registered, reload so service worker takes control
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloadedBySelf) {
        !coi.quiet && console.log("[coi-sw] Controller changed — reloading.");
        sessionStorage.setItem("coiReloadedBySelf", "controllerchange");
        coi.doReload();
      }
    });
  }
}
