import type { Point3 } from "../types"
import { applyMat4ToPoint3, mat4 } from "@tscircuit/circuit-json-util"

/**
 * Apply a quaternion rotation to a point.
 * Quaternion format: [x, y, z, w]
 */
export function applyQuaternion(
  p: Point3,
  q: [number, number, number, number],
): Point3 {
  return applyMat4ToPoint3(mat4.fromQuat(new Float64Array(16), q), p)
}

export interface NodeTransform {
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}

/**
 * Apply a node transform (translation, rotation, scale) to a point.
 * Order: scale -> rotate -> translate
 */
export function applyNodeTransform(p: Point3, node: NodeTransform): Point3 {
  const rotation = node.rotation ?? [0, 0, 0, 1]
  const translation = node.translation ?? [0, 0, 0]
  const scale = node.scale ?? [1, 1, 1]
  return applyMat4ToPoint3(
    mat4.fromRotationTranslationScale(
      new Float64Array(16),
      [rotation[0]!, rotation[1]!, rotation[2]!, rotation[3]!],
      [translation[0]!, translation[1]!, translation[2]!],
      [scale[0]!, scale[1]!, scale[2]!],
    ),
    p,
  )
}

/**
 * Build a map of mesh index to accumulated node transforms.
 * Traverses the GLTF scene graph to collect transforms for each mesh.
 */
export function buildMeshTransforms(gltf: any): Map<number, NodeTransform[]> {
  const meshTransforms = new Map<number, NodeTransform[]>()

  if (!gltf.nodes) return meshTransforms

  // Process all nodes and collect transforms for meshes
  function processNode(nodeIndex: number, parentTransforms: NodeTransform[]) {
    const node = gltf.nodes[nodeIndex]
    if (!node) return

    const currentTransforms = [...parentTransforms]
    if (node.translation || node.rotation || node.scale) {
      currentTransforms.push({
        translation: node.translation,
        rotation: node.rotation,
        scale: node.scale,
      })
    }

    if (node.mesh !== undefined) {
      meshTransforms.set(node.mesh, currentTransforms)
    }

    if (node.children) {
      for (const childIndex of node.children) {
        processNode(childIndex, currentTransforms)
      }
    }
  }

  // Start from scene root nodes
  if (gltf.scenes && gltf.scenes[0]?.nodes) {
    for (const rootNodeIndex of gltf.scenes[0].nodes) {
      processNode(rootNodeIndex, [])
    }
  }

  return meshTransforms
}
