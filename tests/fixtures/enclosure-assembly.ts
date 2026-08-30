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

/**
 * The base is deep enough that the mount stack fits INSIDE it.
 *
 * A boss has to swallow the insert plus the relief beyond the bolt tip, and the
 * floor still needs material under that. At FLOOR_Z = -8 it did not: the relief
 * bottomed at exactly -8 and broke out through the underside of the enclosure.
 * The boss is made taller by dropping the floor, rather than by shortening the
 * relief, because the relief is a real requirement and the floor thickness is
 * the thing that was implicitly assumed rather than stated.
 */
export const FLOOR_Z = -10
/** Solid material under the cavity, and the minimum left beneath a mount. */
export const FLOOR_THICKNESS = 2.5
export const WALL_TOP_Z = 4
export const LID_TOP_Z = 6

/** Where the two PCB screws go: on the board's X axis, so y=0 cuts both. */
export const PCB_SCREW_POSITIONS = [
  { x: -8, y: 0 },
  { x: 8, y: 0 },
]

/**
 * The corner mounts, at the board's own mounting holes.
 *
 * One bolt does three jobs here: it passes through the lid, through the board,
 * and threads into an insert in a boss that rises from the floor -- so the same
 * fastener clamps the lid down and holds the board up. The board SITS ON the
 * bosses, which is why they stop at the board's underside.
 *
 * They were previously outside the board, at (+-22, +-14), which grew the
 * enclosure to make room and still collided with the board corners: a 9mm boss
 * at x=22 spans 17.5..26.5 against a board reaching x=20.
 */
export const LID_BOLT_POSITIONS = [
  { x: -16, y: -8 },
  { x: 16, y: -8 },
  { x: -16, y: 8 },
  { x: 16, y: 8 },
]

export const PCB_SCREW_MODEL = "screw_m3_l6_socketcap"
/** Kept in step with PCB_SCREW_MODEL, so the pilot hole follows the screw. */
export const PCB_SCREW_LENGTH = 6
/** Clearance beyond the screw tip, so it clamps instead of bottoming out. */
export const SCREW_BOTTOM_CLEARANCE = 1.8
export const LID_BOLT_MODEL = "bolt_m3_l12_socketcap"
export const INSERT_MODEL = "heatsetinsert_m3_l5.7"
/** Kept in step with INSERT_MODEL: the boss is bored to receive exactly this. */
export const INSERT_LENGTH = 5.7

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
    isFastener: false,
    // Wide, pale hatch: the moulded shell is the background of the drawing.
    hatch: {
      size: 512,
      spacing: 72,
      lineWidth: 8,
      background: [214, 210, 205, 255],
      lineColor: [150, 145, 138, 255],
    },
  },
  {
    key: "board",
    matches: () => false,
    includesBoard: true,
    isFastener: false,
    hatch: {
      size: 512,
      spacing: 32,
      lineWidth: 8,
      background: [22, 105, 55, 255],
      lineColor: [10, 60, 30, 255],
    },
  },
  {
    key: "screw",
    matches: (name: string) => /^PCB_SCREW/.test(name),
    includesBoard: false,
    isFastener: true,
    // Dense fine hatch, the convention for steel.
    hatch: {
      // Sectioned but not patterned: a hatch across a fastener competes with
      // the hatch of the material it sits in, and the pair that matters most --
      // a bolt inside its insert -- is only ~0.5mm of wall apart. Flat colour
      // separates them where a pattern muddles them. gltf-slice requires a
      // lineWidth of at least 1, so "no pattern" is a line the same colour as
      // the ground.
      size: 512,
      spacing: 16,
      lineWidth: 1,
      background: [150, 168, 190, 255],
      lineColor: [150, 168, 190, 255],
    },
  },
  {
    key: "bolt",
    matches: (name: string) => /^LID_BOLT/.test(name),
    includesBoard: false,
    isFastener: true,
    // Dark body, light lines -- inverted so it cannot be mistaken for a screw.
    hatch: {
      // Sectioned but not patterned: a hatch across a fastener competes with
      // the hatch of the material it sits in, and the pair that matters most --
      // a bolt inside its insert -- is only ~0.5mm of wall apart. Flat colour
      // separates them where a pattern muddles them. gltf-slice requires a
      // lineWidth of at least 1, so "no pattern" is a line the same colour as
      // the ground.
      size: 512,
      spacing: 16,
      lineWidth: 1,
      background: [58, 60, 66, 255],
      lineColor: [58, 60, 66, 255],
    },
  },
  {
    key: "insert",
    matches: (name: string) => /^LID_INSERT/.test(name),
    includesBoard: false,
    isFastener: true,
    // Brass, hatched coarsely against the bolt's fine steel.
    hatch: {
      // Sectioned but not patterned: a hatch across a fastener competes with
      // the hatch of the material it sits in, and the pair that matters most --
      // a bolt inside its insert -- is only ~0.5mm of wall apart. Flat colour
      // separates them where a pattern muddles them. gltf-slice requires a
      // lineWidth of at least 1, so "no pattern" is a line the same colour as
      // the ground.
      size: 512,
      spacing: 16,
      lineWidth: 1,
      background: [198, 152, 48, 255],
      lineColor: [198, 152, 48, 255],
    },
  },
] as const

/**
 * A plan view, looking straight down at a transverse section.
 *
 * The counterpart to the elevation: the camera sits on scene +Y (circuit +Z)
 * looking down, so a plane parallel to the board is seen square-on. This is the
 * view where fasteners MUST be sectioned -- looking down on an intact bolt
 * shows a head and nothing else.
 */
export const getPlanCameraOptions = ({
  distance = 450,
  fov = 6,
}: {
  distance?: number
  fov?: number
} = {}) => {
  const lookAt: [number, number, number] = [0, 0, 0]
  return {
    camPos: [lookAt[0], lookAt[1] + distance, lookAt[2]] as [
      number,
      number,
      number,
    ],
    lookAt,
    // Looking straight down the Y axis, so "up" on screen must be another axis.
    up: "z+" as const,
    fov,
    ambient: 0.42,
    backgroundColor: "#ffffff",
  }
}

/**
 * A straight elevation view, square-on to the section face.
 *
 * The drawing convention for a section: the camera sits **on** the cut's normal
 * with no lateral or vertical offset, so the cut face is flat to the viewer and
 * everything in the plane is seen at true relative size. That is what makes
 * engagement and clearance legible -- in an isometric no face is square-on, so
 * every length in the cut is foreshortened.
 *
 * Still an approximation of orthographic, for the same reason as below: poppygl
 * builds only `mat4.perspective`, so the field of view is narrowed and the
 * distance grown to match. Depth cues vanish almost entirely in this view, which
 * is the point -- it should read as a drawing, not as a photograph.
 */
export const getSectionElevationCameraOptions = ({
  sectionNormalSceneZ,
  distance = 450,
  fov = 6,
}: {
  sectionNormalSceneZ: -1 | 1
  distance?: number
  fov?: number
}) => {
  const lookAt: [number, number, number] = [0, 2.5, 0]
  return {
    camPos: [
      lookAt[0],
      lookAt[1],
      lookAt[2] + distance * sectionNormalSceneZ,
    ] as [number, number, number],
    lookAt,
    up: "y+" as const,
    fov,
    ambient: 0.42,
    backgroundColor: "#ffffff",
  }
}

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

/**
 * The cavity clears the board by BOARD_CLEARANCE per side and no more -- 2.5mm
 * of air around a 40mm board is most of a wall thickness of wasted envelope.
 */
const BOARD_CLEARANCE = 0.4
const WALL_THICKNESS = 2.5
const CAVITY = {
  width: BOARD.width + BOARD_CLEARANCE * 2,
  height: BOARD.height + BOARD_CLEARANCE * 2,
}
const OUTER = {
  width: CAVITY.width + WALL_THICKNESS * 2,
  height: CAVITY.height + WALL_THICKNESS * 2,
}

/** The enclosure base: a tray, with a boss under each fastener. */
/**
 * The enclosure base: a tray, with a boss under each fastener.
 *
 * Each boss is **bored for the fastener it receives**. That is not detail for
 * its own sake: two solids cannot occupy the same space, and when they do their
 * section caps are coplanar and fight, so a screw inside a solid boss vanishes
 * into it. The hole is what makes the fastener legible in section, and it is
 * what the moulded part would really have.
 */
const buildBase = () => ({
  type: "subtract" as const,
  shapes: [
    {
      type: "union" as const,
      shapes: [
        {
          type: "subtract" as const,
          shapes: [
            cuboid(
              [OUTER.width, OUTER.height, WALL_TOP_Z - FLOOR_Z],
              [0, 0, (FLOOR_Z + WALL_TOP_Z) / 2],
            ),
            // The cavity sits on the floor slab and is open at the top.
            cuboid(
              [
                CAVITY.width,
                CAVITY.height,
                WALL_TOP_Z + 2 - (FLOOR_Z + FLOOR_THICKNESS),
              ],
              [0, 0, (FLOOR_Z + FLOOR_THICKNESS + WALL_TOP_Z + 2) / 2],
            ),
          ],
        },
        // Floor bosses the PCB screws thread into.
        ...PCB_SCREW_POSITIONS.map((p) =>
          cylinder(7, FLOOR_Z, BOARD_BOTTOM_Z, p.x, p.y),
        ),
        // Corner bosses: they rise from the floor and STOP at the board's
        // underside, because the board rests on them.
        ...LID_BOLT_POSITIONS.map((p) =>
          cylinder(8, FLOOR_Z, BOARD_BOTTOM_Z, p.x, p.y),
        ),
      ],
    },
    // A thread-forming screw gets a pilot hole, 0.8x nominal for an M3, bored
    // DEEPER than the screw reaches. That gap is the bottom clearance: a screw
    // driven onto the bottom of its own hole jacks the boss apart instead of
    // clamping, so the relief is a real feature and has to be visible in
    // section. An M3 x 6 seats at z=+0.8 and ends at -5.2; the hole runs to
    // -7.0, leaving 1.8mm of relief.
    ...PCB_SCREW_POSITIONS.map((p) =>
      cylinder(
        2.4,
        // Measured DOWN FROM THE SCREW, not up from the floor. Keyed to the
        // floor it silently became 3.8mm of relief the moment the base was
        // deepened -- the same wrong-datum mistake that let the insert relief
        // break out through the underside.
        BOARD_TOP_Z - PCB_SCREW_LENGTH - SCREW_BOTTOM_CLEARANCE,
        BOARD_BOTTOM_Z + 0.1,
        p.x,
        p.y,
      ),
    ),
    // The insert installs into the top of the boss, and the bolt runs past it
    // into a clearance hole, so neither is drawn buried in solid plastic.
    ...LID_BOLT_POSITIONS.map((p) =>
      cylinder(
        4,
        BOARD_BOTTOM_Z - INSERT_LENGTH,
        BOARD_BOTTOM_Z + 0.1,
        p.x,
        p.y,
      ),
    ),
    ...LID_BOLT_POSITIONS.map((p) =>
      cylinder(
        3.4,
        BOARD_BOTTOM_Z - INSERT_LENGTH - 1.5,
        BOARD_BOTTOM_Z - INSERT_LENGTH + 0.1,
        p.x,
        p.y,
      ),
    ),
  ],
})

/** The lid, bored with a clearance hole for each bolt. */
const buildLid = () => ({
  type: "subtract" as const,
  shapes: [
    cuboid(
      [OUTER.width, OUTER.height, LID_TOP_Z - WALL_TOP_Z],
      [0, 0, (WALL_TOP_Z + LID_TOP_Z) / 2],
    ),
    ...LID_BOLT_POSITIONS.map((p) =>
      cylinder(3.4, WALL_TOP_Z - 0.1, LID_TOP_Z + 0.1, p.x, p.y),
    ),
  ],
})

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

  // The screws pass THROUGH the board, so the board is drilled for them.
  // Without this the screw and the board occupy the same space, their section
  // caps are coplanar, and the shank vanishes where it crosses the board.
  for (const [index, p] of [
    ...PCB_SCREW_POSITIONS,
    ...LID_BOLT_POSITIONS,
  ].entries()) {
    circuitJson.push({
      type: "pcb_hole",
      pcb_hole_id: `pcb_hole_${index}`,
      hole_shape: "circle",
      hole_diameter: 3.4,
      x: p.x,
      y: p.y,
    } as never)
  }

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
      position: { x: p.x, y: p.y, z: BOARD_BOTTOM_Z },
      model: colorize(MATERIALS.insert, getAssemblyHardwareModel(INSERT_MODEL)),
    })
  })

  return circuitJson
}
