import { expect, test } from "bun:test"
import * as jscad from "@jscad/modeling"
import type { Geom3 } from "@jscad/modeling/src/geometries/types"
import { getAssemblyHardwareGeom } from "@tscircuit/jscad-assembly-hardware"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"

test("real hardware preserves its native datum and complete XYZ placement", async () => {
  const position = { x: 11, y: -7, z: 13 }
  for (const footprint of [
    "screw_m3_l8_socketcap",
    "bolt_m3_l12_countersunk",
    "heatsetinsert_m3_l5.7",
    "spacer_od6_id3.2_l4",
  ]) {
    for (const rotation of [
      { x: 0, y: 0, z: 0 },
      { x: 180, y: 0, z: 0 },
      { x: 31, y: 47, z: 23 },
    ]) {
      const scene = await convertCircuitJsonTo3D(
        [
          {
            type: "cad_component",
            cad_component_id: "hardware",
            pcb_component_id: "hardware_owner",
            source_component_id: "hardware_source",
            footprinter_string: footprint,
            position,
            rotation,
            anchor_alignment: "center_of_component_on_board_surface",
            model_object_fit: "contain_within_bounds",
            model_origin_position: { x: 0, y: 0, z: 0 },
          },
        ],
        { renderBoardTextures: false, drawFauxBoard: false },
      )
      expect(scene.boxes).toHaveLength(1)
      const box = scene.boxes[0]!
      expect(box.center).toEqual({ x: 11, y: 13, z: -7 })
      expect(box.rotation).toBeUndefined()
      expect(box.mesh).toBeDefined()

      const solid = getAssemblyHardwareGeom(footprint, jscad)
      if (!jscad.geometries.geom3.isA(solid)) {
        throw new Error(`Expected solid hardware for ${footprint}`)
      }
      // Independent physical probe: JSCAD native Z-up solids, XYZ intrinsic
      // rotation (Z then Y then X applied to points), then the scene axis swap.
      const radians = Math.PI / 180
      const placed = jscad.transforms.rotateX(
        rotation.x * radians,
        jscad.transforms.rotateY(
          rotation.y * radians,
          jscad.transforms.rotateZ(rotation.z * radians, solid as Geom3),
        ),
      )
      const [min, max] = jscad.measurements.measureBoundingBox(placed)
      for (const [sceneAxis, nativeAxis] of [
        ["x", 0],
        ["y", 2],
        ["z", 1],
      ] as const) {
        expect(box.mesh!.boundingBox.min[sceneAxis]).toBeCloseTo(
          min[nativeAxis],
          4,
        )
        expect(box.mesh!.boundingBox.max[sceneAxis]).toBeCloseTo(
          max[nativeAxis],
          4,
        )
      }
    }
  }
})
