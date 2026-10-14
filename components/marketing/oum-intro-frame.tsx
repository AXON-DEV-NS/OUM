"use client";

import { useEffect, useRef, useState } from "react";

/**
 * OUM intro scene — embedded as a clean isolated <iframe> so the scene's own
 * CSS (RTL, pixel fonts, fixed 8K stage) can never leak into the site.
 * Scales the 7680x4320 composition down to the column width with a transform.
 */
const STAGE_W = 7680;
const STAGE_H = 4320;

export function OumIntroFrame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / STAGE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "16 / 9" }}
    >
      {scale > 0 && (
        <iframe
          title="OUM autonomous YouTube director intro"
          src="/oum-intro.html"
          loading="lazy"
          scrolling="no"
          className="absolute left-0 top-0"
          style={{
            width: `${STAGE_W}px`,
            height: `${STAGE_H}px`,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}
