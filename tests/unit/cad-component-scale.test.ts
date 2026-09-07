import { test, expect } from "bun:test"
import type { CadComponent } from "circuit-json"
import { convertCircuitJsonTo3D } from "../../lib"

const SIMPLE_ASCII_STL = `solid test
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 1
      vertex 0 1 0
      vertex 1 0 0
    endloop
  endfacet
endsolid test`

test("model units scale native geometry but not declared millimeter target sizes", async () => {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return new Response(SIMPLE_ASCII_STL, {
        headers: { "Content-Type": "model/stl" },
      })
    },
  })

  try {
    const cad: CadComponent = {
      type: "cad_component",
      cad_component_id: "cad1",
      pcb_component_id: "pcb1",
      source_component_id: "source1",
      anchor_alignment: "center",
      model_object_fit: "contain_within_bounds",
      model_origin_position: { x: 0, y: 0, z: 0 },
      model_stl_url: `http://127.0.0.1:${server.port}/model.stl`,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      model_unit_to_mm_scale_factor: 2,
    }
    for (const [size, expectedSize] of [
      [undefined, 2],
      [{ x: 1, y: 1, z: 1 }, 1],
    ] as const) {
      const scene = await convertCircuitJsonTo3D([{ ...cad, size }], {
        renderBoardTextures: false,
      })
      expect(scene.boxes).toHaveLength(1)
      const box = scene.boxes[0]!

      expect(box.size.x).toBeCloseTo(expectedSize)
      expect(box.size.y).toBeCloseTo(expectedSize)
      expect(box.size.z).toBeCloseTo(expectedSize)

      expect(box.mesh).toBeDefined()
      expect(box.mesh!.boundingBox.max.x).toBeCloseTo(expectedSize)
      expect(box.mesh!.boundingBox.min.x).toBeCloseTo(0)
    }
  } finally {
    await server.stop()
  }
})
