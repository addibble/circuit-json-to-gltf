import { expect, test } from "bun:test"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"
import { COORDINATE_TRANSFORMS } from "../../lib/utils/coordinate-transform"

test("hardware rebakes Euler placement only for the actual footprinter frame", async () => {
  const cad = {
    type: "cad_component" as const,
    cad_component_id: "hardware",
    pcb_component_id: "hardware_owner",
    source_component_id: "hardware_source",
    footprinter_string: "bolt_m3_l12_socketcap",
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 31, y: 47, z: 23 },
    anchor_alignment: "center" as const,
    model_object_fit: "contain_within_bounds" as const,
    model_origin_position: { x: 0, y: 0, z: 0 },
  }
  const options = { renderBoardTextures: false, drawFauxBoard: false }
  for (const normal of ["x-", "y+", "y-"] as const) {
    const scene = await convertCircuitJsonTo3D(
      [{ ...cad, model_board_normal_direction: normal }],
      options,
    )
    const box = scene.boxes[0]!
    // These supported normals select the identity loader. Its native Z
    // extent remains intact until the existing scene rotation is applied.
    expect(box.mesh!.boundingBox.min.z).toBeCloseTo(-12, 4)
    expect(box.mesh!.boundingBox.max.z).toBeCloseTo(3, 4)
    expect(box.rotation).toEqual({
      x: (31 * Math.PI) / 180,
      y: (23 * Math.PI) / 180,
      z: (47 * Math.PI) / 180,
    })
  }
  const implicit = await convertCircuitJsonTo3D([cad], options)
  const explicit = await convertCircuitJsonTo3D([cad], {
    ...options,
    coordinateTransform: COORDINATE_TRANSFORMS.FOOTPRINTER_MODEL_TRANSFORM,
  })
  expect(explicit.boxes[0]!.rotation).toBeUndefined()
  expect(explicit.boxes[0]!.mesh!.boundingBox).toEqual(
    implicit.boxes[0]!.mesh!.boundingBox,
  )
})
