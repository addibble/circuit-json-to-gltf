import { expect, test } from "bun:test"
import { convertCircuitJsonTo3D } from "../../lib"

const openTopBoxPlan = {
  type: "subtract",
  shapes: [
    { type: "cuboid", size: [14, 10, 6] },
    {
      type: "translate",
      vector: [0, 0, 2],
      shape: { type: "cuboid", size: [10, 6, 6] },
    },
  ],
}

const circuitJsonWith = (overrides: Record<string, unknown> = {}): any[] => [
  {
    type: "source_assembly_device",
    source_assembly_device_id: "assembly_1",
    name: "device",
  },
  {
    type: "source_board",
    source_board_id: "source_board_1",
  },
  {
    type: "source_fdm_enclosure",
    source_fdm_enclosure_id: "enclosure_1",
    source_assembly_device_id: "assembly_1",
    source_board_id: "source_board_1",
    wall_thickness: 2,
  },
  {
    type: "cad_fdm_enclosure",
    cad_fdm_enclosure_id: "cad_enclosure_1",
    source_fdm_enclosure_id: "enclosure_1",
    name: "EN1.base",
    position: { x: 1, y: 2, z: 3 },
    size: { x: 14, y: 10, z: 6 },
    model_jscad: openTopBoxPlan,
    ...overrides,
  },
]

test("renders cad_fdm_enclosure parts without a PCB owner", async () => {
  const scene = await convertCircuitJsonTo3D(circuitJsonWith() as any, {
    renderBoardTextures: false,
    showBoundingBoxes: false,
  })

  expect(scene.boxes).toHaveLength(1)
  const box = scene.boxes[0]!
  expect(box.mesh?.triangles.length).toBeGreaterThan(0)
  expect(box.label).toBe("EN1.base")

  // Same Circuit -> Scene node mapping as cad_component: (x, y, z) -> (x, z, y).
  expect(box.center).toEqual({ x: 1, y: 3, z: 2 })

  // Size comes from the executed geometry, not from `size`: the plan is
  // authored in Circuit world coordinates and must never be scaled to fit.
  expect(box.size.x).toBeCloseTo(14)
  expect(box.size.y).toBeCloseTo(6) // circuit Z (depth) becomes scene Y (up)
  expect(box.size.z).toBeCloseTo(10)
})

test("cad_fdm_enclosure translucency is per part", async () => {
  const opaque = await convertCircuitJsonTo3D(circuitJsonWith() as any, {
    renderBoardTextures: false,
    showBoundingBoxes: false,
  })
  const translucent = await convertCircuitJsonTo3D(
    circuitJsonWith({ show_as_translucent_model: true }) as any,
    { renderBoardTextures: false, showBoundingBoxes: false },
  )

  expect(opaque.boxes[0]!.isTranslucent).toBeFalsy()
  expect(translucent.boxes[0]!.isTranslucent).toBe(true)
})
