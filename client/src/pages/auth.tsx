import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChefHat,
  Chrome,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthRedirectUrl() {
  const origin = window.location.origin;
  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  return isLocalHost ? `${origin}/` : `${origin}/auth`;
}

function mapAuthError(message: string, mode: AuthMode) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("email not confirmed")
  ) {
    return mode === "login"
      ? "The email or password is incorrect, or your email has not been confirmed yet."
      : "This account is not ready yet. Check your email for the confirmation link.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  ) {
    return "This email is already registered. Try logging in instead.";
  }

  if (
    normalized.includes("expired") ||
    normalized.includes("otp") ||
    normalized.includes("token") ||
    normalized.includes("invalid grant")
  ) {
    return "This link is invalid or has expired. Request a new password reset email.";
  }

  if (normalized.includes("network")) {
    return "We could not reach the authentication service. Please try again.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("security purposes") ||
    normalized.includes("too many requests")
  ) {
    return mode === "forgot-password"
      ? "A reset email was requested recently. Please wait a little and try again."
      : "Please wait a little before trying again.";
  }

  if (
    normalized.includes("redirect") ||
    normalized.includes("redirect_to") ||
    normalized.includes("not allowed") ||
    normalized.includes("invalid redirect")
  ) {
    return "This app URL is not allowed in Supabase Auth redirect settings. Add it there or try again from the deployed app.";
  }

  return "Authentication failed. Please try again.";
}

export default function AuthPage() {
  const { lastAuthEvent } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isRecoveryLink = useMemo(() => {
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("type=recovery") ||
      lastAuthEvent === "PASSWORD_RECOVERY"
    );
  }, [lastAuthEvent]);

  useEffect(() => {
    if (isRecoveryLink) {
      setMode("reset-password");
      setError(null);
      setMessage("Set a new password for your account.");
    }
  }, [isRecoveryLink]);

  const switchMode = (next: AuthMode) => {
    if (mode === "reset-password" && next !== "reset-password") {
      window.history.replaceState(
        null,
        document.title,
        window.location.pathname + window.location.search,
      );
    }

    setMode(next);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const validateForm = (currentMode: AuthMode) => {
    if (currentMode !== "reset-password" && !EMAIL_PATTERN.test(email.trim())) {
      return "Enter a valid email address.";
    }

    if (currentMode !== "forgot-password" && password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (
      (currentMode === "signup" || currentMode === "reset-password") &&
      password !== confirmPassword
    ) {
      return "Passwords do not match.";
    }

    return null;
  };

  const handleEmailAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const validationError = validateForm(mode);

      if (validationError) {
        setError(validationError);
        return;
      }

      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw signInError;
        }

        return;
      }

      if (mode === "forgot-password") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: getAuthRedirectUrl(),
          },
        );

        if (resetError) {
          throw resetError;
        }

        setMessage(
          "Password reset email sent. Check your inbox for the reset link.",
        );
        return;
      }

      if (mode === "reset-password") {
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });

        if (updateError) {
          throw updateError;
        }

        setPassword("");
        setConfirmPassword("");
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search,
        );
        switchMode("login");
        setMessage("Password updated. You can now log in with your new password.");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (
        data.user &&
        Array.isArray((data.user as User & { identities?: unknown[] }).identities) &&
        ((data.user as User & { identities?: unknown[] }).identities?.length ?? 0) === 0
      ) {
        setError("This email is already registered. Try logging in instead.");
        return;
      }

      if (!data.session) {
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setMessage("Account created. Check your email to confirm your account.");
      } else {
        setMessage("Account created. You are now signed in.");
      }
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError.message : "";
      if (mode === "forgot-password") {
        console.error("Password reset email error:", nextError);
      }
      setError(mapAuthError(nextError, mode));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (oauthError) {
      setGoogleLoading(false);
      setError(mapAuthError(oauthError.message, "login"));
      return;
    }

    setTimeout(() => setGoogleLoading(false), 10_000);
  };

  const title =
    mode === "login"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : mode === "forgot-password"
          ? "Reset your password"
          : "Choose a new password";

  const submitLabel =
    mode === "login"
      ? "Login with Email"
      : mode === "signup"
        ? "Create Account"
        : mode === "forgot-password"
          ? "Send Reset Link"
          : "Update Password";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dff6eb_0%,#f8fafc_40%,#eef3f7_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-4 py-10 lg:flex-row lg:items-center lg:px-8">
        <section className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm text-emerald-700 shadow-sm backdrop-blur">
            <ChefHat className="h-4 w-4" />
            Shared meal operations, one secure workspace
          </div>

          <div className="space-y-4">
            <h1 className="font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
              Meal management with account-based access.
            </h1>
            <p className="max-w-lg text-base leading-7 text-slate-600 md:text-lg">
              Sign in with email and password, create a new account, reset your
              password when needed, or continue with Google.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-slate-900">Email login</p>
              <p className="mt-1 text-sm text-slate-600">
                Standard email and password access.
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-slate-900">Signup page</p>
              <p className="mt-1 text-sm text-slate-600">
                New users can register directly in the app.
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-slate-900">Password reset</p>
              <p className="mt-1 text-sm text-slate-600">
                Recover access with an email reset link.
              </p>
            </div>
          </div>
        </section>

        <Card className="w-full max-w-md border-white/80 bg-white/90 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-5 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
                  MealTrack
                </p>
                <CardTitle className="mt-1 text-2xl text-slate-900">
                  {title}
                </CardTitle>
              </div>
            </div>

            {mode === "login" || mode === "signup" ? (
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === "login"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                  onClick={() => switchMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === "signup"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                  onClick={() => switchMode("signup")}
                >
                  Sign up
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-2 self-start text-sm font-medium text-slate-600 transition hover:text-slate-900"
                onClick={() => switchMode("login")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleEmailAuth}>
              {mode !== "reset-password" ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              {mode !== "forgot-password" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password">Password</Label>
                    {mode === "login" ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                        onClick={() => switchMode("forgot-password")}
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        mode === "reset-password"
                          ? "Enter a new password"
                          : "Enter your password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                      onClick={() =>
                        setShowPassword((current) => {
                          const next = !current;
                          if (mode === "signup" || mode === "reset-password") {
                            setShowConfirmPassword(next);
                          }
                          return next;
                        })
                      }
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : null}

              {mode === "signup" || mode === "reset-password" ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                      onClick={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : null}

              {mode === "login" ? (
                <p className="text-sm leading-6 text-slate-600">
                  Sign in with your email and password, or continue with Google.
                </p>
              ) : null}

              {mode === "signup" ? (
                <p className="text-sm leading-6 text-slate-600">
                  Create your account with email and password. Google sign-in is also available below.
                </p>
              ) : null}

              {mode === "forgot-password" ? (
                <p className="text-sm leading-6 text-slate-600">
                  Enter your email address and we will send you a password reset link.
                </p>
              ) : null}

              {mode === "reset-password" ? (
                <p className="text-sm leading-6 text-slate-600">
                  Choose a new password for your account, then use it the next time you log in.
                </p>
              ) : null}

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {message ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {message}
                </p>
              ) : null}

              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </form>

            {mode === "login" || mode === "signup" ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span className="bg-white px-2">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleAuth}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <Chrome className="h-4 w-4" />
                      Google
                    </>
                  )}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
