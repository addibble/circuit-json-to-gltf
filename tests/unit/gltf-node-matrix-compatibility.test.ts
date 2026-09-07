import { expect, test } from "bun:test"
import {
  applyNodeTransform,
  applyQuaternion,
} from "../../lib/utils/gltf-node-transforms"

test("legacy glTF quaternion and TRS wrappers preserve scale then rotation then translation", () => {
  const rotation: [number, number, number, number] = [
    0,
    0,
    Math.SQRT1_2,
    Math.SQRT1_2,
  ]
  const point = { x: 1, y: 2, z: 3 }
  const rotated = applyQuaternion(point, rotation)
  expect(rotated.x).toBeCloseTo(-2)
  expect(rotated.y).toBeCloseTo(1)
  expect(rotated.z).toBeCloseTo(3)
  const transformed = applyNodeTransform(point, {
    scale: [2, 3, 4],
    rotation,
    translation: [7, 11, 13],
  })
  expect(transformed.x).toBeCloseTo(1)
  expect(transformed.y).toBeCloseTo(13)
  expect(transformed.z).toBeCloseTo(25)
})
