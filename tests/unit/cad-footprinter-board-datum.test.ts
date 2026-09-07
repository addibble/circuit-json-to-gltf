import { expect, test } from "bun:test"
import { applyMat4ToPoint3 } from "@tscircuit/circuit-json-util"
import type { CadComponent } from "circuit-json"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"

test("generated footprinter surface alignment uses its board datum instead of pin tips", async () => {
  const cad: CadComponent = {
    type: "cad_component",
    cad_component_id: "cad",
    pcb_component_id: "pcb",
    source_component_id: "source",
    anchor_alignment: "center_of_component_on_board_surface",
    position: { x: 7, y: -5, z: 0.8 },
    footprinter_string: "dip8",
    model_object_fit: "contain_within_bounds",
  }
  const automatic = await convertCircuitJsonTo3D([cad], {
    renderBoardTextures: false,
  })
  const explicit = await convertCircuitJsonTo3D(
    [{ ...cad, model_origin_position: { x: 0, y: 0, z: 0 } }],
    { renderBoardTextures: false },
  )
  const actual = automatic.boxes[0]!
  const expected = explicit.boxes[0]!
  expect(actual.mesh).toBeDefined()
  const points = expected.mesh!.triangles.flatMap((triangle) =>
    triangle.vertices.map((point) =>
      applyMat4ToPoint3(expected.matrix!, point),
    ),
  )
  expect(Math.min(...points.map((point) => point.y))).toBeLessThan(
    cad.position.z,
  )
  for (let i = 0; i < actual.mesh!.triangles.length; i++) {
    for (let vertex = 0; vertex < 3; vertex++) {
      for (const axis of ["x", "y", "z"] as const) {
        expect(actual.mesh!.triangles[i]!.vertices[vertex]![axis]).toBeCloseTo(
          expected.mesh!.triangles[i]!.vertices[vertex]![axis],
          4,
        )
      }
    }
  }
})
