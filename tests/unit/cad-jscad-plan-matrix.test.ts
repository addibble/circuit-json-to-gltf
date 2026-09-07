import { expect, test } from "bun:test"
import type { CadComponent } from "circuit-json"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"
import { GLTFBuilder } from "../../lib/gltf/gltf-builder"
import { parseGLB } from "../../lib/loaders/glb"
import { COORDINATE_TRANSFORMS } from "../../lib/utils/coordinate-transform"

test("matrix JSCAD plans retain their transform through placement and GLB export", async () => {
  const cad: CadComponent = {
    type: "cad_component",
    cad_component_id: "cad",
    pcb_component_id: "pcb",
    source_component_id: "source",
    anchor_alignment: "center",
    position: { x: 7, y: -5, z: -3 },
    rotation: { x: 0, y: 180, z: 90 },
    model_origin_position: { x: 0, y: 0, z: 0 },
    model_object_fit: "contain_within_bounds",
    model_jscad: {
      type: "transform",
      matrix: [0, 2, 0, 0, -3, 0, 0, 0, 0, 0, 4, 0, 10, 20, 30, 1],
      shape: { type: "cuboid", size: [2, 4, 6] },
    },
  }
  const scene = await convertCircuitJsonTo3D([cad], {
    renderBoardTextures: false,
  })
  const builder = new GLTFBuilder()
  await builder.buildFromScene3D(scene)
  const glb = builder.export(true)
  if (!(glb instanceof ArrayBuffer)) throw new Error("Expected binary GLB")
  const points = parseGLB(
    glb,
    COORDINATE_TRANSFORMS.IDENTITY,
  ).triangles.flatMap((triangle) => triangle.vertices)
  for (const x of [-1, 1])
    for (const y of [-2, 2])
      for (const z of [-3, 3]) {
        // Final glTF frame is (-Circuit X, Circuit Z, Circuit Y).
        const expected = { x: -2 * x - 27, y: -4 * z - 33, z: -3 * y + 5 }
        expect(
          points.some(
            (point) =>
              Math.hypot(
                point.x - expected.x,
                point.y - expected.y,
                point.z - expected.z,
              ) < 1e-4,
          ),
        ).toBe(true)
      }
})
