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

const CYCLE: OumExpression[] = [
  "happy",
  "excited",
  "wink",
  "surprised",
  "confused",
  "sad",
  "angry",
  "sleepy",
  "normal",
];

/**
 * OUM avatar on the REAL logo artwork (public/oum-avatar.png — transparent
 * robot, eyes cleared) + 1:1 vector expression layer (crop-local 840x560),
 * matched to the reference expression sheet:
 * happy ∩∩ · angry slanted · sad droop + blue tears · surprised solid-round ·
 * excited gold stars · confused mismatched · wink · sleepy lids + zzz.
 * Interactions: cursor-tracked pupils (2px steps) · 4s blink · wink on
 * Get-Started hover/focus · excited while the hero film plays · sleepy when
 * the page idles · click / Enter / Space cycles expressions with a bounce.
 */
const W = 840;
const H = 560;
const L = { x: 238, y: 165, w: 154, h: 145 };
const R = { x: 478, y: 165, w: 154, h: 145 };

export function OumAvatar({
  className = "",
  onExpressionChange,
}: {
  className?: string;
  onExpressionChange?: (e: OumExpression) => void;
}) {
  const [expr, setExpr] = useState<OumExpression>("normal");
  const [pupil, setPupil] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [bounce, setBounce] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const revert = useRef<number | undefined>(undefined);

  useEffect(() => {
    onExpressionChange?.(expr);
  }, [expr, onExpressionChange]);

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

  const cycle = () => {
    const next = CYCLE[(CYCLE.indexOf(expr) + 1) % CYCLE.length] ?? "normal";
    window.clearTimeout(revert.current);
    setExpr(next);
    revert.current = window.setTimeout(() => setExpr("normal"), 2500);
  };

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
      d={
        up
          ? `M${z.x} ${z.y + 110} Q${z.x + 77} ${z.y - 20} ${z.x + 154} ${z.y + 110}`
          : `M${z.x} ${z.y + 40} Q${z.x + 77} ${z.y + 175} ${z.x + 154} ${z.y + 40}`
      }
      fill="none"
      stroke="#0B0C0A"
      strokeWidth={20}
      strokeLinecap="round"
    />
  );
  const tear = (key: string, x: number, y: number) => (
    <g key={key}>
      <circle cx={x} cy={y} r={13} fill="#7FB3D5" stroke="#0B0C0A" strokeWidth={5} />
      <rect x={x - 13} y={y - 30} width={26} height={24} rx={8} fill="#7FB3D5" stroke="#0B0C0A" strokeWidth={5} />
    </g>
  );

  return (
    <div
      ref={boxRef}
      role="button"
      tabIndex={0}
      aria-label={`OUM robot avatar, feeling ${expr} — activate to change expression`}
      onClick={cycle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cycle();
        }
      }}
      className={`avatar-bob relative w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${className}`}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
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
          {tear("t1", L.x + 40, L.y + 185)}{tear("t2", R.x + 114, R.y + 185)}
        </g>
        <g display={on("surprised")}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} rx={70} fill="#0B0C0A" />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={70} fill="#0B0C0A" />
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
