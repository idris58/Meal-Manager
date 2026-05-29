import { useEffect, useRef, useState } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";

import { Layout } from "@/components/layout";
import { ToastAction } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/toaster";
import { useAuth, AuthProvider } from "@/lib/auth-context";
import { toast } from "@/hooks/use-toast";
import { MealProvider, useMeal } from "@/lib/meal-context";
import { useNetworkStatus } from "@/lib/pwa";
import { supabase } from "@/lib/supabase";
import AuthPage from "@/pages/auth";
import ChangelogPage from "@/pages/changelog";
import Dashboard from "@/pages/dashboard";
import Expenses from "@/pages/expenses";
import HistoryPage from "@/pages/history";
import Meals from "@/pages/meals";
import Members from "@/pages/members";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/settings";
import SharedPage, { SharedAccessPage } from "@/pages/shared";

function Router() {
  const { loading } = useMeal();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Spinner className="mx-auto h-8 w-8 text-primary" />
          <p className="text-muted-foreground">Loading your meal data...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/members" component={Members} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/meals" component={Meals} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/changelog" component={ChangelogPage} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppShell() {
  const { session, loading, lastAuthEvent } = useAuth();
  const [location, setLocation] = useLocation();
  const [isSharedLandingRoute] = useRoute("/shared");
  const [isSharedRoute, sharedParams] = useRoute("/shared/:token");
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const authCode = searchParams.get("code");
  const recoveryType =
    searchParams.get("type")?.toLowerCase() ??
    hashParams.get("type")?.toLowerCase() ??
    "";
  const recoveryTokenHash = searchParams.get("token_hash");
  const recoveryTokenInUrl =
    recoveryType === "recovery" ||
    hashParams.has("access_token") ||
    (Boolean(recoveryTokenHash) && recoveryType === "recovery");
  const [authLinkResolved, setAuthLinkResolved] = useState(
    !authCode && !(recoveryTokenHash && recoveryType === "recovery"),
  );
  const [recoveryLinkVerified, setRecoveryLinkVerified] = useState(recoveryTokenInUrl);

  useEffect(() => {
    const needsCodeExchange = Boolean(authCode);
    const needsRecoveryVerification =
      Boolean(recoveryTokenHash) && recoveryType === "recovery" && !authCode;

    if (!needsCodeExchange && !needsRecoveryVerification) {
      setAuthLinkResolved(true);
      return;
    }

    let cancelled = false;
    setAuthLinkResolved(false);

    const resolveAuthLink = async () => {
      let error: Error | null = null;

      if (needsCodeExchange && authCode) {
        const result = await supabase.auth.exchangeCodeForSession(authCode);
        error = result.error;
      } else if (needsRecoveryVerification && recoveryTokenHash) {
        const result = await supabase.auth.verifyOtp({
          token_hash: recoveryTokenHash,
          type: "recovery",
        });
        error = result.error;
      }

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Error resolving auth recovery link:", error);
      } else {
        setRecoveryLinkVerified(true);
      }

      setAuthLinkResolved(true);
    };

    void resolveAuthLink();

    return () => {
      cancelled = true;
    };
  }, [authCode, recoveryTokenHash, recoveryType]);

  const hasRecoveryContext =
    recoveryLinkVerified || recoveryTokenInUrl || lastAuthEvent === "PASSWORD_RECOVERY";
  const isRecoveryFlow = location === "/auth" && hasRecoveryContext;

  useEffect(() => {
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const isSharedExperience = isSharedLandingRoute || isSharedRoute;

    manifestLink?.setAttribute(
      "href",
      isSharedExperience ? "/shared-manifest.webmanifest" : "/manifest.webmanifest",
    );
    appleTitle?.setAttribute("content", isSharedExperience ? "MealTrack Shared" : "MealTrack");
  }, [isSharedLandingRoute, isSharedRoute]);

  useEffect(() => {
    if (isSharedLandingRoute) {
      document.title = "Meal Code - MealTrack";
      return;
    }

    if (isSharedRoute) {
      document.title = "Shared View - MealTrack";
      return;
    }

    const pageTitleMap: Record<string, string> = {
      "/": "Dashboard - MealTrack",
      "/members": "Members - MealTrack",
      "/expenses": "Expenses - MealTrack",
      "/meals": "Meals - MealTrack",
      "/history": "History - MealTrack",
      "/changelog": "Changelog - MealTrack",
      "/settings": "Settings - MealTrack",
      "/auth": isRecoveryFlow ? "Reset Password - MealTrack" : "Authentication - MealTrack",
    };

    document.title = pageTitleMap[location] ?? "MealTrack";
  }, [isRecoveryFlow, isSharedLandingRoute, isSharedRoute, location]);

  useEffect(() => {
    if (isSharedLandingRoute || isSharedRoute) {
      return;
    }

    if (!authLinkResolved) {
      return;
    }

    if (hasRecoveryContext && location !== "/auth") {
      window.history.replaceState(
        null,
        document.title,
        `/auth${window.location.search}${window.location.hash}`,
      );
      setLocation("/auth");
      return;
    }

    if (loading) {
      return;
    }

    if (!session && location !== "/auth") {
      setLocation("/auth");
      return;
    }

    if (session && location === "/auth" && !isRecoveryFlow) {
      setLocation("/");
    }
  }, [authLinkResolved, hasRecoveryContext, isRecoveryFlow, isSharedLandingRoute, isSharedRoute, loading, location, session, setLocation]);

  if (isSharedLandingRoute) {
    return <SharedAccessPage />;
  }

  if (isSharedRoute && sharedParams?.token) {
    return <SharedPage token={sharedParams.token} />;
  }

  if (loading || !authLinkResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Spinner className="mx-auto h-8 w-8 text-primary" />
          <p className="text-muted-foreground">
            {authLinkResolved ? "Checking your session..." : "Preparing your reset link..."}
          </p>
        </div>
      </div>
    );
  }

  if (!session || isRecoveryFlow) {
    return <AuthPage />;
  }

  return (
    <MealProvider>
      <Router />
    </MealProvider>
  );
}

function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
      You are offline. The app shell is available, but live meal data and edits require an internet connection.
    </div>
  );
}

function PwaUpdateNotifier() {
  const hasShownUpdateToast = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
      return;
    }

    const showUpdateToast = () => {
      if (hasShownUpdateToast.current) {
        return;
      }

      hasShownUpdateToast.current = true;
      toast({
        title: "New version available",
        description: "Refresh to load the latest app changes.",
        action: (
          <ToastAction altText="Refresh app" onClick={() => window.location.reload()}>
            Refresh
          </ToastAction>
        ),
      });
    };

    const attachRegistrationListeners = (
      registration: ServiceWorkerRegistration | null | undefined,
    ) => {
      if (!registration) {
        return;
      }

      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast();
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener("statechange", () => {
          if (
            installingWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdateToast();
          }
        });
      });
    };

    void navigator.serviceWorker.getRegistration().then(attachRegistrationListeners);
  }, []);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <OfflineBanner />
      <PwaUpdateNotifier />
      <AppShell />
      <Toaster />
    </AuthProvider>
  );
}

export default App;
