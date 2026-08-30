import { getAssemblyHardwareModel } from "@tscircuit/jscad-assembly-hardware"
import type { CircuitJson } from "circuit-json"

/**
 * A minimal enclosure assembly, built to exercise the mounting hardware.
 *
 * Two self-tapping screws hold an empty PCB down onto floor bosses, and four
 * bolts hold the lid down into heat-set inserts at the corners. That is the
 * arrangement the mounting-hardware RFC describes, and the one a section view
 * exists to inspect: whether each fastener reaches its counterpart and clears
 * the board.
 *
 * ## Frame
 *
 * Circuit JSON is Z-up and millimetres. The board sits centred at the origin
 * with its top face at z = +0.8, and every hardware piece is placed by its
 * *seating face* -- the frame `jscad-assembly-hardware` builds in -- so a piece
 * is positioned by naming the surface it sits on and nothing else.
 */

export const BOARD = { width: 40, height: 24, thickness: 1.6 }
export const BOARD_TOP_Z = BOARD.thickness / 2
export const BOARD_BOTTOM_Z = -BOARD.thickness / 2

export const FLOOR_Z = -8
export const WALL_TOP_Z = 8
export const LID_TOP_Z = 10

/** Where the two PCB screws go: on the board's X axis, so y=0 cuts both. */
export const PCB_SCREW_POSITIONS = [
  { x: -15, y: 0 },
  { x: 15, y: 0 },
]

/** Corner mounts for the lid, just inside the walls. */
export const LID_BOLT_POSITIONS = [
  { x: -22, y: -14 },
  { x: 22, y: -14 },
  { x: -22, y: 14 },
  { x: 22, y: 14 },
]

export const PCB_SCREW_MODEL = "screw_m3_l8_socketcap"
export const LID_BOLT_MODEL = "bolt_m3_l10_socketcap"
export const INSERT_MODEL = "heatsetinsert_m3_l5.7"

const cuboid = (
  size: [number, number, number],
  center: [number, number, number],
) => ({
  type: "translate" as const,
  vector: center,
  shape: { type: "cuboid" as const, size },
})

const cylinder = (
  diameter: number,
  bottomZ: number,
  topZ: number,
  x: number,
  y: number,
) => ({
  type: "translate" as const,
  vector: [x, y, (bottomZ + topZ) / 2] as [number, number, number],
  shape: {
    type: "cylinder" as const,
    radius: diameter / 2,
    height: topZ - bottomZ,
    resolution: 24,
  },
})

const OUTER = { width: 55, height: 39 }
const CAVITY = { width: 50, height: 34 }

/** The enclosure base: a tray, with a boss under each fastener. */
const buildBase = () => ({
  type: "union" as const,
  shapes: [
    {
      type: "subtract" as const,
      shapes: [
        cuboid(
          [OUTER.width, OUTER.height, WALL_TOP_Z - FLOOR_Z],
          [0, 0, (FLOOR_Z + WALL_TOP_Z) / 2],
        ),
        // The cavity is open at the top, so it runs past WALL_TOP_Z.
        cuboid(
          [CAVITY.width, CAVITY.height, WALL_TOP_Z - FLOOR_Z],
          [0, 0, (FLOOR_Z + WALL_TOP_Z) / 2 + 2.5],
        ),
      ],
    },
    // Floor bosses the PCB screws thread into.
    ...PCB_SCREW_POSITIONS.map((p) =>
      cylinder(7, FLOOR_Z, BOARD_BOTTOM_Z, p.x, p.y),
    ),
    // Corner bosses carrying the inserts.
    ...LID_BOLT_POSITIONS.map((p) => cylinder(9, FLOOR_Z, WALL_TOP_Z, p.x, p.y)),
  ],
})

const buildLid = () =>
  cuboid(
    [OUTER.width, OUTER.height, LID_TOP_Z - WALL_TOP_Z],
    [0, 0, (WALL_TOP_Z + LID_TOP_Z) / 2],
  )

/**
 * Add one part: the three records a rendered piece needs.
 *
 * `cad_component` requires both a `source_component_id` and a
 * `pcb_component_id`, and assembly hardware has no board component -- so each
 * piece carries its own, as the RFC settles and `enclosure.fdm.box` already
 * does. The `pcb_component` is zero-size and suppressed so it cannot take part
 * in placement or DRC.
 */
const addPart = (
  circuitJson: CircuitJson,
  {
    name,
    position,
    model,
    color,
    showHiddenEdges,
  }: {
    name: string
    position: { x: number; y: number; z: number }
    model: unknown
    color?: { r: number; g: number; b: number }
    showHiddenEdges?: boolean
  },
) => {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_")
  circuitJson.push(
    {
      type: "source_component",
      source_component_id: `source_${id}`,
      name,
      supplier_part_numbers: {},
    } as never,
    {
      type: "pcb_component",
      pcb_component_id: `pcb_${id}`,
      source_component_id: `source_${id}`,
      center: { x: position.x, y: position.y },
      width: 0,
      height: 0,
      layer: "top",
      rotation: 0,
      do_not_place: true,
      is_allowed_to_be_off_board: true,
      obstructs_within_bounds: false,
    } as never,
    {
      type: "cad_component",
      cad_component_id: `cad_${id}`,
      pcb_component_id: `pcb_${id}`,
      source_component_id: `source_${id}`,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      model_jscad: model,
      ...(color ? { color } : {}),
      ...(showHiddenEdges ? { show_hidden_edges: true } : {}),
    } as never,
  )
}

export const buildEnclosureAssemblyCircuitJson = ({
  showHiddenEdges = false,
}: { showHiddenEdges?: boolean } = {}): CircuitJson => {
  const circuitJson: CircuitJson = [] as unknown as CircuitJson

  circuitJson.push({
    type: "pcb_board",
    pcb_board_id: "pcb_board_0",
    center: { x: 0, y: 0 },
    width: BOARD.width,
    height: BOARD.height,
    thickness: BOARD.thickness,
    num_layers: 2,
    material: "fr4",
  } as never)

  addPart(circuitJson, {
    name: "ENCLOSURE_BASE",
    position: { x: 0, y: 0, z: 0 },
    model: buildBase(),
    color: { r: 0.55, g: 0.58, b: 0.62 },
    showHiddenEdges,
  })
  addPart(circuitJson, {
    name: "ENCLOSURE_LID",
    position: { x: 0, y: 0, z: 0 },
    model: buildLid(),
    color: { r: 0.62, g: 0.65, b: 0.7 },
    showHiddenEdges,
  })

  // Screws seat on the board's top face and thread down into the floor bosses.
  PCB_SCREW_POSITIONS.forEach((p, index) => {
    addPart(circuitJson, {
      name: `PCB_SCREW_${index + 1}`,
      position: { x: p.x, y: p.y, z: BOARD_TOP_Z },
      model: getAssemblyHardwareModel(PCB_SCREW_MODEL),
      color: { r: 0.8, g: 0.82, b: 0.85 },
    })
  })

  // Bolts seat on the lid's top face; inserts seat flush under the lid.
  LID_BOLT_POSITIONS.forEach((p, index) => {
    addPart(circuitJson, {
      name: `LID_BOLT_${index + 1}`,
      position: { x: p.x, y: p.y, z: LID_TOP_Z },
      model: getAssemblyHardwareModel(LID_BOLT_MODEL),
      color: { r: 0.8, g: 0.82, b: 0.85 },
    })
    addPart(circuitJson, {
      name: `LID_INSERT_${index + 1}`,
      position: { x: p.x, y: p.y, z: WALL_TOP_Z },
      model: getAssemblyHardwareModel(INSERT_MODEL),
      color: { r: 0.72, g: 0.55, b: 0.25 },
    })
  })

  return circuitJson
}
