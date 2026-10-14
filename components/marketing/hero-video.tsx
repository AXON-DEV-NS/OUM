"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Hero video — the rendered OUM intro (30 s pixel film).
 * · reserved 16:9 box → zero layout shift · poster eager, video lazy
 * · paused off-screen (IntersectionObserver) · reduced-motion → poster only
 * · pixel-art frame: stepped corners, hard 8px shadow, faint CRT scanlines
 */
export function HeroVideo() {
  const boxRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = boxRef.current;
    const vid = vidRef.current;
    if (!el || !vid) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) void vid.play().catch(() => {});
          else vid.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    const onPlay = () => track("hero_video_play");
    vid.addEventListener("play", onPlay, { once: true });
    return () => {
      io.disconnect();
      vid.removeEventListener("play", onPlay);
    };
  }, [reduced]);

  return (
    <div ref={boxRef} className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
      <div className="pixel-frame absolute inset-0 overflow-hidden bg-ink">
        {reduced ? (
          <img
            src="/media/oum-intro-poster.png"
            alt="OUM autonomous YouTube director — product intro frame"
            className="h-full w-full object-cover [image-rendering:pixelated]"
            width={1920}
            height={1080}
          />
        ) : (
          <video
            ref={vidRef}
            className="h-full w-full object-cover [image-rendering:pixelated]"
            poster="/media/oum-intro-poster.png"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Silent 30-second pixel-art film: OUM, your autonomous YouTube director, runs research, scripting, production, quality checks, publishing and growth."
          >
            <source src="/media/oum-intro.webm" type="video/webm" />
            <source src="/media/oum-intro.mp4" type="video/mp4" />
            <track kind="captions" src="/media/oum-intro.vtt" srcLang="en" label="English" default />
          </video>
        )}
        <div className="px-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
      </div>
    </div>
  );
}
