import { expect, test } from "bun:test"
import { placeSceneRotationProbe } from "../fixtures/scene-rotation-probe"

test("positive CAD X turns project +Y toward +Z in the final GLB frame", () => {
  const mesh = placeSceneRotationProbe({ x: Math.PI / 2, y: 0, z: 0 })
  expect(mesh.positions[0]).toBeCloseTo(-8, 8)
  expect(mesh.positions[1]).toBeCloseTo(7, 8)
  expect(mesh.positions[2]).toBeCloseTo(-14, 8)
  expect(mesh.normals[0]).toBeCloseTo(0, 8)
  expect(mesh.normals[1]).toBeCloseTo(0, 8)
  expect(mesh.normals[2]).toBeCloseTo(-1, 8)
})
