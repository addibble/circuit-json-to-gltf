import { expect, test } from "bun:test"
import { transformMesh } from "../../lib/gltf/geometry"

test("legacy mesh transforms preserve Number precision until glTF buffer encoding", () => {
  const positions = [1.000000000001, 0.0000000002, 3.000000000003]
  const translation = {
    x: 0.000000000001,
    y: -0.0000000002,
    z: 0.0000000000007,
  }
  const transformed = transformMesh(
    {
      positions,
      normals: [1, 0, 0],
      indices: [],
      texcoords: [],
    },
    translation,
  )
  expect(transformed.positions).toEqual([
    positions[0]! + translation.x,
    positions[1]! + translation.y,
    positions[2]! + translation.z,
  ])
})
