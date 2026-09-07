import { expect, test } from "bun:test"
import { NodeIO } from "@gltf-transform/core"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToGltf } from "../../lib"
import { renderGlbToPng } from "../renderGlbToPng"

test("GLB material reference retains steel, black-oxide and brass hardware colors", async () => {
  const samples = [
    {
      footprint: "screw_m3_l8mm_socketcap",
      rgb: [191, 199, 209],
    },
    {
      footprint: "bolt_m3_l12mm_socketcap",
      rgb: [61, 64, 71],
    },
    {
      footprint: "heatsetinsert_m3_l5.7mm",
      rgb: [199, 153, 51],
    },
  ]
  const circuitJson: CircuitJson = samples.flatMap(
    ({ footprint }, index): CircuitJson => [
      {
        type: "source_component",
        source_component_id: `source_${index}`,
        ftype: "simple_chip",
        name: footprint,
      },
      {
        type: "pcb_component",
        pcb_component_id: `pcb_${index}`,
        source_component_id: `source_${index}`,
        center: { x: (index - 1) * 12, y: 0 },
        width: 0,
        height: 0,
        layer: "top",
        rotation: 0,
        obstructs_within_bounds: false,
      },
      {
        type: "cad_component",
        cad_component_id: `cad_${index}`,
        pcb_component_id: `pcb_${index}`,
        source_component_id: `source_${index}`,
        position: { x: (index - 1) * 12, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        anchor_alignment: "center",
        model_object_fit: "contain_within_bounds",
        model_origin_position: { x: 0, y: 0, z: 0 },
        footprinter_string: footprint,
      },
    ],
  )
  const glb = await convertCircuitJsonToGltf(circuitJson, { format: "glb" })
  if (!(glb instanceof ArrayBuffer)) throw new Error("Expected binary GLB")

  // This is an exporter reference, NOT evidence of the interactive viewer's
  // behavior. No fixture colorize overrides: materials come from the dispatcher.
  const png = await renderGlbToPng(glb, circuitJson, {
    width: 736,
    height: 448,
    backgroundColor: "#e8e8e8",
    // Exported scene is Y-up, in mm (see the existing flexscreen snapshot).
    camPos: [12, 20, -50],
    lookAt: [0, -3, 0],
    up: "y+",
    fov: 42,
    ambient: 0.6,
  })
  await Bun.write(
    new URL(
      "../assets/hardware-rgba-export-material-reference.png",
      import.meta.url,
    ),
    png,
  )

  const document = await new NodeIO().readBinary(new Uint8Array(glb))
  const materials = document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) =>
      mesh.listPrimitives().map((primitive) => primitive.getMaterial()),
    )
  expect(materials).toHaveLength(samples.length)
  expect(
    materials.map((material) =>
      material
        ?.getBaseColorFactor()
        .map((channel) => Math.round(channel * 255)),
    ),
  ).toEqual(samples.map(({ rgb }) => [...rgb, 255]))
})
