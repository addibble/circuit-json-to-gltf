import { expect, test } from "bun:test"
import { getBounds, NodeIO } from "@gltf-transform/core"
import { Resvg } from "@resvg/resvg-js"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { convertCircuitJsonToGltf } from "../../lib"
import { buildEnclosureAssemblyCircuitJson } from "../fixtures/enclosure-assembly"
import { buildSectionedGlbByMaterial } from "../fixtures/section-by-material"

test("the section fixture retains x+ geometry from the requested nonzero YZ offset", async () => {
  // JavaScript exercises this runtime boundary without casting past the fixture's
  // broken TypeScript signature. The input follows gltf-slice's valid contract.
  /** @satisfies {import("gltf-slice").SliceSpec} */
  const spec = {
    plane: "yz",
    side: "x+",
    xOffset: 8,
  }
  const glb = await buildSectionedGlbByMaterial(spec)
  expect(glb).toBeInstanceOf(ArrayBuffer)
  const io = new NodeIO()
  const document = await io.readBinary(new Uint8Array(glb))
  const scene = document.getRoot().getDefaultScene()
  if (!scene) throw new Error("Section GLB has no default scene")
  // getBounds measures referenced vertices after each node's world transform.
  // GLB space is Y-up in mm; a YZ section is perpendicular to scene X.
  const actual = getBounds(scene)

  const fullGlb = await convertCircuitJsonToGltf(
    buildEnclosureAssemblyCircuitJson(),
    { format: "glb" },
  )
  if (!(fullGlb instanceof ArrayBuffer)) throw new Error("Expected binary GLB")
  const fullDocument = await io.readBinary(new Uint8Array(fullGlb))
  const fullScene = fullDocument.getRoot().getDefaultScene()
  if (!fullScene) throw new Error("Uncut GLB has no default scene")
  const full = getBounds(fullScene)
  expect(full.min[0]).toBeLessThan(spec.xOffset)
  expect(full.max[0]).toBeGreaterThan(spec.xOffset)

  const png = await renderGLTFToPNGFromGLB(glb, {
    width: 700,
    height: 520,
    // Same Y-up render boundary as enclosure-mounting-hardware.test.ts; view the
    // retained x+ half from -X so the YZ cut face faces the camera.
    camPos: [-75, 48, -60],
    lookAt: [10, 0, 0],
    up: "y+",
    fov: 36,
    ambient: 0.42,
    backgroundColor: "#ffffff",
  })
  const diagnostic = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="594">
    <rect width="700" height="594" fill="white"/>
    <image x="0" y="48" width="700" height="520" href="data:image/png;base64,${Buffer.from(png).toString("base64")}"/>
    <g font-family="sans-serif" font-size="16" fill="#111">
      <text x="16" y="24">Current section fixture output - diagnostic, not a golden snapshot</text>
      <text x="16" y="46">Requested YZ: x = ${spec.xOffset} mm; retain x+</text>
      <text x="16" y="580">Actual occupied X: [${actual.min[0].toFixed(3)}, ${actual.max[0].toFixed(3)}] mm</text>
    </g>
  </svg>`
  await Bun.write(
    new URL("../assets/section-by-material-yz-current.png", import.meta.url),
    new Resvg(diagnostic).render().asPng(),
  )

  expect(actual.max[0]).toBeCloseTo(full.max[0], 4)
  expect(actual.min[1]).toBeCloseTo(full.min[1], 4)
  expect(actual.max[1]).toBeCloseTo(full.max[1], 4)
  expect(actual.min[2]).toBeCloseTo(full.min[2], 4)
  expect(actual.max[2]).toBeCloseTo(full.max[2], 4)
  expect(actual.min[0]).toBeCloseTo(spec.xOffset, 4)
})
