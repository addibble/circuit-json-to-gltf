import { expect, test } from "bun:test"
import { transformMesh } from "../../lib/gltf/geometry"
import { sceneRotationProbe } from "../fixtures/scene-rotation-probe"

test("no CAD rotation preserves Scene3D scaling, translation and source arrays", () => {
  const original = structuredClone(sceneRotationProbe)
  const mesh = transformMesh(
    sceneRotationProbe,
    { x: 7, y: 5, z: -11 },
    undefined,
    { x: 2, y: 3, z: 4 },
  )
  expect(mesh.positions).toEqual([9, 14, -3])
  expect(mesh.normals).toEqual(original.normals)
  expect(mesh.texcoords).toEqual(original.texcoords)
  expect(sceneRotationProbe).toEqual(original)
})
