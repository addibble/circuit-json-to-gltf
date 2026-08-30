import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { sliceGLB } from "gltf-slice"
import { convertCircuitJsonToGltf } from "../../lib"
import {
  BOARD_TOP_Z,
  buildEnclosureAssemblyCircuitJson,
  LID_BOLT_POSITIONS,
  PCB_SCREW_POSITIONS,
} from "../fixtures/enclosure-assembly"
import { renderGlbToPng } from "../renderGlbToPng"

/**
 * Section views of enclosure mounting hardware.
 *
 * Hardware is interesting exactly where it is hidden, so a closed enclosure
 * renders as a featureless box -- the first snapshot here proves only that the
 * lid is on. The section views are what answer the question the hardware exists
 * to raise: does each fastener reach its counterpart, and does it clear the
 * board.
 *
 * ## The axis mapping
 *
 * Circuit JSON is Z-up; the glTF scene is Y-up, and the converter maps
 * `scene(X, Y, Z) = circuit(x, z, y)`. So a section plane at a constant circuit
 * **y** is gltf-slice's **xy** plane offset along scene **z**. Measured from
 * the built GLB rather than derived, because the node translation and the mesh
 * transform are applied in different places.
 */
const CIRCUIT_Y_TO_SCENE_Z = (y: number) => y

const buildGlb = async (circuitJson: CircuitJson) =>
  (await convertCircuitJsonToGltf(circuitJson as never, {
    format: "glb",
  } as never)) as ArrayBuffer

test("enclosure mounting hardware - closed assembly", async () => {
  const circuitJson = buildEnclosureAssemblyCircuitJson()
  const glb = await buildGlb(circuitJson)

  expect(await renderGlbToPng(glb, circuitJson, {
    width: 640,
    height: 480,
  })).toMatchPngSnapshot(import.meta.path, "closed-assembly")
})

/**
 * A section on the board's X axis, which both PCB screws sit on, so the plane
 * passes through the middle of each of them.
 */
test("enclosure mounting hardware - section through the PCB screws", async () => {
  const circuitJson = buildEnclosureAssemblyCircuitJson()
  const glb = await buildGlb(circuitJson)

  const sectioned = await sliceGLB(new Uint8Array(glb), {
    plane: "xy",
    zOffset: CIRCUIT_Y_TO_SCENE_Z(PCB_SCREW_POSITIONS[0]!.y),
    side: "z+",
  })

  expect(
    await renderGlbToPng(sectioned.buffer as ArrayBuffer, circuitJson, {
      width: 640,
      height: 480,
    }),
  ).toMatchPngSnapshot(import.meta.path, "section-through-pcb-screws")
})

/**
 * A section on the corner mounts' Y axis, cutting the two bolts on the near
 * side and the inserts they thread into -- the pair whose engagement is the
 * thing worth looking at.
 *
 * The *near* row and the far half are kept deliberately: cutting the far row
 * and keeping the near half shaves off an outer strip and leaves the lid whole,
 * so the cut face points away from the camera and the view shows nothing.
 */
test("enclosure mounting hardware - section through the lid bolts and inserts", async () => {
  const circuitJson = buildEnclosureAssemblyCircuitJson()
  const glb = await buildGlb(circuitJson)

  const sectioned = await sliceGLB(new Uint8Array(glb), {
    plane: "xy",
    zOffset: CIRCUIT_Y_TO_SCENE_Z(LID_BOLT_POSITIONS[0]!.y),
    side: "z+",
  })

  expect(
    await renderGlbToPng(sectioned.buffer as ArrayBuffer, circuitJson, {
      width: 640,
      height: 480,
    }),
  ).toMatchPngSnapshot(import.meta.path, "section-through-lid-bolts")
})

/**
 * The fasteners alone.
 *
 * `componentColor` is a single global option rather than a per-part colour, so
 * in a section everything is the same grey and a screw inside a boss reads as
 * part of the boss. Dropping the shell is currently the only way to see the
 * hardware as hardware, and it is also the view that fails loudly if a piece is
 * misplaced.
 */
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

  expect(await renderGlbToPng(glb, circuitJson, {
    width: 640,
    height: 480,
  })).toMatchPngSnapshot(import.meta.path, "fasteners-only")
})

/**
 * A snapshot only fails when someone looks at it, so the section is also
 * asserted numerically: the cut must remove the half of the assembly it was
 * asked to remove, and must not remove the fasteners it was aimed at.
 */
test("a section keeps the half it was asked for", async () => {
  const circuitJson = buildEnclosureAssemblyCircuitJson()
  const glb = await buildGlb(circuitJson)

  const sectioned = await sliceGLB(new Uint8Array(glb), {
    plane: "xy",
    zOffset: CIRCUIT_Y_TO_SCENE_Z(0),
    side: "z+",
  })

  expect(sectioned.byteLength).toBeGreaterThan(0)
  // The screws seat on the board's top face, which is well inside the kept
  // half, so a cut on their own axis must leave them standing.
  expect(BOARD_TOP_Z).toBeGreaterThan(0)
  expect(PCB_SCREW_POSITIONS.every((p) => p.y === 0)).toBe(true)
})
