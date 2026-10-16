"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { useTransitionStore } from "@/lib/transition-store";
import { Loader2 } from "lucide-react";
import { auth, googleProvider, githubProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

type Mode = "signup" | "signin";

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GoogleSignInButton({ label, returnUrl }: { label: string; returnUrl?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    setLoading(true);
    const fbAuth = auth;
    if (!fbAuth) {
      setError("Google sign-in isn't configured yet. Please use the email verification code instead.");
      setLoading(false);
      return;
    }
    try {
      const result = await signInWithPopup(fbAuth, googleProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        window.location.href = returnUrl || data.redirect || "/dashboard";
        return;
      }

      setError(data.error || "Failed to authenticate with server. Please try again.");
      setLoading(false);
    } catch (err: any) {
      console.error("[Firebase Auth Error Details]:", err);
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        setLoading(false);
        return;
      }
      if (err?.code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else if (err?.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).");
      } else if (err?.code === "auth/internal-error" || err?.code === "auth/configuration-not-found") {
        setError("Firebase configuration error: Please make sure Google Sign-in is enabled in Firebase Console (Authentication > Sign-in method > Google), with a Project Support Email selected and saved.");
      } else {
        setError(err?.message || "Google sign-in failed. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <Button
        variant="secondary"
        size="lg"
        className="mb-4 w-full"
        onClick={onClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        {loading ? "Signing in..." : label}
      </Button>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

function GithubGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.13 0 .31.2.68.8.56A10.52 10.52 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function GithubSignInButton({ label, returnUrl }: { label: string; returnUrl?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    setLoading(true);
    const fbAuth = auth;
    if (!fbAuth) {
      setError("GitHub sign-in isn't configured yet. Please use the email verification code instead.");
      setLoading(false);
      return;
    }
    try {
      const result = await signInWithPopup(fbAuth, githubProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        window.location.href = returnUrl || data.redirect || "/dashboard";
        return;
      }

      setError(data.error || "Failed to authenticate with server. Please try again.");
      setLoading(false);
    } catch (err: any) {
      console.error("[GitHub Auth Error Details]:", err);
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        setLoading(false);
        return;
      }
      if (err?.code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else if (err?.code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with this email through another sign-in method. Use that method instead.");
      } else if (err?.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).");
      } else {
        setError(err?.message || "GitHub sign-in failed. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <Button
        variant="secondary"
        size="lg"
        className="mb-4 w-full"
        onClick={onClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GithubGlyph />
        )}
        {loading ? "Signing in..." : label}
      </Button>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

interface FormShellProps {
  onToggle: () => void;
  returnUrl?: string;
  onSwitchMode?: (mode: Mode) => void;
}

function SignInForm({ onToggle, returnUrl }: FormShellProps) {
  return (
    <div className="w-full max-w-sm">
      <h1 className="display text-3xl font-semibold text-ink">Welcome back</h1>
      <p className="mb-8 mt-2 text-ink-mute">Continue where you left off.</p>

      <GoogleSignInButton label="Continue with Google" returnUrl={returnUrl} />
      <GithubSignInButton label="Continue with GitHub" returnUrl={returnUrl} />

      <p className="mt-8 text-center text-sm text-ink-mute">
        New here?{" "}
        <button onClick={onToggle} className="link-underline font-medium text-ink">
          Create an account
        </button>
      </p>
    </div>
  );
}

function SignUpForm({ onToggle, returnUrl }: FormShellProps) {
  return (
    <div className="w-full max-w-sm">
      <h1 className="display text-3xl font-semibold text-ink">Create your account</h1>
      <p className="mb-8 mt-2 text-ink-mute">Put your channel on autopilot.</p>

      <GoogleSignInButton label="Sign up with Google" returnUrl={returnUrl} />
      <GithubSignInButton label="Sign up with GitHub" returnUrl={returnUrl} />

      <p className="mt-8 text-center text-sm text-ink-mute">
        Already have an account?{" "}
        <button onClick={onToggle} className="link-underline font-medium text-ink">
          Sign in
        </button>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const returnUrl = searchParams.get("return_url") || undefined;
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "signin" ? "signin" : "signup"
  );
  const [panelCopy, setPanelCopy] = useState<Mode>(() =>
    searchParams.get("mode") === "signin" ? "signin" : "signup"
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  // Resolve the "Get Started" expand transition: shrink the fullscreen
  // black overlay into the side panel once this screen is mounted under it.
  useEffect(() => {
    const state = useTransitionStore.getState();
    if (state.phase === "covered" || state.phase === "expanding") {
      setMode(state.target);
      setPanelCopy(state.target);
      const t = window.setTimeout(() => {
        useTransitionStore.getState().startShrink();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, []);

  function toggle() {
    const next: Mode = mode === "signup" ? "signin" : "signup";
    setMode(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPanelCopy(next), 380);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const panelContent = (
    <>
      <Link href="/" className="group mb-10 inline-flex transition-opacity hover:opacity-80">
        <Logo variant="paper" size="lg" />
      </Link>

      <div key={panelCopy} className="animate-fade-in">
        {panelCopy === "signup" ? (
          <>
            <h2 className="display text-display-md">
              Let AI run your channel while you focus on the craft.
            </h2>
            <p className="mt-5 max-w-sm leading-relaxed text-paper/70">
              Connect your channel, set your niche, and the agent handles the
              rest — around the clock.
            </p>
          </>
        ) : (
          <>
            <h2 className="display text-display-md">Welcome back.</h2>
            <p className="mt-5 max-w-sm leading-relaxed text-paper/70">
              Your channel has been growing. Pick up where you left off and see
              what the agent has been working on.
            </p>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-paper">
      {/* ============ Desktop: sliding panel ============ */}
      <div className="hidden lg:block">
        {/* Sign In form — left half */}
        <div className="absolute inset-y-0 left-0 z-0 flex w-1/2 items-center justify-center px-10">
          <SignInForm onToggle={toggle} returnUrl={returnUrl} onSwitchMode={setMode} />
        </div>
        {/* Sign Up form — right half */}
        <div className="absolute inset-y-0 right-0 z-0 flex w-1/2 items-center justify-center px-10">
          <SignUpForm onToggle={toggle} returnUrl={returnUrl} onSwitchMode={setMode} />
        </div>

        {/* Dark panel — slides left <-> right */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 z-10 flex w-1/2 items-center bg-ink px-14 text-paper-high",
            "transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
            mode === "signup" ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div
            aria-hidden="true"
            className={cn("absolute inset-y-0 w-2", mode === "signup" ? "right-0" : "left-0")}
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, #E8DFC8 0 8px, transparent 8px 16px)",
            }}
          />
          <div className="w-full">{panelContent}</div>
        </div>
      </div>

      {/* ============ Mobile: stacked with fade ============ */}
      <div className="lg:hidden">
        <div className="bg-ink px-6 pb-10 pt-12 text-paper-high">
          <Link href="/" className="mb-8 inline-flex">
            <Logo variant="paper" size="sm" />
          </Link>
          <div key={panelCopy} className="animate-fade-in">
            <h2 className="display text-2xl leading-snug">
              {panelCopy === "signup"
                ? "Let AI run your channel while you focus on the craft."
                : "Welcome back."}
            </h2>
          </div>
        </div>

        <div className="px-6 py-10">
          <div key={mode} className="animate-fade-in">
            {mode === "signup" ? (
              <SignUpForm onToggle={toggle} returnUrl={returnUrl} onSwitchMode={setMode} />
            ) : (
              <SignInForm onToggle={toggle} returnUrl={returnUrl} onSwitchMode={setMode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
