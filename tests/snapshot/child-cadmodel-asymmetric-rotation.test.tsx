import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { convertCircuitJsonToGltf } from "../../lib"
import { boundsOfTriangles } from "../../lib/utils/bounding-box"
import { getBoundingBoxCenter } from "../../lib/utils/mesh-scale"
import {
  getKeyedModelTriangles,
  isKeyTriangle,
  KEYED_CAD_MODEL_ORIGIN,
  KEYED_CAD_MODEL_URL,
} from "../fixtures/keyed-cad-model"
import { renderGlbToPng } from "../renderGlbToPng"

test("child CAD keeps an off-axis key aligned on both layers across PCB rotations", async () => {
  // Board-space key centers after placement; no CAD Euler values are used as an oracle.
  const placements = [
    { rotation: 0, top: [1.5, 1], bottom: [-1.5, 1] },
    {
      rotation: 45,
      top: [0.5 / Math.SQRT2, 2.5 / Math.SQRT2],
      bottom: [-2.5 / Math.SQRT2, -0.5 / Math.SQRT2],
    },
    { rotation: 90, top: [-1, 1.5], bottom: [-1, -1.5] },
    { rotation: 180, top: [-1.5, -1], bottom: [1.5, -1] },
    { rotation: 270, top: [1, -1.5], bottom: [1, 1.5] },
  ] as const

  for (const layer of ["top", "bottom"] as const) {
    for (const placement of placements) {
      const circuit = new Circuit()
      circuit.add(
        <board width={8} height={10} thickness={1.6} routingDisabled>
          <chip
            name="U1"
            footprint="0402"
            layer={layer}
            pcbRotation={placement.rotation}
            pcbX={0}
            pcbY={0}
            cadModel={
              <cadmodel
                modelUrl={KEYED_CAD_MODEL_URL}
                modelOriginPosition={KEYED_CAD_MODEL_ORIGIN}
              />
            }
          />
          <silkscreentext
            text={`${layer} ${placement.rotation}deg`}
            pcbY={-4.2}
            fontSize={0.5}
            layer={layer}
          />
        </board>,
      )
      await circuit.renderUntilSettled()
      const circuitJson = await circuit.getCircuitJson()
      const glb = await convertCircuitJsonToGltf(circuitJson, {
        format: "glb",
        boardTextureResolution: 512,
      })
      if (!(glb instanceof ArrayBuffer)) throw new Error("Expected binary glTF")

      await expect(
        renderGlbToPng(
          glb,
          circuitJson,
          { width: 512, height: 512, up: "z+", ambient: 0.8 },
          {
            preset: layer === "top" ? "top_down" : "bottom_up",
            ortho: true,
            aspectRatio: 1,
          },
        ),
      ).toMatchPngSnapshot(
        import.meta.path,
        `child-cadmodel-asymmetric-${layer}-${placement.rotation}`,
      )

      const key = getKeyedModelTriangles(glb).filter(isKeyTriangle)
      expect(key).toHaveLength(12)
      const center = getBoundingBoxCenter(boundsOfTriangles(key))
      const [boardX, boardY] = placement[layer]
      expect(center.x).toBeCloseTo(-boardX, 5)
      expect(center.y).toBeCloseTo(layer === "top" ? 2.8 : -2.8, 5)
      expect(center.z).toBeCloseTo(boardY, 5)
    }
  }
}, 30_000)
