# circuit-json-to-gltf

Converts circuit JSON to 3D GLTF files. Used for exporting circuits as 3D models.

[Online Playground](https://circuit-json-to-gltf.vercel.app/renderer.html?fixtureId=%7B%22path%22%3A%22CircuitToGltfDemo.fixture.tsx%22%7D&locked=true)

[![npm version](https://img.shields.io/npm/v/circuit-json-to-gltf.svg)](https://www.npmjs.com/package/circuit-json-to-gltf)

<img width="2424" height="1854" alt="image" src="https://github.com/user-attachments/assets/cb0862aa-2034-4d06-abcc-9a4d1e5a6041" />

## Features

- Convert circuit JSON to GLTF 2.0 format (JSON or binary)
- Render PCB board with accurate dimensions and textures
- Support for STL and OBJ model loading for components
- High-quality board texture rendering using circuit-to-svg and resvg
- Automatic component positioning and generic 3D representations
- Customizable camera, lighting, and material settings

## Installation

```bash
bun install circuit-json-to-gltf
```

## Usage

```typescript
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"

// Your circuit JSON data
const circuitJson = {
  elements: [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 80,
      height: 60,
      thickness: 1.6
    },
    // ... components, traces, etc.
  ]
}

// Convert to GLTF
const gltf = await convertCircuitJsonToGltf(circuitJson, {
  format: "gltf", // or "glb" for binary
  boardTextureResolution: 2048
})

// Save the result
fs.writeFileSync("circuit.gltf", JSON.stringify(gltf))
```

## API

### Main Function

```typescript
convertCircuitJsonToGltf(circuitJson: CircuitJson, options?: ConversionOptions): Promise<ArrayBuffer | object>
```

### Options

- `format`: "gltf" (JSON) or "glb" (binary) - default: "gltf"
- `boardTextureResolution`: Resolution for board texture rendering - default: 1024
- `showPcbNotes`: Include `pcb_note*` elements in board texture rendering (default: `false`)
- `boardDrillQuality`: Drill geometry detail level, "high" or "fast" - default: "fast"
- `drawFauxBoard`: Draw a fallback board if no `pcb_board` or `pcb_panel` is present - default: false
- `includeModels`: Whether to load external 3D models - default: true
- `modelCache`: Map for caching loaded models
- `backgroundColor`: Board texture background color; overrides `pcb_board.solder_mask_color`
- `boardSideColor`: Physical substrate/edge color; otherwise derived from the solder-mask color
- `copperColor`: Exposed copper color in board textures
- `silkscreenColor`: Silkscreen color in board textures; overrides `pcb_board.silkscreen_color`
- `solderMaskWithCopperColor`: Color of traces and copper covered by solder mask; otherwise derived from the solder-mask color
- `drillColor`: Drill opening color in board textures
- `showBoundingBoxes`: Show bounding boxes for debugging (default: `false`)
- `projectBaseUrl`: Optional base URL used to resolve `node_modules` model assets via `/package_files/download`
- `authHeaders`: Optional auth headers for model downloads, e.g. `{ Authorization: "Bearer ..." }`

When a `pcb_board` supplies `solder_mask_color`, the renderer uses it for the
board surface and derives contrasting covered-copper, substrate-edge, and
silkscreen colors. Explicit conversion options take precedence.

## Architecture

The converter uses a modular architecture:

1. **Circuit to 3D Converter**: Parses circuit JSON and creates a 3D scene representation
2. **Board Renderer**: Renders PCB layers as textures using circuit-to-svg and resvg
3. **Model Loaders**: Load STL and OBJ files for component 3D models
4. **GLTF Builder**: Constructs the final GLTF using Three.js

## Development

### CAD placement coordinates

CAD semantics are resolved by `getCadModelPlacement` from
`@tscircuit/circuit-json-util` in Circuit JSON's **Z-up, millimeter** frame.
Native format decoding remains in the loaders. Their normalization matrix is
explicit, independent of `model_board_normal_direction`, and is not applied a
second time to the source origin.

Fitting uses native model axes before normal alignment, so an authored
`6 x 4 x 20` size with a `y+` board normal produces `6 x 20 x 4` in the
board-aligned frame instead of being shrunk against permuted target dimensions.
Target size is already in millimeters, matching the viewer and shared resolver:
`model_unit_to_mm_scale_factor` converts native vertices and origins, not the
declared target size. Unlike older exporter revisions, a size of `1 x 1 x 1`
with unit scale 2 fits to `1 x 1 x 1` mm; without a target size, the native
geometry doubles. Board-surface origins are measured from
contact vertices; they are separate from the scene target position.
Generated footprinter models instead supply their known zero board datum, keeping
through-hole pins below the mounting surface. Authored origins take precedence.

The Scene3D adapter maps Circuit `(x, y, z)` to `(x, z, y)`. The final glTF
adapter applies its existing X mirror and winding conversion. `Box3D.matrix`,
when present, is the authoritative local-to-world Scene3D transform; `center`
and `rotation` are not applied again. The old `transformMesh` Euler interface
still uses its original `T * Rz * Rx * Ry(-y) * S` order, but CAD meshes use
composed matrices instead. Legacy coordinates retain Number precision until glTF
buffer encoding. JSCAD matrix plans are executed by the public
`jscad-planner` interpreter, not an exporter-specific interpreter.
The legacy `fitMeshToCadBounds` helper retains ratio 1 for flat axes; full CAD
placement uses the shared resolver's native-size contract.

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run example
bun run examples/basic-conversion.ts
```

## Implementation Details

- Uses `circuit-to-svg` to render the top/bottom layers of the board to SVG
- Uses `@resvg/resvg-js` to convert SVG to PNG textures
- Includes built-in STL and OBJ parsers for 3D model loading
- Pure GLTF 2.0 implementation without external 3D library dependencies
- Supports both JSON (.gltf) and binary (.glb) formats
- Embeds all assets (textures, buffers) directly in the output
