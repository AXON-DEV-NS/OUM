import fs from "fs";
const p = "app/globals.css";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("PX-PIXEL-COMPONENTS")) {
  s += `

/* PX-PIXEL-COMPONENTS: stepped 8-bit corners via 4px clip-path steps.
   Hard offset shadows use a filter wrapper (drop-shadow follows the clip). */
.pixel-frame-outer {
  filter: drop-shadow(8px 8px 0 #181A16);
}
.pixel-frame {
  --px-clip: polygon(
    0 4px, 4px 4px, 4px 0,
    calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px,
    100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%,
    4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px)
  );
  clip-path: var(--px-clip);
  border: 4px solid #181A16;
}
.px-scanlines {
  background: repeating-linear-gradient(
    0deg,
    rgba(24, 26, 22, 0.12) 0 2px,
    transparent 2px 4px
  );
}
.pixel-btn {
  transition-timing-function: steps(3, end) !important;
}
.pixel-frame video,
.pixel-frame img {
  image-rendering: pixelated;
}
`;
  fs.writeFileSync(p, s);
  console.log("pixel component CSS appended");
} else {
  console.log("already present");
}
