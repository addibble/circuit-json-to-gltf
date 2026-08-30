import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { NodeIO } from "@gltf-transform/core"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { convertCircuitJsonToGltf } from "../../lib"
import {
  buildEnclosureAssemblyCircuitJson,
  getSectionCameraOptions,
  getSectionElevationCameraOptions,
  LID_BOLT_POSITIONS,
  PCB_SCREW_POSITIONS,
} from "../fixtures/enclosure-assembly"
import { buildSectionedGlbByMaterial } from "../fixtures/section-by-material"

/**
 * Section views of enclosure mounting hardware.
 *
 * Hardware is interesting exactly where it is hidden, so a closed enclosure
 * renders as a featureless box -- the first snapshot proves only that the lid
 * is on. The sections are what answer the question the hardware exists to
 * raise: does each fastener reach its counterpart, and does it clear the board.
 *
 * ## The axis mapping
 *
 * Circuit JSON is Z-up; the glTF scene is Y-up, and the converter maps
 * `scene(X, Y, Z) = circuit(x, z, y)`. So a section plane at a constant circuit
 * **y** is gltf-slice's **xy** plane offset along scene **z**. Measured from a
 * built GLB rather than derived, because the node translation and the mesh
 * transform are applied in different places.
 */
const CIRCUIT_Y_TO_SCENE_Z = (y: number) => y

const RENDER = { width: 700, height: 520 } as const

/**
 * Sections are drawn as straight elevations, square-on to the cut, so lengths
 * in the plane are seen at true relative size. The whole-assembly views stay
 * isometric, where showing the shape matters more than measuring it.
 */
const SECTION_VIEW = getSectionElevationCameraOptions({
  sectionNormalSceneZ: -1,
})
const ASSEMBLY_VIEW = getSectionCameraOptions({ sectionNormalSceneZ: -1 })

const buildGlb = async (circuitJson: CircuitJson) =>
  (await convertCircuitJsonToGltf(
    circuitJson as never,
    {
      format: "glb",
    } as never,
  )) as ArrayBuffer

test("enclosure mounting hardware - closed assembly", async () => {
  const circuitJson = buildEnclosureAssemblyCircuitJson()
  const glb = await buildGlb(circuitJson)

  expect(
    await renderGLTFToPNGFromGLB(glb, { ...RENDER, ...ASSEMBLY_VIEW }),
  ).toMatchPngSnapshot(import.meta.path, "closed-assembly")
})

/**
 * A section on the board's X axis, which both PCB screws sit on, so the plane
 * passes through the middle of each of them.
 */
test("enclosure mounting hardware - section through the PCB screws", async () => {
  const glb = await buildSectionedGlbByMaterial({
    zOffset: CIRCUIT_Y_TO_SCENE_Z(PCB_SCREW_POSITIONS[0]!.y),
    side: "z+",
  })

  expect(
    await renderGLTFToPNGFromGLB(glb, { ...RENDER, ...SECTION_VIEW }),
  ).toMatchPngSnapshot(import.meta.path, "section-through-pcb-screws")
})

/**
 * A section on the corner mounts' Y axis, cutting the two bolts on the near
 * side and the inserts they thread into.
 *
 * The *near* row is cut and the far half kept, deliberately: cutting the far
 * row and keeping the near half shaves off an outer strip, leaves the lid
 * whole, and points the cut face away from the camera -- a view that shows
 * nothing while looking like it worked.
 */
test("enclosure mounting hardware - section through the lid bolts and inserts", async () => {
  const glb = await buildSectionedGlbByMaterial({
    zOffset: CIRCUIT_Y_TO_SCENE_Z(LID_BOLT_POSITIONS[0]!.y),
    side: "z+",
  })

  expect(
    await renderGLTFToPNGFromGLB(glb, { ...RENDER, ...SECTION_VIEW }),
  ).toMatchPngSnapshot(import.meta.path, "section-through-lid-bolts")
})

test("enclosure mounting hardware - fasteners without the shell", async () => {
  const circuitJson = (
    buildEnclosureAssemblyCircuitJson() as unknown as Array<{
      type: string
      cad_component_id?: string
    }>
  ).filter(
    (element) =>
      !(
        element.type === "cad_component" &&
        /enclosure/i.test(element.cad_component_id ?? "")
      ),
  ) as unknown as CircuitJson

  const glb = await buildGlb(circuitJson)

  expect(
    await renderGLTFToPNGFromGLB(glb, { ...RENDER, ...ASSEMBLY_VIEW }),
  ).toMatchPngSnapshot(import.meta.path, "fasteners-only")
})

/**
 * A snapshot only fails when somebody looks at it, so the property the section
 * exists for is also asserted directly: each material must reach the cut with
 * its OWN cap material.
 *
 * gltf-slice assigns one cap material per document, so a single slice pass
 * draws every cut face with the same hatch and a bolt cut inside a boss
 * disappears into the boss. If this collapses back to one material the images
 * will still look plausible -- which is exactly why it is checked here.
 */
test("each material is hatched separately at the cut", async () => {
  const glb = await buildSectionedGlbByMaterial({ zOffset: 0, side: "z+" })
  const document = await new NodeIO().readBinary(new Uint8Array(glb))

  const capMaterials = document
    .getRoot()
    .listMaterials()
    .map((material) => material.getName())
    .filter((name) => name.startsWith("section_"))

  expect(capMaterials).toEqual(
    expect.arrayContaining([
      "section_enclosure",
      "section_board",
      "section_screw",
    ]),
  )
  // Each cap material must carry its own hatch image, not share one.
  const capTextures = document
    .getRoot()
    .listMaterials()
    .filter((material) => material.getName().startsWith("section_"))
    .map((material) => material.getBaseColorTexture())
  expect(capTextures.every((texture) => texture !== null)).toBe(true)
  expect(new Set(capTextures).size).toBe(capTextures.length)
})
