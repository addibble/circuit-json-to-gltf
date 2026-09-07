import { expect, test } from "bun:test"

test("section fixtures declare their direct slicing dependencies", async () => {
  const manifest = await Bun.file(
    new URL("../package.json", import.meta.url),
  ).json()
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  }

  expect(Object.keys(dependencies)).toEqual(
    expect.arrayContaining([
      "gltf-slice",
      "@gltf-transform/core",
      "@gltf-transform/functions",
    ]),
  )
})
