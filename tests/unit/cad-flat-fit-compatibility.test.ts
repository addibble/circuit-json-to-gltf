import { expect, test } from "bun:test"
import { fitMeshToCadBounds } from "../../lib/utils/cad-mesh-placement"
import { boundsOfTriangles } from "../../lib/utils/bounding-box"
import type { Triangle } from "../../lib/types"

test("legacy mesh fit keeps ratio one for flat axes instead of canonical flat-axis policy", () => {
  const triangles: Triangle[] = [
    {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 0, y: 4, z: 0 },
      ],
      normal: { x: 0, y: 0, z: 1 },
    },
  ]
  const mesh = { triangles, boundingBox: boundsOfTriangles(triangles) }
  const target = { x: 10, y: 10, z: 10 }
  const contained = fitMeshToCadBounds(mesh, target, "contain_within_bounds")
  const filled = fitMeshToCadBounds(mesh, target, "fill_bounds")
  expect(contained.boundingBox).toEqual(mesh.boundingBox)
  expect(filled.boundingBox).toEqual({
    min: { x: 0, y: 0, z: 0 },
    max: { x: 10, y: 10, z: 0 },
  })
})
