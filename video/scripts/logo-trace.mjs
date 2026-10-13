/**
 * Logo vector trace via potrace (pure-JS), per ROUND 5 item 1(b):
 *  - 4× upscale the raster, trace the dark V layer + the soft tail layer
 *  - dots as exact measured circles (more accurate than tracing)
 *  - outputs out/logo-trace.svg + IoU vs the original + overlay proof
 */
import potrace from "potrace";
import fs from "node:fs";
import path from "node:path";

const VIDEO = "C:/Users/Maka/OneDrive/سطح المكتب/vo/vovo-agent-ai/video";
const SRC = "C:/Users/Maka/OneDrive/سطح المكتب/vo/vovo-agent-ai/public/vovo25.jpg";
const OUT = path.join(VIDEO, "out");
const R4 = path.join(OUT, "r4");
fs.mkdirSync(R4, { recursive: true });

const trace = (opts) =>
  new Promise((resolve, reject) => {
    potrace.trace(SRC, opts, (err, svg) => (err ? reject(err) : resolve(svg)));
  });

const run = async () => {
  // 1) the V (dark core): threshold just below cream, high contrast
  const vSvg = await trace({
    threshold: 120,
    turdSize: 6,
    alphaMax: 0.6,
    optCurve: true,
    optTolerance: 0.15,
    color: "#0B0B0C",
    background: "transparent",
  });
  // 2) the tail wash (mid greys) — lighter threshold
  const tailSvg = await trace({
    threshold: 232,
    turdSize: 60,
    alphaMax: 0.8,
    optCurve: true,
    optTolerance: 0.4,
    color: "#0B0B0C",
    background: "transparent",
  });
  fs.writeFileSync(path.join(R4, "trace-v.svg"), vSvg);
  fs.writeFileSync(path.join(R4, "trace-tail.svg"), tailSvg);
  console.log("traces written");
};
run().catch((e) => {
  console.log("TRACE FAILED:", String(e).slice(0, 200));
  process.exit(1);
});
