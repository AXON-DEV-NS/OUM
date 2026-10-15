"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { buttonVariants } from "@/components/ui/button";

/**
 * Accessible video modal — same film, with controls + audio, restarted at 0.
 * Focus trap, Esc to close, backdrop click to close, focus restored on close.
 */
export function VideoModalButton({
  children,
  className,
  playAudio = true,
}: {
  children: React.ReactNode;
  className?: string;
  playAudio?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = 0;
      void vid.play().catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], video, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={["pixel-btn", buttonVariants({ variant: "secondary", size: "lg" }), className]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          track("modal_open", { source: "see_how_it_works" });
          setOpen(true);
        }}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/80 p-4 sm:p-8"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="OUM product film"
            className="pixel-frame relative w-full max-w-4xl bg-ink"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close video"
              className="pixel-btn absolute -top-3 -right-3 z-10 bg-gold-500 px-3 py-1 font-mono text-sm font-bold text-ink"
            >
              ✕
            </button>
            <video
              ref={videoRef}
              className="h-auto w-full [image-rendering:pixelated]"
              poster="/media/oum-intro-poster.png"
              controls
              playsInline
              preload="metadata"
              muted={!playAudio}
              aria-label="OUM product film with controls"
            >
              <source src="/media/oum-intro.webm" type="video/webm" />
              <source src="/media/oum-intro.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      )}
    </>
  );
}
