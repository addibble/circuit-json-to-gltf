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
 * ## Fasteners are sectioned, but not patterned
 *
 * Drafting practice leaves a fastener unsectioned when the plane runs along its
 * axis. That convention exists for readability, and here it costs more than it
 * buys: an unsectioned bolt hides the insert it is threaded into, and the pair
 * is the whole point of the view. So every material is cut, and fasteners are
 * distinguished by flat colour instead -- see MATERIAL_GROUPS, where their cap
 * "hatch" is a line the same colour as its ground.
 */
export const buildSectionedGlbByMaterial = async ({
  plane = "xy",
  zOffset,
  yOffset,
  side,
}: {
  plane?: "xy" | "xz" | "yz"
  zOffset?: number
  yOffset?: number
  side: "z+" | "z-" | "y+" | "y-"
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
      // pcb_hole carries no source_component_id, so it matches no fastener
      // group -- it has to travel with the board explicitly, or the board is
      // built solid and every bolt appears to stop at its top face and resume
      // underneath.
      if (element.type === "pcb_board" || element.type === "pcb_hole") {
        return group.includesBoard
      }
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
    const sliced = await sliceGLB(
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

    const doc = await io.readBinary(
      new Uint8Array(sliced.buffer as ArrayBuffer),
    )
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
