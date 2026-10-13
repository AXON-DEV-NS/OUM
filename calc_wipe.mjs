// Accurate wipe mathematics for Desktop (1920x1080) and Mobile (1080x1350)

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

// Remotion / standard cubic-bezier easeInOut: t => 0.5 * (1 - Math.cos(Math.PI * t)) or smoothstep
function easeProg(frame, start, dur) {
  const t = Math.max(0, Math.min(1, (frame - start) / dur));
  return 0.5 * (1 - Math.cos(Math.PI * t));
}

console.log("=== 1. DESKTOP WIPE MATH (1920x1080) ===");
{
  const desk = { xmin: 1055.2, xmax: 1409.2, ymin: 446.2, ymax: 865.1 };
  const sofa = { xmin: 982.8, xmax: 1496.4, ymin: 718.6, ymax: 975.4 };
  const cx = 1580.0, cy = 480.0;
  const feather = 25.0;

  const d = distBox(cx, cy, desk.xmin, desk.xmax, desk.ymin, desk.ymax);
  const s = distBox(cx, cy, sofa.xmin, sofa.xmax, sofa.ymin, sofa.ymax);

  const inter = Math.max(0, Math.min(d.maxD, s.maxD) - Math.max(d.minD, s.minD));
  const spanD = d.maxD - d.minD;
  const spanS = s.maxD - s.minD;
  const overlapPct = (inter / Math.min(spanD, spanS)) * 100;

  const r0 = Math.min(d.minD, s.minD) - feather;
  const r1 = Math.max(d.maxD, s.maxD) + feather;

  console.log(`Center: (${cx}, ${cy})`);
  console.log(`Desk range: [${d.minD.toFixed(1)}, ${d.maxD.toFixed(1)}] px (span ${spanD.toFixed(1)} px)`);
  console.log(`Sofa range: [${s.minD.toFixed(1)}, ${s.maxD.toFixed(1)}] px (span ${spanS.toFixed(1)} px)`);
  console.log(`Overlap: ${inter.toFixed(1)} px (${overlapPct.toFixed(1)}%)`);
  console.log(`R0: ${r0.toFixed(1)} px, R1: ${r1.toFixed(1)} px, Feather: ${feather} px`);

  let firstDeskErase = null;
  let firstSofaReveal = null;
  let framesCrossing = 0;
  let bothVisibleFrames = 0;

  for (let f = 0; f < 36; f++) {
    const prog = easeProg(f, 0, 35);
    const r = r0 + (r1 - r0) * prog;

    // Outer edge of feathered circle is r + feather
    // Inner edge is r - feather
    if (r + feather >= d.minD && firstDeskErase === null) firstDeskErase = f;
    if (r + feather >= s.minD && firstSofaReveal === null) firstSofaReveal = f;

    const crossD = (r + feather >= d.minD) && (r - feather <= d.maxD);
    const crossS = (r + feather >= s.minD) && (r - feather <= s.maxD);
    if (crossD || crossS) framesCrossing++;
    if (crossD && crossS) bothVisibleFrames++;
  }

  console.log(`First frame desk begins erase: frame f${firstDeskErase} (f${280 + firstDeskErase})`);
  console.log(`First frame sofa begins reveal: frame f${firstSofaReveal} (f${280 + firstSofaReveal})`);
  console.log(`Frames crossing bounding boxes: ${framesCrossing} / 36`);
  console.log(`Frames BOTH figures simultaneously visible: ${bothVisibleFrames} / 36`);
}

console.log("\n=== 2. MOBILE WIPE MATH (1080x1350) ===");
{
  // Mobile layout on 1080x1350:
  // Desk: desk.x=260, y=460, scale=1.15
  const desk = { xmin: 398.0, xmax: 743.0, ymin: 576.1, ymax: 984.4 };
  // Sofa: rest.x=380, y=840, scale=1.02
  const sofa = { xmin: 420.8, xmax: 910.4, ymin: 1023.6, ymax: 1268.4 };
  
  // On mobile 1080x1350, logo center is (540, 160)
  // Let's test wipe center (540, 280) vs (540, 160)
  for (const cy of [160, 260, 320]) {
    const cx = 540.0;
    const feather = 25.0;

    const d = distBox(cx, cy, desk.xmin, desk.xmax, desk.ymin, desk.ymax);
    const s = distBox(cx, cy, sofa.xmin, sofa.xmax, sofa.ymin, sofa.ymax);

    const inter = Math.max(0, Math.min(d.maxD, s.maxD) - Math.max(d.minD, s.minD));
    const spanD = d.maxD - d.minD;
    const spanS = s.maxD - s.minD;
    const overlapPct = (inter / Math.min(spanD, spanS)) * 100;

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

    console.log(`\nCandidate Mobile Center: (${cx}, ${cy})`);
    console.log(`Desk range: [${d.minD.toFixed(1)}, ${d.maxD.toFixed(1)}] px, Sofa range: [${s.minD.toFixed(1)}, ${s.maxD.toFixed(1)}] px`);
    console.log(`Overlap: ${inter.toFixed(1)} px (${overlapPct.toFixed(1)}%)`);
    console.log(`R0: ${r0.toFixed(1)} px, R1: ${r1.toFixed(1)} px`);
    console.log(`First desk erase: f${firstDeskErase}, First sofa reveal: f${firstSofaReveal}, Crossing: ${framesCrossing}/36, Both visible: ${bothVisibleFrames}/36`);
  }
}
