import { Resvg } from "@resvg/resvg-js"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const svgPath = join(import.meta.dir, "../public/favicon.svg")
const svg = readFileSync(svgPath, "utf-8")

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "transparent",
  })
  const png = resvg.render().asPng()
  const outPath = join(import.meta.dir, `../public/logo${size}px.png`)
  writeFileSync(outPath, png)
  console.log(`✔ logo${size}px.png gerado (${size}×${size})`)
}
