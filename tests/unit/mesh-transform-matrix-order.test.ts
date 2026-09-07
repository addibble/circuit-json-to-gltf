import { expect, test } from "bun:test"
import {
  applyMat4ToPoint3,
  composeMat4,
  mat4,
} from "@tscircuit/circuit-json-util"
import { transformMesh } from "../../lib/gltf/geometry"
import { applyCoordinateTransform } from "../../lib/utils/coordinate-transform"
import { rotatePoint } from "../../lib/utils/mesh-scale"

test("legacy mesh Euler order and decoder order remain distinct matrix compositions", () => {
  const point = { x: 2, y: 3, z: 5 }
  const rotation = { x: 31, y: -47, z: 23 }
  const rad = Math.PI / 180
  const decoder = composeMat4(
    mat4.fromZRotation(new Float64Array(16), rotation.z * rad),
    mat4.fromYRotation(new Float64Array(16), rotation.y * rad),
    mat4.fromXRotation(new Float64Array(16), rotation.x * rad),
  )
  const meshMatrix = composeMat4(
    mat4.fromTranslation(new Float64Array(16), [11, 13, 17]),
    mat4.fromZRotation(new Float64Array(16), rotation.z * rad),
    mat4.fromXRotation(new Float64Array(16), rotation.x * rad),
    mat4.fromYRotation(new Float64Array(16), -rotation.y * rad),
    mat4.fromScaling(new Float64Array(16), [2, 3, 4]),
  )
  const oldMeshApi = transformMesh(
    {
      positions: [point.x, point.y, point.z],
      normals: [0, 0, 1],
      texcoords: [],
      indices: [],
    },
    { x: 11, y: 13, z: 17 },
    {
      x: rotation.x * rad,
      y: rotation.y * rad,
      z: rotation.z * rad,
    },
    { x: 2, y: 3, z: 4 },
  )
  const expected = applyMat4ToPoint3(meshMatrix, point)
  expect(oldMeshApi.positions[0]).toBeCloseTo(expected.x, 4)
  expect(oldMeshApi.positions[1]).toBeCloseTo(expected.y, 4)
  expect(oldMeshApi.positions[2]).toBeCloseTo(expected.z, 4)
  for (const result of [
    rotatePoint(point, rotation),
    applyCoordinateTransform(point, { rotation }),
  ]) {
    const expectedDecoder = applyMat4ToPoint3(decoder, point)
    for (const axis of ["x", "y", "z"] as const)
      expect(result[axis]).toBeCloseTo(expectedDecoder[axis], 10)
  }
})
