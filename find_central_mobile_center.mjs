// Filter candidates where cx is between 400 and 680 (near horizontal center)
import fs from "fs";

function distBox(cx, cy, xmin, xmax, ymin, ymax) {
  const dx = Math.max(0, Math.max(xmin - cx, cx - xmax));
  const dy = Math.max(0, Math.max(ymin - cy, cy - ymax));
  const minD = Math.hypot(dx, dy);
  const corners = [
    [xmin, ymin], [xmax, ymin], [xmin, ymax], [xmax, ymax]
  ];
  const maxD = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return { minD, maxD };
}

function easeProg(frame, start, dur) {
  const t = Math.max(0, Math.min(1, (frame - start) / dur));
  return 0.5 * (1 - Math.cos(Math.PI * t));
}

const desk = { xmin: 398.0, xmax: 743.0, ymin: 576.1, ymax: 984.4 };
const sofa = { xmin: 420.8, xmax: 910.4, ymin: 1023.6, ymax: 1268.4 };
const feather = 25.0;

const results = [];
for (let cx = 350; cx <= 750; cx += 10) {
  for (let cy = 400; cy <= 1100; cy += 10) {
    const d = distBox(cx, cy, desk.xmin, desk.xmax, desk.ymin, desk.ymax);
    const s = distBox(cx, cy, sofa.xmin, sofa.xmax, sofa.ymin, sofa.ymax);

    const inter = Math.max(0, Math.min(d.maxD, s.maxD) - Math.max(d.minD, s.minD));
    const spanD = d.maxD - d.minD;
    const spanS = s.maxD - s.minD;
    const overlapPct = (inter / Math.min(spanD, spanS)) * 100;

    if (overlapPct >= 65.0) {
      const r0 = Math.min(d.minD, s.minD) - feather;
      const r1 = Math.max(d.maxD, s.maxD) + feather;

      let firstDeskErase = null;
      let firstSofaReveal = null;
      let framesCrossing = 0;
      let bothVisibleFrames = 0;

      for (let f = 0; f < 36; f++) {
        const prog = easeProg(f, 0, 35);
        const r = r0 + (r1 - r0) * prog;

        if (r + feather >= d.minD && firstDeskErase === null) firstDeskErase = f;
        if (r + feather >= s.minD && firstSofaReveal === null) firstSofaReveal = f;

        const crossD = (r + feather >= d.minD) && (r - feather <= d.maxD);
        const crossS = (r + feather >= s.minD) && (r - feather <= s.maxD);
        if (crossD || crossS) framesCrossing++;
        if (crossD && crossS) bothVisibleFrames++;
      }

      if (framesCrossing >= 30 && bothVisibleFrames >= 15 && Math.abs(d.minD - s.minD) <= 60) {
        results.push({
          diff: Math.abs(d.minD - s.minD),
          overlapPct,
          bothVisibleFrames,
          cx, cy, d, s, r0, r1,
          firstDeskErase, firstSofaReveal
        });
      }
    }
  }
}

results.sort((a, b) => a.diff - b.diff || b.bothVisibleFrames - a.bothVisibleFrames);
console.log(`Found ${results.length} symmetrical/central candidates:`);
for (const c of results.slice(0, 10)) {
  console.log(`Center (${c.cx}, ${c.cy}): diff=${c.diff.toFixed(1)}px, overlap=${c.overlapPct.toFixed(1)}%, both visible=${c.bothVisibleFrames}/36, Desk=[${c.d.minD.toFixed(1)}, ${c.d.maxD.toFixed(1)}], Sofa=[${c.s.minD.toFixed(1)}, ${c.s.maxD.toFixed(1)}], R0=${c.r0.toFixed(1)}, R1=${c.r1.toFixed(1)}, fDesk=f${c.firstDeskErase}, fSofa=f${c.firstSofaReveal}`);
}
