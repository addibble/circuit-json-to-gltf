import { expect, test } from "bun:test"
import type { CadComponent } from "circuit-json"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"

test("native normalization follows the selected loader, not lower-priority model fields", async () => {
  const stl = `solid part
facet normal 0 0 1
outer loop
vertex 11 22 33
vertex 16 20 30
vertex 10 24 50
endloop
endfacet
endsolid part`
  const server = Bun.serve({ port: 0, fetch: () => new Response(stl) })
  const cad: CadComponent = {
    type: "cad_component",
    cad_component_id: "cad",
    pcb_component_id: "pcb",
    source_component_id: "source",
    anchor_alignment: "center",
    position: { x: 7, y: -5, z: 2 },
    rotation: { x: 17, y: 31, z: 47 },
    model_stl_url: `${server.url}native.stl`,
    model_origin_position: { x: 10, y: 20, z: 30 },
    model_object_fit: "contain_within_bounds",
  }
  try {
    const only = await convertCircuitJsonTo3D([cad], {
      renderBoardTextures: false,
    })
    const mixed = await convertCircuitJsonTo3D(
      [
        {
          ...cad,
          model_glb_url: `${server.url}unused.glb`,
          model_jscad: { type: "cuboid", size: [1, 1, 1] },
        },
      ],
      { renderBoardTextures: false },
    )
    const expected = only.boxes[0]!.mesh!.triangles[0]!.vertices
    const actual = mixed.boxes[0]!.mesh!.triangles[0]!.vertices
    for (let i = 0; i < 3; i++)
      for (const axis of ["x", "y", "z"] as const) {
        expect(actual[i]![axis]).toBeCloseTo(expected[i]![axis], 4)
      }
  } finally {
    server.stop(true)
  }
})
