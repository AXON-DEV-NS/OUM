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
 * OUM avatar — the robot that runs the channels.
 * · pupils follow the cursor (quantized to 2px pixel steps)
 * · winks when "[data-cta]" (Get Started) is hovered or focused
 * · excited while the hero film plays · sleepy after 40 s of page idleness
 * · honors prefers-reduced-motion (static normal face)
 */
export function OumAvatar({ className = "" }: { className?: string }) {
  const [expr, setExpr] = useState<OumExpression>("normal");
  const [pupil, setPupil] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const boxRef = useRef<SVGSVGElement>(null);
  const revert = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const q = (v: number) => Math.max(-4, Math.min(4, Math.round(v / 2) * 2));

    const onMove = (e: MouseEvent) => {
      const svg = boxRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.45;
      setPupil({ x: q(((e.clientX - cx) / r.width) * 24), y: q(((e.clientY - cy) / r.height) * 16) });
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
    };
  }, []);

  const hidden = (k: OumExpression) => (expr === k ? "block" : "none");
  const eye = (
    key: string,
    x: number,
  ) => (
    <g key={key}>
      <rect x={x} y={90} width={46} height={46} rx={13} fill="#0B0C0A" />
      <circle cx={x + 14 + pupil.x} cy={104 + pupil.y} r={7.5} fill="#F3E7CE" />
      <circle cx={x + 32 + pupil.x} cy={124 + pupil.y} r={3.8} fill="#F3E7CE" />
    </g>
  );

  return (
    <svg
      ref={boxRef}
      viewBox="0 0 340 300"
      role="img"
      aria-label={`OUM robot avatar, expression: ${expr}`}
      className={`h-auto w-full max-w-[310px] [image-rendering:pixelated] ${className}`}
    >
      <g>
        {[78, 132, 208, 262].map((x, i) => (
          <g key={x} transform={`translate(${x} ${i % 2 ? 222 : 218}) rotate(${i === 0 ? 18 : i === 3 ? -18 : 0})`}>
            <rect x={-14} y={0} width={28} height={50} rx={14} fill="#181A16" stroke="#080907" strokeWidth={5} />
            <rect x={-11} y={20} width={22} height={26} rx={11} fill="#4A6238" />
            <circle cy={38} r={5} fill="#C8A858" />
          </g>
        ))}
        <g stroke="#080907" strokeWidth={6}>
          <rect x={18} y={98} width={46} height={62} rx={15} fill="#4A6238" />
          <rect x={276} y={98} width={46} height={62} rx={15} fill="#4A6238" />
        </g>
        <rect x={44} y={101} width={16} height={56} fill="#181A16" />
        <rect x={280} y={101} width={16} height={56} fill="#181A16" />
        <rect x={56} y={24} width={228} height={204} rx={34} fill="#181A16" stroke="#080907" strokeWidth={7} />
        <g fill="none" stroke="#C8A858" strokeWidth={5.5} strokeLinecap="round">
          <path d="M72 64Q72 40 98 40" /><path d="M268 64Q268 40 242 40" />
          <path d="M72 188Q72 212 98 212" /><path d="M268 188Q268 212 242 212" />
        </g>
        <g fill="#C8A858">
          <circle cx={114} cy={40} r={4} /><circle cx={72} cy={80} r={4} />
          <circle cx={226} cy={40} r={4} /><circle cx={268} cy={80} r={4} />
          <circle cx={114} cy={212} r={4} /><circle cx={72} cy={172} r={4} />
          <circle cx={226} cy={212} r={4} /><circle cx={268} cy={172} r={4} />
        </g>
        <rect x={86} y={52} width={168} height={148} rx={24} fill="#4A6238" stroke="#0E120C" strokeWidth={5} />

        <g style={{ display: hidden("normal") }}>{eye("n1", 108)}{eye("n2", 186)}</g>
        <g style={{ display: hidden("happy") }}>
          <path d="M110 120Q131 92 152 120" fill="none" stroke="#0B0C0A" strokeWidth={10} strokeLinecap="round" />
          <path d="M188 120Q209 92 230 120" fill="none" stroke="#0B0C0A" strokeWidth={10} strokeLinecap="round" />
        </g>
        <g style={{ display: hidden("angry") }}>
          <polygon points="106,94 154,110 154,136 106,136" fill="#0B0C0A" />
          <polygon points="234,94 186,110 186,136 234,136" fill="#0B0C0A" />
        </g>
        <g style={{ display: hidden("sad") }}>
          <path d="M110 108Q131 132 152 108" fill="none" stroke="#0B0C0A" strokeWidth={10} strokeLinecap="round" />
          <path d="M188 108Q209 132 230 108" fill="none" stroke="#0B0C0A" strokeWidth={10} strokeLinecap="round" />
          <circle cx={150} cy={140} r={5} fill="#8FB06E" />
        </g>
        <g style={{ display: hidden("surprised") }}>
          <rect x={108} y={90} width={46} height={46} rx={23} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={4} />
          <circle cx={131} cy={113} r={9} fill="#0B0C0A" />
          <rect x={186} y={90} width={46} height={46} rx={23} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={4} />
          <circle cx={209} cy={113} r={9} fill="#0B0C0A" />
        </g>
        <g style={{ display: hidden("confused") }}>
          <rect x={108} y={90} width={46} height={46} rx={13} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={3} />
          <circle cx={122} cy={118} r={10} fill="#0B0C0A" />
          <rect x={186} y={90} width={46} height={46} rx={13} fill="#F3E7CE" stroke="#0B0C0A" strokeWidth={3} />
          <circle cx={216} cy={106} r={10} fill="#0B0C0A" />
        </g>
        <g style={{ display: hidden("wink") }}>
          <path d="M110 118Q131 92 152 118" fill="none" stroke="#0B0C0A" strokeWidth={10} strokeLinecap="round" />
          {eye("w2", 186)}
        </g>
        <g style={{ display: hidden("excited") }}>
          <rect x={108} y={90} width={46} height={46} rx={13} fill="#0B0C0A" />
          <path d="M131 95L135 108L148 113L135 118L131 131L127 118L114 113L127 108Z" fill="#FFD56B" />
          <rect x={186} y={90} width={46} height={46} rx={13} fill="#0B0C0A" />
          <path d="M209 95L213 108L226 113L213 118L209 131L205 118L192 113L205 108Z" fill="#FFD56B" />
        </g>
        <g style={{ display: hidden("sleepy") }}>
          <path d="M110 112H152" stroke="#0B0C0A" strokeWidth={10} strokeLinecap="round" />
          <path d="M188 112H230" stroke="#0B0C0A" strokeWidth={10} strokeLinecap="round" />
          <text x={244} y={86} fill="#F3E7CE" fontSize={30} fontWeight={800} fontFamily="'JetBrains Mono', monospace">z</text>
          <text x={264} y={62} fill="#F3E7CE" fontSize={20} fontWeight={800} fontFamily="'JetBrains Mono', monospace">z</text>
        </g>
      </g>
    </svg>
  );
}
