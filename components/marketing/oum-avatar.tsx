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
 * OUM avatar in TRUE pixel-art: chunky 8px-quantized raster base
 * (public/oum-avatar-px.png, 105x70 nearest-neighbor + posterized) with a
 * vector expression layer snapped to the same 8px grid, crispEdges on, square
 * eyes/pupils that jump in 8px steps. Same behaviors: cursor tracking, 4s
 * blink, wink on Get-Started hover/focus, excited on film play, sleepy idle,
 * click/keyboard expression cycling with speech lines, reduced-motion safe.
 */
const W = 840;
const H = 560;
const L = { x: 240, y: 168, w: 152, h: 144 };
const R = { x: 480, y: 168, w: 152, h: 144 };

export function OumAvatar({
  className = "",
  onExpressionChange,
}: {
  className?: string;
  onExpressionChange?: (e: OumExpression) => void;
}) {
  const [expr, setExpr] = useState<OumExpression>("normal");
  const [pupil, setPupil] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const revert = useRef<number | undefined>(undefined);

  useEffect(() => {
    onExpressionChange?.(expr);
  }, [expr, onExpressionChange]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const q = (v: number) => Math.max(-8, Math.min(8, Math.round(v / 8) * 8));

    const onMove = (e: MouseEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.42;
      setPupil({ x: q(((e.clientX - cx) / r.width) * 40), y: q(((e.clientY - cy) / r.height) * 28) });
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
      <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="#0B0C0A" />
      <rect x={z.x + 40 + pupil.x} y={z.y + 40 + pupil.y} width={36} height={36} fill="#F3E7CE" />
      <rect x={z.x + 104 + pupil.x} y={z.y + 96 + pupil.y} width={18} height={18} fill="#F3E7CE" />
    </g>
  );
  const arc = (key: string, z: typeof L, up: boolean) => (
    <path
      key={key}
      d={
        up
          ? `M${z.x} ${z.y + 112} Q${z.x + 76} ${z.y - 24} ${z.x + 152} ${z.y + 112}`
          : `M${z.x} ${z.y + 40} Q${z.x + 76} ${z.y + 176} ${z.x + 152} ${z.y + 40}`
      }
      fill="none"
      stroke="#0B0C0A"
      strokeWidth={20}
      strokeLinecap="square"
    />
  );
  const tear = (key: string, x: number, y: number) => (
    <g key={key}>
      <rect x={x - 12} y={y} width={24} height={24} fill="#7FB3D5" stroke="#0B0C0A" strokeWidth={4} />
      <rect x={x - 12} y={y - 32} width={24} height={28} fill="#7FB3D5" stroke="#0B0C0A" strokeWidth={4} />
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
        src="/oum-avatar-px.png"
        alt=""
        aria-hidden="true"
        width={105}
        height={70}
        className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`OUM robot avatar, expression: ${expr}`}
        className="absolute inset-0 h-full w-full"
      >
        <g display={on("normal")}>{eye("n1", L)}{eye("n2", R)}</g>
        <g display={on("happy")}>{arc("h1", L, true)}{arc("h2", R, true)}</g>
        <g display={on("angry")}>
          <polygon points={`${L.x},${L.y + 24} ${L.x + 152},${L.y + 48} ${L.x + 152},${L.y + 120} ${L.x},${L.y + 120}`} fill="#0B0C0A" />
          <polygon points={`${R.x + 152},${R.y + 24} ${R.x},${R.y + 48} ${R.x},${R.y + 120} ${R.x + 152},${R.y + 120}`} fill="#0B0C0A" />
        </g>
        <g display={on("sad")}>
          {arc("s1", L, false)}{arc("s2", R, false)}
          {tear("t1", L.x + 40, L.y + 184)}{tear("t2", R.x + 112, R.y + 184)}
        </g>
        <g display={on("surprised")}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} fill="#0B0C0A" />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} fill="#0B0C0A" />
        </g>
        <g display={on("confused")}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={8} />
          <rect x={L.x + 32 + pupil.x} y={L.y + 80 + pupil.y} width={36} height={36} fill="#0B0C0A" />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={8} />
          <rect x={R.x + 84 + pupil.x} y={R.y + 28 + pupil.y} width={36} height={36} fill="#0B0C0A" />
        </g>
        <g display={on("wink")}>
          <path d={`M${L.x} ${L.y + 104} Q${L.x + 76} ${L.y - 16} ${L.x + 152} ${L.y + 104}`} fill="none" stroke="#0B0C0A" strokeWidth={20} strokeLinecap="square" />
          {eye("w2", R)}
        </g>
        <g display={on("excited")}>
          <rect x={L.x} y={L.y} width={L.w} height={L.h} fill="#0B0C0A" />
          <path d={`M${L.x + 48} ${L.y + 24} h56 v32 h-24 v56 h-32 v-56 h-24 Z`} fill="#FFD56B" />
          <rect x={R.x} y={R.y} width={R.w} height={R.h} fill="#0B0C0A" />
          <path d={`M${R.x + 48} ${R.y + 24} h56 v32 h-24 v56 h-32 v-56 h-24 Z`} fill="#FFD56B" />
        </g>
        <g display={on("sleepy")}>
          <path d={`M${L.x} ${L.y + 88} H${L.x + 152}`} stroke="#0B0C0A" strokeWidth={20} strokeLinecap="square" />
          <path d={`M${R.x} ${R.y + 88} H${R.x + 152}`} stroke="#0B0C0A" strokeWidth={20} strokeLinecap="square" />
          <text x={L.x + 160} y={L.y + 32} fill="#F3E7CE" fontSize={56} fontWeight={800} fontFamily="'JetBrains Mono', monospace">z</text>
          <text x={L.x + 200} y={L.y - 24} fill="#F3E7CE" fontSize={40} fontWeight={800} fontFamily="'JetBrains Mono', monospace">z</text>
        </g>
      </svg>
    </div>
  );
}
