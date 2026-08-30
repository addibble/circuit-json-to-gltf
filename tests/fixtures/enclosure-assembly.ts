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

/**
 * How each material is hatched where the section plane cuts it.
 *
 * Engineering section views distinguish materials by hatch as well as by
 * colour, and here it is not decoration: `gltf-slice` applies a single cap
 * material to a whole document, so a bolt cut inside a boss is drawn with the
 * boss's hatch and disappears into it. Slicing each material separately and
 * merging the results is what makes the fastener legible in its own hole.
 *
 * Hatch colours are 0-255 RGBA, matching gltf-slice.
 */
export const MATERIAL_GROUPS = [
  {
    key: "enclosure",
    matches: (name: string) => /^ENCLOSURE/.test(name),
    includesBoard: false,
    // Wide, pale hatch: the moulded shell is the background of the drawing.
    hatch: {
      spacing: 18,
      lineWidth: 2,
      background: [214, 210, 205, 255],
      lineColor: [150, 145, 138, 255],
    },
  },
  {
    key: "board",
    matches: () => false,
    includesBoard: true,
    hatch: {
      spacing: 8,
      lineWidth: 2,
      background: [22, 105, 55, 255],
      lineColor: [10, 60, 30, 255],
    },
  },
  {
    key: "screw",
    matches: (name: string) => /^PCB_SCREW/.test(name),
    includesBoard: false,
    // Dense fine hatch, the convention for steel.
    hatch: {
      spacing: 6,
      lineWidth: 2,
      background: [150, 168, 190, 255],
      lineColor: [40, 60, 85, 255],
    },
  },
  {
    key: "bolt",
    matches: (name: string) => /^LID_BOLT/.test(name),
    includesBoard: false,
    // Dark body, light lines -- inverted so it cannot be mistaken for a screw.
    hatch: {
      spacing: 6,
      lineWidth: 2,
      background: [58, 60, 66, 255],
      lineColor: [170, 175, 185, 255],
    },
  },
  {
    key: "insert",
    matches: (name: string) => /^LID_INSERT/.test(name),
    includesBoard: false,
    // Brass, hatched coarsely against the bolt's fine steel.
    hatch: {
      spacing: 11,
      lineWidth: 3,
      background: [198, 152, 48, 255],
      lineColor: [110, 78, 12, 255],
    },
  },
] as const

/**
 * An isometric camera looking square-on at a section face.
 *
 * `getBestCameraPosition` frames the whole assembly, which points the camera
 * wherever the bounding box suggests -- for a section that is usually *away*
 * from the cut, giving a view of an intact-looking outside. A section view has
 * to be aimed at the cut deliberately.
 *
 * ## Isometric, approximately
 *
 * True isometric is an *orthographic* projection along a direction making equal
 * angles with all three axes. poppygl only builds `mat4.perspective` -- there is
 * no orthographic path -- so this is an approximation: the camera sits on the
 * equal-offset diagonal (which is the isometric *direction*, exactly), and the
 * field of view is narrowed to a few degrees with the distance grown to match,
 * because perspective tends to orthographic as the field of view tends to zero.
 *
 * At 6 degrees the convergence left in a 55mm assembly is well under a pixel.
 * The honest fix is an orthographic projection in poppygl; until then, do not
 * measure anything off these images.
 *
 * `sectionNormalSceneZ` is the scene-Z direction the cut face points, which is
 * the opposite of the half that was kept: keeping `z+` leaves a face looking
 * toward `-z`. The camera sits on that side.
 */
export const getSectionCameraOptions = ({
  sectionNormalSceneZ,
  distance = 700,
  fov = 6,
}: {
  sectionNormalSceneZ: -1 | 1
  distance?: number
  fov?: number
}) => {
  const lookAt: [number, number, number] = [0, 1, 9 * -sectionNormalSceneZ]
  // Equal components along each axis: the isometric direction, (1, 1, ±1)/sqrt(3).
  const leg = distance / Math.sqrt(3)
  return {
    camPos: [
      lookAt[0] + leg,
      lookAt[1] + leg,
      lookAt[2] + leg * sectionNormalSceneZ,
    ] as [number, number, number],
    lookAt,
    up: "y+" as const,
    fov,
    ambient: 0.32,
    backgroundColor: "#ffffff",
  }
}

const cuboid = (
  size: [number, number, number],
  center: [number, number, number],
) => ({
  type: "translate" as const,
  vector: center,
  shape: { type: "cuboid" as const, size },
})

/**
 * Materials, as RGB.
 *
 * A section is unreadable when every part is the same grey -- a screw inside a
 * boss simply reads as more boss. These are stated as jscad `colorize`
 * operations so the colour travels with the model rather than being a property
 * of the scene: the loader lifts it out and it beats the renderer's single
 * `componentColor`.
 */
export const MATERIALS = {
  /** Moulded enclosure: light warm grey. */
  enclosure: [0.82, 0.8, 0.78],
  /** Lid, a shade darker so the joint line reads. */
  lid: [0.68, 0.66, 0.64],
  /** Zinc-plated steel screw: cool light grey. */
  screw: [0.75, 0.78, 0.82],
  /** Black-oxide socket-cap bolt: dark, clearly not the screw. */
  bolt: [0.24, 0.25, 0.28],
  /** Brass heat-set insert. */
  insert: [0.78, 0.6, 0.2],
} as const

const colorize = (color: readonly number[], shape: unknown) => ({
  type: "colorize" as const,
  color: [...color] as number[],
  shape,
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
    ...LID_BOLT_POSITIONS.map((p) =>
      cylinder(9, FLOOR_Z, WALL_TOP_Z, p.x, p.y),
    ),
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
    showHiddenEdges,
  }: {
    name: string
    position: { x: number; y: number; z: number }
    model: unknown
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
      ...(showHiddenEdges ? { show_hidden_edges: true } : {}),
    } as never,
  )
}

export const buildEnclosureAssemblyCircuitJson = ({
  showHiddenEdges = false,
}: {
  showHiddenEdges?: boolean
} = {}): CircuitJson => {
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
    model: colorize(MATERIALS.enclosure, buildBase()),
    showHiddenEdges,
  })
  addPart(circuitJson, {
    name: "ENCLOSURE_LID",
    position: { x: 0, y: 0, z: 0 },
    model: colorize(MATERIALS.lid, buildLid()),
    showHiddenEdges,
  })

  // Screws seat on the board's top face and thread down into the floor bosses.
  PCB_SCREW_POSITIONS.forEach((p, index) => {
    addPart(circuitJson, {
      name: `PCB_SCREW_${index + 1}`,
      position: { x: p.x, y: p.y, z: BOARD_TOP_Z },
      model: colorize(
        MATERIALS.screw,
        getAssemblyHardwareModel(PCB_SCREW_MODEL),
      ),
    })
  })

  // Bolts seat on the lid's top face; inserts seat flush under the lid.
  LID_BOLT_POSITIONS.forEach((p, index) => {
    addPart(circuitJson, {
      name: `LID_BOLT_${index + 1}`,
      position: { x: p.x, y: p.y, z: LID_TOP_Z },
      model: colorize(MATERIALS.bolt, getAssemblyHardwareModel(LID_BOLT_MODEL)),
    })
    addPart(circuitJson, {
      name: `LID_INSERT_${index + 1}`,
      position: { x: p.x, y: p.y, z: WALL_TOP_Z },
      model: colorize(MATERIALS.insert, getAssemblyHardwareModel(INSERT_MODEL)),
    })
  })

  return circuitJson
}
