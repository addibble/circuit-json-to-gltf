import { expect, test } from "bun:test"

test("the exporter excludes electronics releases without hardware dispatch", async () => {
  const manifest = await Bun.file(
    new URL("../package.json", import.meta.url),
  ).json()
  const range = manifest.dependencies["jscad-electronics"]

  expect(range).toBeString()
  // Electronics 0.0.159 predates assembly-hardware model dispatch.
  expect(Bun.semver.satisfies("0.0.159", range)).toBe(false)
})
