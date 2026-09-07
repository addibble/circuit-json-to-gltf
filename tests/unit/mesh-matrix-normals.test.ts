import { expect, test } from "bun:test"
import { composeMat4, mat4 } from "@tscircuit/circuit-json-util"
import { transformMesh } from "../../lib/gltf/geometry"
import { transformTrianglesByMatrix } from "../../lib/utils/coordinate-transform"
import type { Triangle } from "../../lib/types"

test("matrix placement keeps shading normals perpendicular after nonuniform fitting", () => {
  const triangle: Triangle = {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 0, z: 1 },
    ],
    normal: { x: 1 / Math.sqrt(3), y: -1 / Math.sqrt(3), z: -1 / Math.sqrt(3) },
  }
  const matrix = composeMat4(
    mat4.fromTranslation(new Float64Array(16), [7, 11, 13]),
    mat4.fromYRotation(new Float64Array(16), (31 * Math.PI) / 180),
    mat4.fromScaling(new Float64Array(16), [2, 3, 4]),
  )
  const transformed = transformTrianglesByMatrix([triangle], matrix)[0]!
  const mesh = transformMesh(
    {
      positions: triangle.vertices.flatMap((point) => [
        point.x,
        point.y,
        point.z,
      ]),
      normals: [triangle.normal.x, triangle.normal.y, triangle.normal.z],
      indices: [0, 1, 2],
      texcoords: [],
    },
    { x: 999, y: 999, z: 999 },
    undefined,
    undefined,
    matrix,
  )
  const normals = [
    transformed.normal,
    { x: mesh.normals[0]!, y: mesh.normals[1]!, z: mesh.normals[2]! },
  ]
  for (const normal of normals) {
    expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 6)
    for (const point of transformed.vertices.slice(1)) {
      const origin = transformed.vertices[0]
      expect(
        normal.x * (point.x - origin.x) +
          normal.y * (point.y - origin.y) +
          normal.z * (point.z - origin.z),
      ).toBeCloseTo(0, 5)
    }
  }
  expect(mesh.positions[0]).toBeCloseTo(7)
  expect(mesh.positions[1]).toBeCloseTo(11)
  expect(mesh.positions[2]).toBeCloseTo(13)
})
