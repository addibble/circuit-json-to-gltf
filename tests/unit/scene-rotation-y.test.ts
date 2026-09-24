import { expect, test } from "bun:test"
import { placeSceneRotationProbe } from "../fixtures/scene-rotation-probe"

test("positive CAD Y turns project +Z toward +X despite its Scene3D z field", () => {
  const mesh = placeSceneRotationProbe({ x: 0, y: 0, z: Math.PI / 2 })
  expect(mesh.positions[0]).toBeCloseTo(-10, 8)
  expect(mesh.positions[1]).toBeCloseTo(4, 8)
  expect(mesh.positions[2]).toBeCloseTo(-9, 8)
  expect(mesh.normals[0]).toBeCloseTo(-1, 8)
  expect(mesh.normals[1]).toBeCloseTo(0, 8)
  expect(mesh.normals[2]).toBeCloseTo(0, 8)
})
