import { Document, NodeIO } from "@gltf-transform/core"
import { mergeDocuments } from "@gltf-transform/functions"
import type { CircuitJson } from "circuit-json"
import { sliceGLB } from "gltf-slice"
import { convertCircuitJsonToGltf } from "../../lib"
import {
  buildEnclosureAssemblyCircuitJson,
  MATERIAL_GROUPS,
} from "./enclosure-assembly"

/**
 * Section the assembly, hatching each material differently.
 *
 * `gltf-slice` assigns one cap material per document, so a single pass draws
 * every cut face with the same hatch -- and a bolt cut inside a boss disappears
 * into the boss. Each material is therefore sliced in its own pass with its own
 * hatch, and the results are merged back into one document.
 *
 * ## Sectioning fasteners, or not
 *
 * Drafting practice: a screw, bolt, nut, pin or shaft is **not** sectioned when
 * the cutting plane passes along its axis -- it is drawn whole, in elevation --
 * because hatching a solid body of revolution says nothing and only clutters
 * the view. It **is** sectioned when the plane cuts across the axis, where the
 * cut is the only thing that shows the fastener at all: a transverse plane
 * taken from above would otherwise show a bolt head and nothing beneath it.
 *
 * So `sectionFasteners` follows the plane, not taste. A longitudinal cut merges
 * the fastener groups whole; a transverse cut slices them like everything else.
 */
export const buildSectionedGlbByMaterial = async ({
  plane = "xy",
  zOffset,
  yOffset,
  side,
  sectionFasteners,
}: {
  plane?: "xy" | "xz" | "yz"
  zOffset?: number
  yOffset?: number
  side: "z+" | "z-" | "y+" | "y-"
  sectionFasteners: boolean
}): Promise<ArrayBuffer> => {
  const full = buildEnclosureAssemblyCircuitJson() as unknown as Array<{
    type: string
    name?: string
    source_component_id?: string
    cad_component_id?: string
  }>

  const nameBySourceId = new Map<string, string>()
  for (const element of full) {
    if (element.type === "source_component" && element.source_component_id) {
      nameBySourceId.set(element.source_component_id, element.name ?? "")
    }
  }

  const io = new NodeIO()
  let merged: Document | null = null

  for (const group of MATERIAL_GROUPS) {
    const subset = full.filter((element) => {
      if (element.type === "pcb_board") return group.includesBoard
      const name = element.source_component_id
        ? (nameBySourceId.get(element.source_component_id) ?? "")
        : ""
      return name ? group.matches(name) : false
    })

    // A group with nothing in it would slice an empty document.
    const hasGeometry = subset.some(
      (element) => element.type === "cad_component" || group.includesBoard,
    )
    if (!hasGeometry) continue

    const glb = (await convertCircuitJsonToGltf(
      subset as unknown as never,
      {
        format: "glb",
      } as never,
    )) as ArrayBuffer

    // sliceGLB takes the plane spec and the slice options as SEPARATE
    // arguments; a `hatch` folded into the spec is silently ignored, which
    // renders as every material sharing the default hatch.
    //
    // A fastener cut along its own axis is drawn whole, so its geometry goes in
    // unsliced -- including the half on the removed side, which is what "shown
    // in elevation" means.
    const shouldSlice = sectionFasteners || !group.isFastener

    const geometry = shouldSlice
      ? ((
          await sliceGLB(
            new Uint8Array(glb),
            {
              plane,
              ...(zOffset === undefined ? {} : { zOffset }),
              ...(yOffset === undefined ? {} : { yOffset }),
              side,
            } as never,
            {
              hatch: group.hatch as never,
              capMaterialName: `section_${group.key}`,
            },
          )
        ).buffer as ArrayBuffer)
      : glb

    const doc = await io.readBinary(new Uint8Array(geometry))
    if (!merged) {
      merged = doc
      continue
    }

    mergeDocuments(merged, doc)

    // mergeDocuments brings the source's scenes across intact; the renderer
    // draws one scene, so the newcomers' children are reparented into the first
    // and the now-empty scenes disposed.
    const scenes = merged.getRoot().listScenes()
    const primary = scenes[0]!
    for (const scene of scenes.slice(1)) {
      for (const child of scene.listChildren()) primary.addChild(child)
      scene.dispose()
    }
  }

  if (!merged) throw new Error("no material group produced geometry")

  // Each merged document brought its own buffer, and a GLB may only have one.
  // Repoint every accessor at the first and drop the rest.
  const buffers = merged.getRoot().listBuffers()
  const primaryBuffer = buffers[0]!
  for (const accessor of merged.getRoot().listAccessors()) {
    accessor.setBuffer(primaryBuffer)
  }
  for (const buffer of buffers.slice(1)) buffer.dispose()

  const out = await io.writeBinary(merged)
  return out.buffer.slice(
    out.byteOffset,
    out.byteOffset + out.byteLength,
  ) as ArrayBuffer
}
