import { Resvg } from "@resvg/resvg-js"
import { writeFileSync } from "fs"
import { join } from "path"

const spoke =
  "M 63 50 Q 70 27 77.96 20.01 A 41 41 0 0 1 90.94 47.85 Q 82 57 63 50 Z " +
  "M 66 50 Q 72 35 77.07 24.77 A 37 37 0 0 1 86.86 46.78 Q 80 55 66 50 Z"

const spokes = [0, 72, 144, 216, 288]
  .map((a) => `<path d="${spoke}" ${a ? `transform="rotate(${a},50,50)"` : ""}/>`)
  .join("")

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#16121f"/>
    </linearGradient>
    <linearGradient id="wg" x1="15%" y1="5%" x2="85%" y2="95%" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#e879f9"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <g transform="translate(870,180) scale(3.6)" opacity="0.06">
    <g fill="url(#wg)" fill-rule="evenodd" transform="rotate(-90,50,50)">${spokes}</g>
  </g>

  <g transform="translate(110,235)">
    <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="43.5" stroke="url(#wg)" stroke-width="5"/>
      <g fill="url(#wg)" fill-rule="evenodd" transform="rotate(-90,50,50)">${spokes}</g>
      <circle cx="50" cy="50" r="13.5" stroke="url(#wg)" stroke-width="4.5"/>
      <circle cx="50" cy="50" r="4" fill="url(#wg)"/>
    </svg>
  </g>

  <text x="260" y="300" font-family="'Space Grotesk', 'Segoe UI', sans-serif" font-size="84" font-weight="700" fill="#f0f0f0">AutoHub</text>
  <text x="262" y="356" font-family="'Inter', 'Segoe UI', sans-serif" font-size="32" font-weight="500" fill="#a78bfa">A rede social dos builders</text>
  <text x="262" y="404" font-family="'Inter', 'Segoe UI', sans-serif" font-size="24" fill="#888888">Documente seu build. Acompanhe a comunidade.</text>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, background: "#0a0a0f" })
  .render()
  .asPng()

writeFileSync(join(import.meta.dir, "../public/og-image.png"), png)
console.log("✔ og-image.png gerado (1200×630)")
