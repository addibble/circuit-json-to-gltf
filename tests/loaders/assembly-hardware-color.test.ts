import { expect, test } from "bun:test"
import { loadFootprinterModel } from "../../lib/loaders/footprinter"

/**
 * Hardware states its own material, and that colour has to survive the whole
 * footprinter path to be worth anything.
 *
 * It travels a long way: `colorize` in the plan, executed to a Geom3 carrying
 * `.color`, lifted onto the ColoredGeom by jscad-electronics' dispatch, turned
 * into per-vertex colours by jscad-to-gltf, and grouped back into materials by
 * parseGLB. Every one of those hops is somewhere it could be dropped in silence
 * -- and it was: before the dispatch lifted it, the colour was present in the
 * solid and invisible to everything downstream, so real hardware took the
 * scene's single fallback while hand-built fixtures looked right.
 *
 * Note this arrives as per-triangle material colour rather than as the single
 * `STLMesh.color` that a baked jscad plan produces. Two paths, two shapes; a
 * check written against the wrong one reports a working pipeline as broken.
 */

const firstTriangleColor = async (modelString: string) => {
  const mesh = (await loadFootprinterModel(modelString, {})) as
    | { triangles?: { color?: number[] }[] }
    | undefined
  return mesh?.triangles?.[0]?.color
}

test("a screw arrives in steel, an insert in brass", async () => {
  const screw = await firstTriangleColor("screw_m3_l8mm_socketcap")
  const insert = await firstTriangleColor("heatsetinsert_m3_l5.7mm")

  // 0.75/0.78/0.82 and 0.78/0.6/0.2, scaled to the 0-255 form used here.
  expect(screw?.slice(0, 3)).toEqual([191, 199, 209])
  expect(insert?.slice(0, 3)).toEqual([199, 153, 51])
})

test("a bolt is not the same colour as the screw beside it", async () => {
  // In a section these sit millimetres apart and are otherwise the same
  // silhouette, so this is the only thing telling them apart.
  const bolt = await firstTriangleColor("bolt_m3_l12mm_socketcap")
  const screw = await firstTriangleColor("screw_m3_l8mm_socketcap")
  expect(bolt).not.toEqual(screw)
})

test("colour is in the 0-255 form this pipeline uses, not jscad's 0-1", async () => {
  // Passing 0-1 through renders very nearly black, which reads as a lighting
  // fault rather than a unit mismatch -- so the boundary is worth pinning.
  const screw = await firstTriangleColor("screw_m3_l8mm_socketcap")
  expect(screw?.some((channel) => channel > 1)).toBe(true)
})
