"use client";

import { useState } from "react";
import { OumAvatar, type OumExpression } from "./oum-avatar";

const MOOD_LINES: Record<OumExpression, string> = {
  normal: "Systems nominal. Channel growing.",
  happy: "New subscriber! Happy wiggle.",
  angry: "Spam comments detected. Deleting.",
  sad: "Retention dipped... analyzing why.",
  surprised: "Whoa — viral spike incoming!",
  excited: "Publishing now! Gold-star quality.",
  confused: "Hmm, unusual trend pattern...",
  wink: "Psst — I scheduled your Shorts.",
  sleepy: "Zzz... still watching analytics.",
};

/**
 * "Meet OUM" — pixel-art host stage: dark panel, scanlines, HUD status line
 * with blinking LED, the interactive avatar, and its live speech line.
 */
export function MeetOum() {
  const [mood, setMood] = useState<OumExpression>("normal");

  return (
    <section id="meet-oum" className="section-padding bg-paper">
      <div className="container-wide grid items-center gap-12 lg:grid-cols-2">
        <div className="flex justify-center lg:justify-start">
          <div className="pixel-frame-outer w-full max-w-[520px]">
            <div className="pixel-frame relative bg-ink p-6">
              <div className="mb-4 flex items-center gap-3" aria-hidden="true">
                <span className="hud-led-blink inline-block h-3 w-3 bg-green-400" />
                <span className="font-mono text-xs font-bold tracking-widest text-gold-400">
                  OUM // ONLINE
                </span>
              </div>
              <OumAvatar onExpressionChange={setMood} />
              <div className="px-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
              <p className="mt-4 min-h-12 border-t-2 border-dashed border-white/15 bg-ink px-4 py-3 font-mono text-sm text-paper-high" aria-live="polite">
                <span className="text-gold-400">&gt; </span>{MOOD_LINES[mood]}
              </p>
            </div>
          </div>
        </div>
        <div>
          <span className="eyebrow eyebrow--gold">Meet OUM</span>
          <h2 className="display mt-5 text-display-md">Connect once. Relax.</h2>
          <ul className="mt-7 space-y-4 text-lg leading-relaxed text-ink-soft">
            <li className="flex gap-3">
              <span className="mt-2.5 h-2 w-2 shrink-0 bg-gold-500" aria-hidden="true" />
              OUM researches your niche, rivals and trends — and scripts the hook that keeps viewers.
            </li>
            <li className="flex gap-3">
              <span className="mt-2.5 h-2 w-2 shrink-0 bg-gold-500" aria-hidden="true" />
              It produces, quality-checks and publishes on your schedule — or waits for your one-click approval.
            </li>
            <li className="flex gap-3">
              <span className="mt-2.5 h-2 w-2 shrink-0 bg-gold-500" aria-hidden="true" />
              Every week you get a clear report. You stay in control. It never sleeps.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
