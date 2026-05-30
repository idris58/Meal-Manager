import { useEffect, useState } from "react";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function getStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function getInstalledMarkerKey(appId: string) {
  return `mealtrack:pwa-installed:${appId}`;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let pwaBrowserListenersAttached = false;
const installPromptSubscribers = new Set<() => void>();

function dispatchPwaInstallStateChange(appId: string) {
  window.dispatchEvent(new CustomEvent("mealtrack:pwa-install-state-change", { detail: { appId } }));
}

function getCurrentPwaAppId() {
  return window.location.pathname.startsWith("/shared") ? "shared" : "main";
}

function notifyInstallPromptSubscribers() {
  for (const subscriber of Array.from(installPromptSubscribers)) {
    subscriber();
  }
}

function ensurePwaBrowserListeners() {
  if (typeof window === "undefined" || pwaBrowserListenersAttached) {
    return;
  }

  pwaBrowserListenersAttached = true;

  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyInstallPromptSubscribers();
  });

  window.addEventListener("appinstalled", () => {
    const appId = getCurrentPwaAppId();
    window.localStorage.setItem(getInstalledMarkerKey(appId), "true");
    deferredInstallPrompt = null;
    dispatchPwaInstallStateChange(appId);
    notifyInstallPromptSubscribers();
  });
}

ensurePwaBrowserListeners();

export function usePwaInstall(appId = "main") {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(deferredInstallPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSupported, setIsSupported] = useState(Boolean(deferredInstallPrompt));
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    ensurePwaBrowserListeners();
    const markerKey = getInstalledMarkerKey(appId);
    const getAppInstalledState = () => {
      const isSameStandaloneApp = getStandaloneMode() && getCurrentPwaAppId() === appId;
      if (isSameStandaloneApp) {
        return true;
      }

      if (deferredInstallPrompt) {
        return false;
      }

      return window.localStorage.getItem(markerKey) === "true";
    };

    if (getStandaloneMode() && getCurrentPwaAppId() === appId) {
      window.localStorage.setItem(markerKey, "true");
    }

    setIsInstalled(getAppInstalledState());
    setInstallPrompt(deferredInstallPrompt);
    setIsSupported(Boolean(deferredInstallPrompt));
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(ios);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      if (getStandaloneMode() && getCurrentPwaAppId() === appId) {
        window.localStorage.setItem(markerKey, "true");
        dispatchPwaInstallStateChange(appId);
      }
      setIsInstalled(getAppInstalledState());
    };

    const handleInstallStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ appId?: string }>).detail;
      if (!detail?.appId || detail.appId === appId) {
        setIsInstalled(getAppInstalledState());
      }
    };

    const handleInstallPromptChange = () => {
      setInstallPrompt(deferredInstallPrompt);
      setIsSupported(Boolean(deferredInstallPrompt));
      setIsInstalled(getAppInstalledState());
    };

    installPromptSubscribers.add(handleInstallPromptChange);
    window.addEventListener("mealtrack:pwa-install-state-change", handleInstallStateChange);
    window.addEventListener("storage", handleInstallStateChange);
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      installPromptSubscribers.delete(handleInstallPromptChange);
      window.removeEventListener("mealtrack:pwa-install-state-change", handleInstallStateChange);
      window.removeEventListener("storage", handleInstallStateChange);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, [appId]);

  const promptInstall = async () => {
    const prompt = installPrompt ?? deferredInstallPrompt;
    if (!prompt) {
      return { outcome: "dismissed" as const };
    }

    await prompt.prompt();
    const result = await prompt.userChoice;

    if (result.outcome === "accepted") {
      window.localStorage.setItem(getInstalledMarkerKey(appId), "true");
      dispatchPwaInstallStateChange(appId);
      deferredInstallPrompt = null;
      setIsInstalled(true);
      setInstallPrompt(null);
      setIsSupported(false);
      notifyInstallPromptSubscribers();
    }

    return result;
  };

  return {
    isInstalled,
    isSupported,
    isIos,
    canInstall: isSupported && !isInstalled && !!installPrompt,
    promptInstall,
  };
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}
