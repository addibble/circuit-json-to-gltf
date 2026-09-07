import type { CoordinateTransformConfig, Point3, Triangle } from "../types"
import { mat3, vec3 } from "gl-matrix"
import {
  applyMat4ToPoint3,
  composeMat4,
  mat4,
  quaternionFromEulerDegrees,
  type ReadonlyMat4,
} from "@tscircuit/circuit-json-util"

/** Legacy decoder order: axis map, flips, then extrinsic X, Y, Z degrees. */
export function getCoordinateTransformMatrix(
  config: CoordinateTransformConfig,
): mat4 {
  const matrix = mat4.identity(new Float64Array(16))
  const axes = ["x", "y", "z"] as const
  for (const [row, axis] of axes.entries()) {
    const mapping = config.axisMapping?.[axis] ?? axis
    const source = mapping.replace("-", "")
    const column = axes.findIndex((candidate) => candidate === source)
    if (column < 0)
      throw new Error(`Invalid coordinate axis mapping: ${mapping}`)
    for (let i = 0; i < 3; i++) matrix[i * 4 + row] = 0
    matrix[column * 4 + row] = mapping.startsWith("-") ? -1 : 1
  }
  return composeMat4(
    mat4.fromQuat(
      new Float64Array(16),
      quaternionFromEulerDegrees(
        {
          x: config.rotation?.x ?? 0,
          y: config.rotation?.y ?? 0,
          z: config.rotation?.z ?? 0,
        },
        "zyx",
      ),
    ),
    mat4.fromScaling(new Float64Array(16), [
      config.flipX ?? 1,
      config.flipY ?? 1,
      config.flipZ ?? 1,
    ]),
    matrix,
  )
}

export function applyCoordinateTransform(
  point: Point3,
  config: CoordinateTransformConfig,
): Point3 {
  return applyMat4ToPoint3(getCoordinateTransformMatrix(config), point)
}

/** Points include translation; shading normals use the inverse transpose. */
export function transformTrianglesByMatrix(
  triangles: Triangle[],
  matrix: ReadonlyMat4,
): Triangle[] {
  const normalMatrix = mat3.normalFromMat4(mat3.create(), matrix)
  if (!normalMatrix)
    throw new Error("Cannot transform mesh normals with a singular matrix")
  return triangles.map((triangle) => {
    const normal = vec3.transformMat3(
      vec3.create(),
      [triangle.normal.x, triangle.normal.y, triangle.normal.z],
      normalMatrix,
    )
    vec3.normalize(normal, normal)
    return {
      ...triangle,
      vertices: triangle.vertices.map((vertex) => {
        return applyMat4ToPoint3(matrix, vertex)
      }) as [Point3, Point3, Point3],
      normal: { x: normal[0]!, y: normal[1]!, z: normal[2]! },
    }
  })
}

export function transformTriangles(
  triangles: Triangle[],
  config: CoordinateTransformConfig,
): Triangle[] {
  return transformTrianglesByMatrix(
    triangles,
    getCoordinateTransformMatrix(config),
  )
}

// Predefined transformation configs for common model orientations
export const COORDINATE_TRANSFORMS = {
  // Circuit/CAD Z-up (JSCAD geometry) to the intermediate Scene3D Y-up frame.
  // NOTE the name says SCENE, not GLTF: this is NOT the final glTF frame.
  // GLTFBuilder.convertMeshToGLTFOrientation applies the single canonical
  // X-mirror (and winding flip) to every mesh when exporting Scene3D -> glTF,
  // so X is intentionally NOT negated here -- negating it here as well would
  // mirror JSCAD geometry alone, away from the board and OBJ models.
  //   Circuit +X -> Scene +X   (mirrored to glTF -X later, like all meshes)
  //   Circuit +Y -> Scene +Z   (forward)
  //   Circuit +Z -> Scene +Y   (up)
  // Identical to OBJ_Z_UP_TO_Y_UP by construction: JSCAD geometry has to share
  // one frame with the OBJ component models it sits beside. The rotateX(-PI/2)
  // this replaced sent Circuit +Y to Scene -Z, rotating every model_jscad
  // component 180 degrees about X relative to its own cad_component.position.
  CIRCUIT_Z_UP_TO_SCENE_Y_UP: {
    axisMapping: { x: "x", y: "z", z: "y" },
  } as CoordinateTransformConfig,

  // Default: Z-up to Y-up (current STL behavior)
  Z_UP_TO_Y_UP: {
    axisMapping: { x: "x", y: "-z", z: "y" },
  } as CoordinateTransformConfig,

  // For models where Z+ should point "out of top of board"
  Z_OUT_OF_TOP: {
    axisMapping: { x: "x", y: "z", z: "-y" },
  } as CoordinateTransformConfig,

  // STEP models need Y/Z remap without the extra 180-degree board-direction flip.
  STEP_INVERTED: {
    axisMapping: { x: "x", y: "z", z: "y" },
  } as CoordinateTransformConfig,

  // USB port fix: flip to top of board (flip Y axis after Z-up conversion)
  USB_PORT_FIX: {
    flipY: -1,
  } as CoordinateTransformConfig,

  // Combined: Z-up to Y-up + USB port fix (flip Z to face outward)
  Z_UP_TO_Y_UP_USB_FIX: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    flipZ: -1,
  } as CoordinateTransformConfig,

  // No transformation
  IDENTITY: {} as CoordinateTransformConfig,

  // Additional test orientations for USB port
  TEST_ROTATE_X_90: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    rotation: { x: 90 },
  } as CoordinateTransformConfig,

  TEST_ROTATE_X_270: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    rotation: { x: 270 },
  } as CoordinateTransformConfig,

  TEST_ROTATE_Y_90: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    rotation: { y: 90 },
  } as CoordinateTransformConfig,

  TEST_ROTATE_Y_270: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    rotation: { y: 270 },
  } as CoordinateTransformConfig,

  TEST_ROTATE_Z_90: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    rotation: { z: 90 },
  } as CoordinateTransformConfig,

  TEST_ROTATE_Z_270: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    rotation: { z: 270 },
  } as CoordinateTransformConfig,

  // Flip combinations
  TEST_FLIP_X: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    flipX: -1,
  } as CoordinateTransformConfig,

  TEST_FLIP_Z: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    flipZ: -1,
  } as CoordinateTransformConfig,
  FOOTPRINTER_MODEL_TRANSFORM: {
    axisMapping: { x: "x", y: "-z", z: "y" },
    flipX: -1,
    rotation: { x: 180, y: 180 },
  } as CoordinateTransformConfig,

  // OBJ models: Z-up to Y-up with Y→Z (no negation to preserve winding order)
  OBJ_Z_UP_TO_Y_UP: {
    axisMapping: { x: "x", y: "z", z: "y" },
  } as CoordinateTransformConfig,
} as const
