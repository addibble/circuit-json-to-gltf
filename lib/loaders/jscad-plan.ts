import * as jscadModeling from "@jscad/modeling"
import * as geom3 from "@jscad/modeling/src/geometries/geom3"
import type { Geom3 } from "@jscad/modeling/src/geometries/types"
import { executeJscadOperations } from "jscad-planner"
import type { Color, STLMesh } from "../types"
import { boundsOfTriangles } from "../utils/bounding-box"
import {
  COORDINATE_TRANSFORMS,
  transformTriangles,
} from "../utils/coordinate-transform"
import { geom3ToTriangles } from "../utils/pcb-board-geometry"

const JSCAD_PLAN_TRANSFORM = COORDINATE_TRANSFORMS.CIRCUIT_Z_UP_TO_SCENE_Y_UP

export const loadJscadPlan = (plan: unknown): STLMesh => {
  const zUpGeometry = executeJscadOperations(
    jscadModeling as any,
    plan as any,
  ) as Geom3
  const polygons = geom3.toPolygons(zUpGeometry)
  const triangles = transformTriangles(
    geom3ToTriangles(zUpGeometry, polygons),
    JSCAD_PLAN_TRANSFORM,
  )

  // A `colorize` operation anywhere in the plan leaves its colour on the
  // resulting geometry, so a generated part can state its own material and have
  // it survive into the scene. Read here rather than assumed by the caller: the
  // plan is the only thing that knows whether one was applied.
  //
  // jscad states colour as 0..1 per channel; this codebase's `Color` array form
  // is 0..255 with a 0..1 alpha (see `addMaterialFromColor`). Converting here
  // keeps that conversion in the one place that spans the two conventions --
  // passing 0..1 straight through renders very nearly black, which looks like a
  // lighting fault rather than a unit mismatch.
  const planColor = (zUpGeometry as Geom3 & { color?: number[] }).color
  const color: Color | undefined =
    Array.isArray(planColor) && planColor.length >= 3
      ? [
          (planColor[0] as number) * 255,
          (planColor[1] as number) * 255,
          (planColor[2] as number) * 255,
          (planColor[3] as number | undefined) ?? 1,
        ]
      : undefined

  // Bounds come from the triangles this mesh ships, not from measuring the
  // source Geom3: the geometry stays Z-up and only the triangles are remapped,
  // so the source box describes a different frame, and moving that box into
  // this one is only exact while the transform keeps axes aligned. Scanning the
  // triangles is exact for any transform and costs one pass over vertices we
  // have just built anyway -- the same thing the STL/OBJ/GLB/STEP loaders do.
  return {
    triangles,
    boundingBox: boundsOfTriangles(triangles),
    ...(color ? { color } : {}),
  }
}
