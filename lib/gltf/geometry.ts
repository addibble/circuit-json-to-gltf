import type { Point3, Size3, STLMesh, OBJMesh, Triangle } from "../types"
import type { BoundingBox } from "../types"
import { boundsOfPositions } from "../utils/bounding-box"
import { mat3, vec3 } from "gl-matrix"
import {
  applyMat4ToPoint3,
  mat4,
  type ReadonlyMat4,
} from "@tscircuit/circuit-json-util"

export interface MeshData {
  positions: number[]
  normals: number[]
  texcoords: number[]
  indices: number[]
  colors?: number[]
}

export interface FaceMeshData {
  top: MeshData
  bottom: MeshData
  front: MeshData
  back: MeshData
  left: MeshData
  right: MeshData
}

export function createBoxMesh(size: Size3): MeshData {
  const hw = size.x / 2
  const hh = size.y / 2
  const hd = size.z / 2

  // Vertices for a box (8 vertices, 6 faces)
  const positions: number[] = []
  const normals: number[] = []
  const texcoords: number[] = []
  const indices: number[] = []

  // Define the 6 faces
  const faces = [
    // Front face (positive Z)
    {
      vertices: [
        [-hw, -hh, hd],
        [hw, -hh, hd],
        [hw, hh, hd],
        [-hw, hh, hd],
      ],
      normal: [0, 0, 1],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Back face (negative Z)
    {
      vertices: [
        [hw, -hh, -hd],
        [-hw, -hh, -hd],
        [-hw, hh, -hd],
        [hw, hh, -hd],
      ],
      normal: [0, 0, -1],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Top face (positive Y)
    {
      vertices: [
        [-hw, hh, hd],
        [hw, hh, hd],
        [hw, hh, -hd],
        [-hw, hh, -hd],
      ],
      normal: [0, 1, 0],
      uvs: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
    // Bottom face (negative Y)
    {
      vertices: [
        [-hw, -hh, -hd],
        [hw, -hh, -hd],
        [hw, -hh, hd],
        [-hw, -hh, hd],
      ],
      normal: [0, -1, 0],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Right face (positive X)
    {
      vertices: [
        [hw, -hh, hd],
        [hw, -hh, -hd],
        [hw, hh, -hd],
        [hw, hh, hd],
      ],
      normal: [1, 0, 0],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Left face (negative X)
    {
      vertices: [
        [-hw, -hh, -hd],
        [-hw, -hh, hd],
        [-hw, hh, hd],
        [-hw, hh, -hd],
      ],
      normal: [-1, 0, 0],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
  ]

  let vertexIndex = 0
  for (const face of faces) {
    // Add vertices for this face
    for (let i = 0; i < 4; i++) {
      const vertex = face.vertices[i]!
      positions.push(vertex[0]!, vertex[1]!, vertex[2]!)
      normals.push(face.normal[0]!, face.normal[1]!, face.normal[2]!)
      texcoords.push(face.uvs[i]![0]!, face.uvs[i]![1]!)
    }

    // Add two triangles for the quad
    indices.push(
      vertexIndex,
      vertexIndex + 1,
      vertexIndex + 2,
      vertexIndex,
      vertexIndex + 2,
      vertexIndex + 3,
    )
    vertexIndex += 4
  }

  return { positions, normals, texcoords, indices }
}

export function createBoxMeshByFaces(size: Size3): FaceMeshData {
  const hw = size.x / 2
  const hh = size.y / 2
  const hd = size.z / 2

  // Define the 6 faces as separate meshes
  const faceDefinitions = {
    // Front face (positive Z)
    front: {
      vertices: [
        [-hw, -hh, hd],
        [hw, -hh, hd],
        [hw, hh, hd],
        [-hw, hh, hd],
      ],
      normal: [0, 0, 1],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Back face (negative Z)
    back: {
      vertices: [
        [hw, -hh, -hd],
        [-hw, -hh, -hd],
        [-hw, hh, -hd],
        [hw, hh, -hd],
      ],
      normal: [0, 0, -1],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Top face (positive Y)
    top: {
      vertices: [
        [-hw, hh, hd],
        [hw, hh, hd],
        [hw, hh, -hd],
        [-hw, hh, -hd],
      ],
      normal: [0, 1, 0],
      uvs: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
    // Bottom face (negative Y)
    bottom: {
      vertices: [
        [-hw, -hh, -hd],
        [hw, -hh, -hd],
        [hw, -hh, hd],
        [-hw, -hh, hd],
      ],
      normal: [0, -1, 0],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Right face (positive X)
    right: {
      vertices: [
        [hw, -hh, hd],
        [hw, -hh, -hd],
        [hw, hh, -hd],
        [hw, hh, hd],
      ],
      normal: [1, 0, 0],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
    // Left face (negative X)
    left: {
      vertices: [
        [-hw, -hh, -hd],
        [-hw, -hh, hd],
        [-hw, hh, hd],
        [-hw, hh, -hd],
      ],
      normal: [-1, 0, 0],
      uvs: [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    },
  }

  const result: FaceMeshData = {} as FaceMeshData

  for (const [faceName, face] of Object.entries(faceDefinitions)) {
    const positions: number[] = []
    const normals: number[] = []
    const texcoords: number[] = []
    const indices = [0, 1, 2, 0, 2, 3]

    // Add vertices for this face
    for (let i = 0; i < 4; i++) {
      const vertex = face.vertices[i]!
      positions.push(vertex[0]!, vertex[1]!, vertex[2]!)
      normals.push(face.normal[0]!, face.normal[1]!, face.normal[2]!)
      texcoords.push(face.uvs[i]![0]!, face.uvs[i]![1]!)
    }

    result[faceName as keyof FaceMeshData] = {
      positions,
      normals,
      texcoords,
      indices,
    }
  }

  return result
}

export function createMeshFromSTL(stlMesh: STLMesh): MeshData {
  const positions: number[] = []
  const normals: number[] = []
  const texcoords: number[] = []
  const indices: number[] = []

  let vertexIndex = 0

  for (const triangle of stlMesh.triangles) {
    // Add vertices
    for (const vertex of triangle.vertices) {
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(triangle.normal.x, triangle.normal.y, triangle.normal.z)
      // Simple planar UV mapping
      texcoords.push(vertex.x, vertex.z)
    }

    // Add indices (reverse winding for correct face orientation)
    indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1)
    vertexIndex += 3
  }

  return { positions, normals, texcoords, indices }
}

export function createMeshFromOBJ(
  objMesh: OBJMesh,
): { meshData: MeshData; materialIndex: number }[] {
  if (!objMesh.materials || objMesh.materials.size === 0) {
    return [{ meshData: createMeshFromSTL(objMesh), materialIndex: -1 }]
  }

  const materialMeshes = new Map<number, MeshData>()

  for (const triangle of objMesh.triangles) {
    const materialIndex = triangle.materialIndex ?? -1

    if (!materialMeshes.has(materialIndex)) {
      materialMeshes.set(materialIndex, {
        positions: [],
        normals: [],
        texcoords: [],
        indices: [],
      })
    }

    const targetMesh = materialMeshes.get(materialIndex)!
    const baseIndex = targetMesh.positions.length / 3

    for (const vertex of triangle.vertices) {
      targetMesh.positions.push(vertex.x, vertex.y, vertex.z)
      targetMesh.normals.push(
        triangle.normal.x,
        triangle.normal.y,
        triangle.normal.z,
      )
      targetMesh.texcoords.push(vertex.x, vertex.z)
    }

    targetMesh.indices.push(baseIndex, baseIndex + 2, baseIndex + 1)
  }

  const result: { meshData: MeshData; materialIndex: number }[] = []

  for (const [materialIndex, meshData] of materialMeshes) {
    if (meshData.positions.length > 0) {
      result.push({ meshData, materialIndex })
    }
  }

  return result.length > 0
    ? result
    : [{ meshData: createMeshFromSTL(objMesh), materialIndex: -1 }]
}

export function transformMesh(
  mesh: MeshData,
  translation: Point3,
  rotation?: Point3,
  scale?: Point3,
  placementMatrix?: ReadonlyMat4,
): MeshData {
  const result: MeshData = {
    positions: [...mesh.positions],
    normals: [...mesh.normals],
    texcoords: [...mesh.texcoords],
    indices: [...mesh.indices],
  }

  if (mesh.colors) {
    result.colors = [...mesh.colors]
  }

  // Public legacy rotation is radians, with order T * Rz * Rx * Ry(-y) * S.
  // CAD callers pass their composed shared matrix instead of remapping Euler.
  const legacyMatrix = mat4.fromTranslation(new Float64Array(16), [
    translation.x,
    translation.y,
    translation.z,
  ])
  mat4.rotateZ(legacyMatrix, legacyMatrix, rotation?.z ?? 0)
  mat4.rotateX(legacyMatrix, legacyMatrix, rotation?.x ?? 0)
  mat4.rotateY(legacyMatrix, legacyMatrix, -(rotation?.y ?? 0))
  mat4.scale(legacyMatrix, legacyMatrix, [
    scale?.x ?? 1,
    scale?.y ?? 1,
    scale?.z ?? 1,
  ])
  const matrix = placementMatrix ?? legacyMatrix
  const normalMatrix = mat3.normalFromMat4(new Float64Array(9), matrix)
  if (!normalMatrix)
    throw new Error("Cannot transform mesh normals with a singular matrix")
  for (let i = 0; i < result.positions.length; i += 3) {
    const point = applyMat4ToPoint3(matrix, {
      x: mesh.positions[i]!,
      y: mesh.positions[i + 1]!,
      z: mesh.positions[i + 2]!,
    })
    result.positions[i] = point.x
    result.positions[i + 1] = point.y
    result.positions[i + 2] = point.z
  }
  for (let i = 0; i < result.normals.length; i += 3) {
    const normal = vec3.transformMat3(
      new Float64Array(3),
      [mesh.normals[i]!, mesh.normals[i + 1]!, mesh.normals[i + 2]!],
      normalMatrix,
    )
    vec3.normalize(normal, normal)
    result.normals[i] = normal[0]!
    result.normals[i + 1] = normal[1]!
    result.normals[i + 2] = normal[2]!
  }

  return result
}

export function convertMeshToGLTFOrientation(mesh: MeshData): MeshData {
  const result: MeshData = {
    positions: [...mesh.positions],
    normals: [...mesh.normals],
    texcoords: [...mesh.texcoords],
    indices: [...mesh.indices],
  }

  if (mesh.colors) {
    result.colors = [...mesh.colors]
  }

  for (let i = 0; i < result.positions.length; i += 3) {
    const x = result.positions[i]
    if (typeof x === "number") {
      result.positions[i] = -x
    }
  }

  for (let i = 0; i < result.normals.length; i += 3) {
    const nx = result.normals[i]
    if (typeof nx === "number") {
      result.normals[i] = -nx
    }
  }

  for (let i = 0; i < result.indices.length; i += 3) {
    const i1 = result.indices[i + 1]
    const i2 = result.indices[i + 2]

    if (typeof i1 === "number" && typeof i2 === "number") {
      result.indices[i + 1] = i2
      result.indices[i + 2] = i1
    }
  }

  return result
}

/**
 * Axis-aligned bounds of a flat position array, as glTF accessors declare
 * them. Delegates to the shared scan so the empty-input rule (a zero box, not
 * Infinity) is stated once for every bounds in this package.
 */
export function getBounds(positions: number[]): BoundingBox {
  return boundsOfPositions(positions)
}
