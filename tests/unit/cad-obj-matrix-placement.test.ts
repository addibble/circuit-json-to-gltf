import { expect, test } from "bun:test"
import {
  applyMat4ToPoint3,
  getCadModelPlacement,
  mat4,
} from "@tscircuit/circuit-json-util"
import type { CadComponent, CadModelAxisDirection } from "circuit-json"
import { convertCircuitJsonTo3D } from "../../lib/converters/circuit-to-3d"
import { GLTFBuilder } from "../../lib/gltf/gltf-builder"
import { parseGLB } from "../../lib/loaders/glb"
import { COORDINATE_TRANSFORMS } from "../../lib/utils/coordinate-transform"

test("noncentered OBJ markers use the shared matrix through final GLB on every normal and layer", async () => {
  const obj = [
    "v 11 22 33",
    "v 10 20 30",
    "v 16 20 30",
    "v 10 24 30",
    "v 16 24 50",
    "f 1 2 3",
    "f 2 4 5",
    "f 3 5 4",
  ].join("\n")
  const server = Bun.serve({ port: 0, fetch: () => new Response(obj) })
  const directions: Record<CadModelAxisDirection, number[]> = {
    "z+": [1, 2, 3],
    "z-": [1, -2, -3],
    "x+": [-3, 2, 1],
    "x-": [3, 2, -1],
    "y+": [1, -3, 2],
    "y-": [1, 3, -2],
  }
  try {
    for (const [normal, marker] of Object.entries(directions)) {
      for (const layer of ["top", "bottom"] as const) {
        for (const degrees of [0, 90, 180, 270]) {
          const cad: CadComponent = {
            type: "cad_component",
            cad_component_id: "cad",
            pcb_component_id: "pcb",
            source_component_id: "source",
            anchor_alignment: "center",
            model_obj_url: `${server.url}native.obj`,
            position: { x: 7, y: -5, z: layer === "top" ? 2 : -2 },
            rotation: { x: 0, y: layer === "bottom" ? 180 : 0, z: degrees },
            model_board_normal_direction: normal as CadModelAxisDirection,
            model_origin_position: { x: 10, y: 20, z: 30 },
            size: { x: 6, y: 4, z: 20 },
            model_object_fit: "contain_within_bounds",
          }
          const scene = await convertCircuitJsonTo3D(
            [
              cad,
              {
                type: "pcb_component",
                pcb_component_id: "pcb",
                source_component_id: "source",
                center: { x: 7, y: -5 },
                width: 6,
                height: 4,
                layer,
                rotation: degrees,
                obstructs_within_bounds: false,
              },
            ],
            { renderBoardTextures: false },
          )
          const box = scene.boxes[0]!
          const world = applyMat4ToPoint3(
            box.matrix!,
            box.mesh!.triangles[0]!.vertices[0],
          )
          const radians = (degrees * Math.PI) / 180
          const x =
            marker[0]! * Math.cos(radians) - marker[1]! * Math.sin(radians)
          const y =
            marker[0]! * Math.sin(radians) + marker[1]! * Math.cos(radians)
          expect(world.x).toBeCloseTo(7 + (layer === "bottom" ? -x : x), 4)
          expect(world.z).toBeCloseTo(-5 + y, 4)
          expect(world.y).toBeCloseTo(
            cad.position.z + (layer === "bottom" ? -marker[2]! : marker[2]!),
            4,
          )
          const shared = getCadModelPlacement(cad, {
            nativeBounds: {
              min: { x: 10, y: 20, z: 30 },
              max: { x: 16, y: 24, z: 50 },
            },
            nativeToCanonicalModel: mat4.create(),
            sizeSpace: "native",
          })
          const canonical = applyMat4ToPoint3(shared.nativeToWorld, {
            x: 11,
            y: 22,
            z: 33,
          })
          expect(world.x).toBeCloseTo(canonical.x, 4)
          expect(world.y).toBeCloseTo(canonical.z, 4)
          expect(world.z).toBeCloseTo(canonical.y, 4)
          const builder = new GLTFBuilder()
          await builder.buildFromScene3D(scene)
          const glb = builder.export(true)
          expect(glb).toBeInstanceOf(ArrayBuffer)
          if (!(glb instanceof ArrayBuffer))
            throw new Error("Expected binary GLB")
          const exported = parseGLB(glb, COORDINATE_TRANSFORMS.IDENTITY)
            .triangles[0]!.vertices[0]
          expect(exported.x).toBeCloseTo(-world.x, 4)
          expect(exported.y).toBeCloseTo(world.y, 4)
          expect(exported.z).toBeCloseTo(world.z, 4)
        }
      }
    }
  } finally {
    server.stop(true)
  }
})
