import { expect, test } from "bun:test"
import { applyMat4ToPoint3 } from "@tscircuit/circuit-json-util"
import type { CadComponent } from "circuit-json"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"

test("a native unit cube with scale two is 2mm unsized and 1mm with a 1mm target", async () => {
  const cad: CadComponent = {
    type: "cad_component",
    cad_component_id: "cad",
    pcb_component_id: "pcb",
    source_component_id: "source",
    anchor_alignment: "center",
    model_object_fit: "contain_within_bounds",
    model_origin_position: { x: 0, y: 0, z: 0 },
    position: { x: 3, y: 5, z: 7 },
    model_unit_to_mm_scale_factor: 2,
    model_jscad: {
      type: "cuboid",
      size: [1, 1, 1],
      center: [0.5, 0.5, 0.5],
    },
  }
  for (const [size, expectedSize] of [
    [undefined, 2],
    [{ x: 1, y: 1, z: 1 }, 1],
  ] as const) {
    const scene = await convertCircuitJsonTo3D([{ ...cad, size }], {
      renderBoardTextures: false,
    })
    const box = scene.boxes[0]!
    const worldVertices = box.mesh!.triangles.flatMap((triangle) =>
      triangle.vertices.map((point) => applyMat4ToPoint3(box.matrix!, point)),
    )
    for (const [axis, origin] of [
      ["x", cad.position.x],
      ["y", cad.position.z],
      ["z", cad.position.y],
    ] as const) {
      const coordinates = worldVertices.map((point) => point[axis])
      expect(Math.min(...coordinates)).toBeCloseTo(origin, 12)
      expect(Math.max(...coordinates)).toBeCloseTo(origin + expectedSize, 12)
      expect(box.size[axis]).toBeCloseTo(expectedSize, 12)
    }
  }
})
