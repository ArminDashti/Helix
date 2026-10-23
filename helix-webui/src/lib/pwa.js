const SW_UPDATE_EVENT = "helix-sw-update";

/** @returns {() => void} unsubscribe */
export function onServiceWorkerUpdate(listener) {
  window.addEventListener(SW_UPDATE_EVENT, listener);
  return () => window.removeEventListener(SW_UPDATE_EVENT, listener);
}

function notifyUpdateWaiting() {
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT));
}

export function applyServiceWorkerUpdate() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistration().then((reg) => {
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
}

export function initPwa() {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) reg.unregister();
    });
    return;
  }

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker
    .register(`${base}sw.js`)
    .then((reg) => {
      if (reg.waiting) notifyUpdateWaiting();

      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            notifyUpdateWaiting();
          }
        });
      });
    })
    .catch(() => {});
}

export function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

/** @returns {() => void} remove listeners */
export function listenForInstallPrompt(onPrompt) {
  const handler = (event) => {
    event.preventDefault();
    onPrompt(event);
  };
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}

export async function promptPwaInstall(deferredPrompt) {
  if (!deferredPrompt?.prompt) return "unavailable";
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  return outcome;
}
