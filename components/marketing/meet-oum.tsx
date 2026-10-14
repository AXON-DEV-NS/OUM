import { OumAvatar } from "./oum-avatar";

/**
 * "Meet OUM" — the host section under the hero.
 * Avatar (eye-tracking, expressions) + three-line "Connect once. Relax." summary.
 */
export function MeetOum() {
  return (
    <section id="meet-oum" className="section-padding bg-paper">
      <div className="container-wide grid items-center gap-12 lg:grid-cols-2">
        <div className="flex justify-center lg:justify-start">
          <div className="pixel-frame-outer">
            <div className="pixel-frame bg-paper-high p-8">
              <OumAvatar className="w-[240px] sm:w-[280px]" />
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
