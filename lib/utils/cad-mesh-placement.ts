import type { CadComponent } from "circuit-json"
import {
  getCadModelPlacement,
  getCadModelBoardNormalQuaternion,
  getCadModelFitScaleFromBounds,
  applyMat4ToPoint3,
  composeMat4,
  mat4,
  quaternionFromEulerDegrees,
  type ReadonlyMat4,
} from "@tscircuit/circuit-json-util"
import { vec3 } from "gl-matrix"
import type {
  CoordinateTransformConfig,
  OBJMesh,
  Point3,
  STLMesh,
} from "../types"
import {
  applyCoordinateTransform,
  COORDINATE_TRANSFORMS,
  getCoordinateTransformMatrix,
  transformTrianglesByMatrix,
} from "./coordinate-transform"
import { boundsOfPositions, boundsOfTriangles } from "./bounding-box"
import { getBoundingBoxCenter, getBoundingBoxSize } from "./mesh-scale"

/** Circuit JSON Z-up -> intermediate Scene3D Y-up. The final X mirror belongs
 * to GLTFBuilder, as in coordinate-transform.ts#CIRCUIT_Z_UP_TO_SCENE_Y_UP. */
export const CAD_TO_SCENE_MATRIX = getCoordinateTransformMatrix(
  COORDINATE_TRANSFORMS.CIRCUIT_Z_UP_TO_SCENE_Y_UP,
)

function getSceneNormalMatrix(
  modelBoardNormalDirection?: CadComponent["model_board_normal_direction"],
): mat4 {
  return composeMat4(
    CAD_TO_SCENE_MATRIX,
    mat4.fromQuat(
      new Float64Array(16),
      getCadModelBoardNormalQuaternion(modelBoardNormalDirection),
    ),
    CAD_TO_SCENE_MATRIX,
  )
}

function applyMeshMatrix<T extends STLMesh | OBJMesh>(
  mesh: T,
  matrix: ReadonlyMat4,
): T {
  const triangles = transformTrianglesByMatrix(mesh.triangles, matrix)
  return { ...mesh, triangles, boundingBox: boundsOfTriangles(triangles) }
}

export function getMeshWithBoardNormalTransform<T extends STLMesh | OBJMesh>(
  mesh: T,
  modelBoardNormalDirection?: CadComponent["model_board_normal_direction"],
): T {
  return applyMeshMatrix(mesh, getSceneNormalMatrix(modelBoardNormalDirection))
}

function getBoardContactBounds(mesh: STLMesh | OBJMesh) {
  const minY = mesh.boundingBox.min.y
  const height = mesh.boundingBox.max.y - minY
  const tolerance = Math.max(1e-6, height * 1e-5)

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let hasContactVertex = false

  for (const triangle of mesh.triangles) {
    for (const vertex of triangle.vertices) {
      if (Math.abs(vertex.y - minY) > tolerance) continue

      hasContactVertex = true
      minX = Math.min(minX, vertex.x)
      maxX = Math.max(maxX, vertex.x)
      minZ = Math.min(minZ, vertex.z)
      maxZ = Math.max(maxZ, vertex.z)
    }
  }

  if (!hasContactVertex) return null

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: minY, z: maxZ },
  }
}

function getInferredMeshOrigin(
  cad: CadComponent,
  mesh: STLMesh | OBJMesh,
): Point3 {
  const meshBounds = mesh.boundingBox
  const alignment = cad.model_origin_alignment ?? cad.anchor_alignment

  if (alignment === "center_of_component_on_board_surface") {
    const contactBounds = getBoardContactBounds(mesh)
    const center = getBoundingBoxCenter(contactBounds ?? meshBounds)

    return {
      x: center.x,
      y: 0,
      z: center.z,
    }
  }

  if (alignment === "center") {
    return getBoundingBoxCenter(meshBounds)
  }

  return { x: 0, y: 0, z: 0 }
}

export function getMeshOrigin(
  cad: CadComponent,
  mesh: STLMesh | OBJMesh,
  options?: {
    loaderTransform?: CoordinateTransformConfig
    modelBoardNormalDirection?: CadComponent["model_board_normal_direction"]
  },
): Point3 | null {
  if (cad.model_origin_position) {
    let origin: Point3 = {
      x: cad.model_origin_position.x,
      y: cad.model_origin_position.y,
      z: cad.model_origin_position.z,
    }

    if (options?.loaderTransform) {
      origin = applyCoordinateTransform(origin, options.loaderTransform)
    }

    if (options?.modelBoardNormalDirection) {
      origin = applyMat4ToPoint3(
        getSceneNormalMatrix(options.modelBoardNormalDirection),
        origin,
      )
    }

    return origin
  }

  return getInferredMeshOrigin(cad, mesh)
}

export function fitMeshToCadBounds<T extends STLMesh | OBJMesh>(
  mesh: T,
  targetSize: Point3,
  fitMode: NonNullable<CadComponent["model_object_fit"]>,
): T {
  const size = getBoundingBoxSize(mesh.boundingBox)
  let fitScale: Point3
  if (size.x === 0 || size.y === 0 || size.z === 0) {
    // Preserve this legacy API's ratio-1 flat-axis policy, not the canonical
    // resolver's ignore-for-contain / reject-for-fill behavior.
    const ratios = {
      x: size.x > 0 ? targetSize.x / size.x : 1,
      y: size.y > 0 ? targetSize.y / size.y : 1,
      z: size.z > 0 ? targetSize.z / size.z : 1,
    }
    const uniform = Math.min(ratios.x, ratios.y, ratios.z)
    fitScale =
      fitMode === "fill_bounds"
        ? ratios
        : { x: uniform, y: uniform, z: uniform }
  } else {
    fitScale = getCadModelFitScaleFromBounds(
      mesh.boundingBox,
      targetSize,
      fitMode,
    )
  }
  return applyMeshMatrix(
    mesh,
    mat4.fromScaling(new Float64Array(16), [
      fitScale.x,
      fitScale.y,
      fitScale.z,
    ]),
  )
}

/**
 * Decode-space normalization is explicit and remains owned by the loaders.
 * Recover native bounds/points, resolve origin/units/normal/fit once, then adapt
 * the shared matrix to Scene3D. No Euler decomposition is used by the exporter.
 */
export function placeCadMesh<T extends STLMesh | OBJMesh>(
  cad: CadComponent,
  mesh: T,
  nativeToScene: ReadonlyMat4,
  options: { boardContactPoint?: Point3 } = {},
): { mesh: T; matrix: mat4 } {
  const sceneToNative = mat4.invert(new Float64Array(16), nativeToScene)
  if (!sceneToNative) throw new Error("CAD loader transform must be invertible")
  const nativeMesh = applyMeshMatrix(mesh, sceneToNative)
  const nativeToCanonicalModel = composeMat4(CAD_TO_SCENE_MATRIX, nativeToScene)
  const alignment = cad.model_origin_alignment ?? cad.anchor_alignment
  let boardContactPoint = options.boardContactPoint
  if (
    !cad.model_origin_position &&
    !boardContactPoint &&
    alignment === "center_of_component_on_board_surface"
  ) {
    const aligned = composeMat4(
      mat4.fromQuat(
        new Float64Array(16),
        getCadModelBoardNormalQuaternion(
          cad.model_board_normal_direction,
          nativeToCanonicalModel,
        ),
      ),
      nativeToCanonicalModel,
    )
    const alignedMesh = applyMeshMatrix(nativeMesh, aligned)
    const minZ = alignedMesh.boundingBox.min.z
    const tolerance = Math.max(
      1e-6,
      (alignedMesh.boundingBox.max.z - minZ) * 1e-5,
    )
    const contact = alignedMesh.triangles
      .flatMap((triangle) => triangle.vertices)
      .filter((point) => Math.abs(point.z - minZ) <= tolerance)
    if (contact.length === 0)
      throw new Error("Cannot measure the CAD model's board contact patch")
    const contactCenter = getBoundingBoxCenter(
      boundsOfPositions(
        contact.flatMap((point) => [point.x, point.y, point.z]),
      ),
    )
    const inverse = mat4.invert(new Float64Array(16), aligned)
    if (!inverse) throw new Error("CAD normal alignment must be invertible")
    const native = vec3.transformMat4(
      new Float64Array(3),
      [contactCenter.x, contactCenter.y, minZ],
      inverse,
    )
    boardContactPoint = { x: native[0]!, y: native[1]!, z: native[2]! }
  }
  const placement = getCadModelPlacement(cad, {
    nativeBounds: nativeMesh.boundingBox,
    nativeToCanonicalModel,
    sizeSpace: "native",
    boardContactPoint,
  })
  const rotation = cad.rotation ?? { x: 0, y: 0, z: 0 }
  const board = mat4.fromRotationTranslation(
    new Float64Array(16),
    quaternionFromEulerDegrees(rotation, "xyz"),
    [cad.position.x, cad.position.y, cad.position.z],
  )
  const inverseBoard = mat4.invert(new Float64Array(16), board)
  if (!inverseBoard) throw new Error("CAD target placement must be invertible")
  const modelToScene = composeMat4(
    CAD_TO_SCENE_MATRIX,
    inverseBoard,
    placement.nativeToWorld,
  )
  return {
    mesh: applyMeshMatrix(nativeMesh, modelToScene),
    matrix: composeMat4(CAD_TO_SCENE_MATRIX, board, CAD_TO_SCENE_MATRIX),
  }
}
