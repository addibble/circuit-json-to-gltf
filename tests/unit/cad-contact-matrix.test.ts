import { expect, test } from "bun:test"
import { applyMat4ToPoint3 } from "@tscircuit/circuit-json-util"
import type { CadComponent } from "circuit-json"
import {
  CAD_TO_SCENE_MATRIX,
  placeCadMesh,
} from "../../lib/utils/cad-mesh-placement"
import { boundsOfTriangles } from "../../lib/utils/bounding-box"
import { transformTrianglesByMatrix } from "../../lib/utils/coordinate-transform"
import type { Triangle } from "../../lib/types"

test("contact alignment measures the source patch, not the whole model or target position", () => {
  const native: Triangle[] = [
    {
      vertices: [
        { x: 4, y: 5, z: 6 },
        { x: 8, y: 5, z: 6 },
        { x: 4, y: 9, z: 6 },
      ],
      normal: { x: 0, y: 0, z: -1 },
    },
    {
      vertices: [
        { x: 4, y: 5, z: 6 },
        { x: 20, y: 30, z: 14 },
        { x: 8, y: 5, z: 6 },
      ],
      normal: { x: 0, y: 0, z: 1 },
    },
  ]
  const triangles = transformTrianglesByMatrix(native, CAD_TO_SCENE_MATRIX)
  const cad: CadComponent = {
    type: "cad_component",
    cad_component_id: "cad",
    pcb_component_id: "pcb",
    source_component_id: "source",
    anchor_alignment: "center",
    position: { x: 7, y: -5, z: 2 },
    rotation: { x: 17, y: 31, z: 47 },
    model_origin_alignment: "center_of_component_on_board_surface",
    model_unit_to_mm_scale_factor: 2,
    model_object_fit: "contain_within_bounds",
  }
  const placed = placeCadMesh(
    cad,
    { triangles, boundingBox: boundsOfTriangles(triangles) },
    CAD_TO_SCENE_MATRIX,
  )
  const corners = placed.mesh.triangles[0]!.vertices.map((point) =>
    applyMat4ToPoint3(placed.matrix, point),
  )
  // The contact rectangle's center is the midpoint of its opposite (8,5,6)
  // and (4,9,6) source corners, even though the body extends to (20,30,14).
  expect((corners[1]!.x + corners[2]!.x) / 2).toBeCloseTo(7, 4)
  expect((corners[1]!.y + corners[2]!.y) / 2).toBeCloseTo(2, 4)
  expect((corners[1]!.z + corners[2]!.z) / 2).toBeCloseTo(-5, 4)
})
