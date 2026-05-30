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

function dispatchPwaInstallStateChange(appId: string) {
  window.dispatchEvent(new CustomEvent("mealtrack:pwa-install-state-change", { detail: { appId } }));
}

function getCurrentPwaAppId() {
  return window.location.pathname.startsWith("/shared") ? "shared" : "main";
}

export function usePwaInstall(appId = "main") {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const markerKey = getInstalledMarkerKey(appId);
    const getAppInstalledState = () => {
      const isSameStandaloneApp = getStandaloneMode() && getCurrentPwaAppId() === appId;
      return isSameStandaloneApp || window.localStorage.getItem(markerKey) === "true";
    };

    if (getStandaloneMode() && getCurrentPwaAppId() === appId) {
      window.localStorage.setItem(markerKey, "true");
    }

    setIsInstalled(getAppInstalledState());
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(ios);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsSupported(true);
    };

    const handleInstalled = () => {
      window.localStorage.setItem(markerKey, "true");
      dispatchPwaInstallStateChange(appId);
      setIsInstalled(true);
      setInstallPrompt(null);
      setIsSupported(false);
    };

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

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("mealtrack:pwa-install-state-change", handleInstallStateChange);
    window.addEventListener("storage", handleInstallStateChange);
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("mealtrack:pwa-install-state-change", handleInstallStateChange);
      window.removeEventListener("storage", handleInstallStateChange);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, [appId]);

  const markInstalled = () => {
    window.localStorage.setItem(getInstalledMarkerKey(appId), "true");
    dispatchPwaInstallStateChange(appId);
    setIsInstalled(true);
    setInstallPrompt(null);
    setIsSupported(false);
  };

  const promptInstall = async () => {
    if (!installPrompt) {
      return { outcome: "dismissed" as const };
    }

    await installPrompt.prompt();
    const result = await installPrompt.userChoice;

    if (result.outcome === "accepted") {
      window.localStorage.setItem(getInstalledMarkerKey(appId), "true");
      dispatchPwaInstallStateChange(appId);
      setIsInstalled(true);
      setInstallPrompt(null);
      setIsSupported(false);
    }

    return result;
  };

  return {
    isInstalled,
    isSupported,
    isIos,
    canInstall: isSupported && !isInstalled && !!installPrompt,
    markInstalled,
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
