import { expect, test } from "bun:test"
import { loadJscadPlan } from "../../lib/loaders/jscad-plan"

test("a baked hardware plan preserves its stated material in scene RGB units", () => {
  const mesh = loadJscadPlan({
    type: "colorize",
    color: [0.78, 0.6, 0.2, 1],
    shape: { type: "cuboid", size: [2, 3, 4] },
  })
  expect(mesh.color).toEqual([198.9, 153, 51, 1])
  expect(mesh.triangles.length).toBeGreaterThan(0)
})
