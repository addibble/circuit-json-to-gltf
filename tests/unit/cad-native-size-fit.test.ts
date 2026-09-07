import { expect, test } from "bun:test"
import { applyMat4ToPoint3 } from "@tscircuit/circuit-json-util"
import type { CadComponent } from "circuit-json"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"

test("Y-normal fitting uses native axes and mm targets independently of model units", async () => {
  const cad: CadComponent = {
    type: "cad_component",
    cad_component_id: "cad",
    pcb_component_id: "pcb",
    source_component_id: "source",
    anchor_alignment: "center",
    position: { x: 3, y: 5, z: 7 },
    model_origin_position: { x: 10, y: 20, z: 30 },
    model_board_normal_direction: "y+",
    model_object_fit: "contain_within_bounds",
    model_jscad: {
      type: "translate",
      vector: [13, 22, 40],
      shape: { type: "cuboid", size: [6, 4, 20] },
    },
  }
  for (const [fit, target, dimensions] of [
    ["contain_within_bounds", undefined, [6, 4, 20]],
    ["contain_within_bounds", { x: 6, y: 4, z: 20 }, [6, 4, 20]],
    ["fill_bounds", { x: 12, y: 12, z: 10 }, [12, 12, 10]],
  ] as const) {
    for (const unitScale of [1, 2, 25.4]) {
      const expected = dimensions.map((value) =>
        target ? value : value * unitScale,
      )
      const scene = await convertCircuitJsonTo3D(
        [
          {
            ...cad,
            size: target,
            model_object_fit: fit,
            model_unit_to_mm_scale_factor: unitScale,
          },
        ],
        { renderBoardTextures: false },
      )
      const box = scene.boxes[0]!
      expect(box.size.x).toBeCloseTo(expected[0]!, 8)
      expect(box.size.y).toBeCloseTo(expected[1]!, 8)
      expect(box.size.z).toBeCloseTo(expected[2]!, 8)
      for (const [axis, minimum, maximum] of [
        ["x", cad.position.x, cad.position.x + expected[0]!],
        ["y", cad.position.z, cad.position.z + expected[1]!],
        ["z", cad.position.y - expected[2]!, cad.position.y],
      ] as const) {
        const vertices = box.mesh!.triangles.flatMap((triangle) =>
          triangle.vertices.map(
            (point) => applyMat4ToPoint3(box.matrix!, point)[axis],
          ),
        )
        expect(Math.min(...vertices)).toBeCloseTo(minimum, 8)
        expect(Math.max(...vertices)).toBeCloseTo(maximum, 8)
      }
    }
  }
})
