import fs from "fs";
const p = "app/globals.css";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("px-section-rule-light")) {
  s += `
/* light 8-bit divider for dark surfaces (footer) */
.px-section-rule-light {
  border: 0;
  height: 8px;
  background-image: linear-gradient(90deg, #C8B98F 50%, transparent 50%);
  background-size: 8px 8px;
  background-repeat: repeat-x;
  background-position: center;
}
`;
  fs.writeFileSync(p, s);
  console.log("light divider added");
} else {
  console.log("already present");
}
