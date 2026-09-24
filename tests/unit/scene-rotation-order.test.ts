import { expect, test } from "bun:test"
import { placeSceneRotationProbe } from "../fixtures/scene-rotation-probe"

test("CAD intrinsic XYZ applies Z then Y then X, including non-quarter turns", () => {
  const mesh = placeSceneRotationProbe({
    x: (23 * Math.PI) / 180,
    y: (47 * Math.PI) / 180,
    z: (31 * Math.PI) / 180,
  })
  // Independent right-handed XYZ oracle for project (1,2,3), then
  // project translation (7,-11,5) and final G=(-Px,Pz,Py).
  expect(mesh.positions[0]).toBeCloseTo(-7.875915961557397, 8)
  expect(mesh.positions[1]).toBeCloseTo(8.555928907458544, 8)
  expect(mesh.positions[2]).toBeCloseTo(-10.233096594485545, 8)
  expect(Math.hypot(...mesh.normals)).toBeCloseTo(1, 8)
})
