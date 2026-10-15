"use client";

import { useEffect, useRef, useState } from "react";

export type OumExpression =
  | "normal"
  | "happy"
  | "angry"
  | "sad"
  | "surprised"
  | "excited"
  | "confused"
  | "wink"
  | "sleepy";

/**
 * OUM avatar built on the REAL logo artwork (public/oum-avatar.png — the
 * production logo with its eyes digitally cleared), with a vector expression
 * layer mapped 1:1 onto the logo's eye zones (crop-local coords, 840x560).
 * · pupils follow the cursor (quantized to 2px pixel steps) · blinks ~every 4s
 * · winks when "[data-cta]" (Get Started) is hovered or focused
 * · excited while the hero film plays · sleepy after 40 s of page idleness
 * · honors prefers-reduced-motion (static normal face)
 */
const W = 840;
const H = 560;
// eye zones in crop-local coords (measured from the real logo)
const L = { x: 238, y: 165, w: 154, h: 145 };
const R = { x: 478, y: 165, w: 154, h: 145 };

export function OumAvatar({ className = "" }: { className?: string }) {
  const [expr, setExpr] = useState<OumExpression>("normal");
  const [pupil, setPupil] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const revert = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const q = (v: number) => Math.max(-6, Math.min(6, Math.round(v / 2) * 2));

    const onMove = (e: MouseEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.42;
      setPupil({ x: q(((e.clientX - cx) / r.width) * 30), y: q(((e.clientY - cy) / r.height) * 22) });
      setExpr((p) => (p === "sleepy" ? "normal" : p));
    };
    const flash = (next: OumExpression, ms: number) => {
      window.clearTimeout(revert.current);
      setExpr(next);
      revert.current = window.setTimeout(() => setExpr("normal"), ms);
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('[data-cta="get-started"]')) flash("wink", 1600);
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('[data-cta="get-started"]')) flash("wink", 1600);
    };
    const onVideoPlay = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) flash("excited", 3200);
    };
    let idle = window.setTimeout(() => setExpr("sleepy"), 40000);
    const poke = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(() => setExpr("sleepy"), 40000);
    };
    // natural blink: 140 ms lid-close every ~4.5 s (skipped while busy)
    const blink = window.setInterval(() => {
      setExpr((p) => {
        if (p !== "normal") return p;
        window.setTimeout(() => setExpr("normal"), 140);
        return "sleepy";
      });
    }, 4500);

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("play", onVideoPlay, true);
    document.addEventListener("keydown", poke, { passive: true });
    document.addEventListener("click", poke, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("play", onVideoPlay, true);
      document.removeEventListener("keydown", poke);
      document.removeEventListener("click", poke);
      window.clearTimeout(revert.current);
      window.clearTimeout(idle);
      window.clearInterval(blink);
    };
  }, []);

  const on = (k: OumExpression) => (expr === k ? undefined : "none");
  const eye = (key: string, z: typeof L) => (
    <g key={key}>
      <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={26} fill="#0B0C0A" />
      <circle cx={z.x + 57 + pupil.x} cy={z.y + 60 + pupil.y} r={19} fill="#F3E7CE" />
      <circle cx={z.x + 117 + pupil.x} cy={z.y + 102 + pupil.y} r={9} fill="#F3E7CE" />
    </g>
  );
  const arc = (key: string, z: typeof L, up: boolean) => (
    <path
      key={key}
      d={up ? `M${z.x} ${z.y + 110} Q${z.x + 77} ${z.y - 20} ${z.x + 154} ${z.y + 110}` : `M${z.x} ${z.y + 40} Q${z.x + 77} ${z.y + 175} ${z.x + 154} ${z.y + 40}`}
      fill="none"
      stroke="#0B0C0A"
      strokeWidth={20}
      strokeLinecap="round"
    />
  );

  return (
    <div ref={boxRef} className={`relative w-full ${className}`} style={{ aspectRatio: `${W} / ${H}` }}>
      <img
        src="/oum-avatar.png"
        alt=""
        aria-hidden="true"
        width={W}
        height={H}
        className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]"
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`OUM robot avatar, expression: ${expr}`}
        className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
      >
        <g display={on("normal")}>{eye("n1", L)}{eye("n2", R)}</g>
        <g display={on("happy")}>{arc("h1", L, true)}{arc("h2", R, true)}</g>
        <g display={on("angry")}>
          <polygon points={`${L.x},${L.y + 24} ${L.x + 154},${L.y + 44} ${L.x + 154},${L.y + 118} ${L.x},${L.y + 118}`} fill="#0B0C0A" />
          <polygon points={`${R.x + 154},${R.y + 24} ${R.x},${R.y + 44} ${R.x},${R.y + 118} ${R.x + 154},${R.y + 118}`} fill="#0B0C0A" />
        </g>
        <g display={on("sad")}>
          {arc("s1", L, false)}{arc("s2", R, false)}
          <circle cx={L.x + 128} cy={L.y + 132} r={10} fill="#8FB06E" />
        </g>
        <g display={on("surprised")}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} rx={70} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={8} />
          <circle cx={L.x + 77} cy={L.y + 72} r={17} fill="#0B0C0A" />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={70} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={8} />
          <circle cx={R.x + 77} cy={R.y + 72} r={17} fill="#0B0C0A" />
        </g>
        <g display={on("confused")}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} rx={26} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={6} />
          <circle cx={L.x + 50 + pupil.x} cy={L.y + 95 + pupil.y} r={19} fill="#0B0C0A" />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={26} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={6} />
          <circle cx={R.x + 104 + pupil.x} cy={R.y + 50 + pupil.y} r={19} fill="#0B0C0A" />
        </g>
        <g display={on("wink")}>
          <path d={`M${L.x} ${L.y + 100} Q${L.x + 77} ${L.y - 10} ${L.x + 154} ${L.y + 100}`} fill="none" stroke="#0B0C0A" strokeWidth={20} strokeLinecap="round" />
          {eye("w2", R)}
        </g>
        <g display={on("excited")}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} rx={26} fill="#0B0C0A" />
          <path d={`M${L.x + 45} ${L.y + 25} L${L.x + 55} ${L.y + 60} L${L.x + 90} ${L.y + 70} L${L.x + 55} ${L.y + 80} L${L.x + 45} ${L.y + 115} L${L.x + 35} ${L.y + 80} L${L.x} ${L.y + 70} L${L.x + 35} ${L.y + 60} Z`} fill="#FFD56B" />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={26} fill="#0B0C0A" />
          <path d={`M${R.x + 45} ${R.y + 25} L${R.x + 55} ${R.y + 60} L${R.x + 90} ${R.y + 70} L${R.x + 55} ${R.y + 80} L${R.x + 45} ${R.y + 115} L${R.x + 35} ${R.y + 80} L${R.x} ${R.y + 70} L${R.x + 35} ${R.y + 60} Z`} fill="#FFD56B" />
        </g>
        <g display={on("sleepy")}>
          <path d={`M${L.x} ${L.y + 90} H${L.x + 154}`} stroke="#0B0C0A" strokeWidth={20} strokeLinecap="round" />
          <path d={`M${R.x} ${R.y + 90} H${R.x + 154}`} stroke="#0B0C0A" strokeWidth={20} strokeLinecap="round" />
          <text x={L.x + 160} y={L.y + 30} fill="#F3E7CE" fontSize={56} fontWeight={800} fontFamily="'JetBrains Mono', monospace">z</text>
          <text x={L.x + 200} y={L.y - 20} fill="#F3E7CE" fontSize={38} fontWeight={800} fontFamily="'JetBrains Mono', monospace">z</text>
        </g>
      </svg>
    </div>
  );
}
