import {
  convertMeshToGLTFOrientation,
  transformMesh,
  type MeshData,
} from "../../lib/gltf/geometry"
import type { Point3 } from "../../lib/types"

// Project point (1,2,3) stored in Scene3D as (1,3,2).
export const sceneRotationProbe: MeshData = {
  positions: [1, 3, 2],
  normals: [0, 1, 0],
  texcoords: [0.25, 0.75],
  indices: [],
}

export function placeSceneRotationProbe(rotation: Point3) {
  return convertMeshToGLTFOrientation(
    transformMesh(sceneRotationProbe, { x: 7, y: 5, z: -11 }, rotation),
  )
}
