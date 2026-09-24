import { expect, test } from "bun:test"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { Circuit } from "tscircuit"
import { convertCircuitJsonToGltf } from "../../lib"
import { parseGLB } from "../../lib/loaders/glb"
import { boundsOfTriangles } from "../../lib/utils/bounding-box"
import { COORDINATE_TRANSFORMS } from "../../lib/utils/coordinate-transform"

test("a TSX daughtercard rotated about project Y stands above its carrier", async () => {
  const daughter = new Circuit()
  daughter.add(
    <board
      width={12}
      height={8}
      thickness={0.8}
      solderMaskColor="blue"
      routingDisabled
    >
      <resistor name="R1" resistance="1k" footprint="0603" pcbX={2} pcbY={1} />
    </board>,
  )
  await daughter.renderUntilSettled()
  const daughterGlb = await convertCircuitJsonToGltf(
    daughter.getCircuitJson(),
    {
      format: "glb",
      boardTextureResolution: 256,
    },
  )
  if (!(daughterGlb instanceof ArrayBuffer))
    throw new Error("Expected daughtercard GLB")

  const circuit = new Circuit()
  circuit.add(
    <board width={20} height={16} thickness={1.4} routingDisabled>
      <chip
        name="CARD1"
        pcbX={0}
        pcbY={0}
        pcbRotation={0}
        cadModel={{
          glbUrl: `data:model/gltf-binary;base64,${Buffer.from(daughterGlb).toString("base64")}`,
          modelBoardNormalDirection: "y+",
          modelOriginPosition: { x: 6, y: 0, z: 0 },
          rotationOffset: { x: 0, y: 90, z: 0 },
        }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const glb = await convertCircuitJsonToGltf(circuit.getCircuitJson(), {
    format: "glb",
    boardTextureResolution: 256,
  })
  if (!(glb instanceof ArrayBuffer)) throw new Error("Expected assembly GLB")
  const bounds = boundsOfTriangles(
    parseGLB(glb, COORDINATE_TRANSFORMS.IDENTITY).triangles,
  )
  // Final glTF Y is vertical: 12 mm of card above the carrier's +0.7 surface.
  expect(bounds.max.y).toBeCloseTo(12.7, 5)
  expect(bounds.min.y).toBeCloseTo(-0.7, 5)
  await expect(
    renderGLTFToPNGFromGLB(glb, {
      width: 640,
      height: 640,
      camPos: [28, 22, 32],
      lookAt: [0, 5, 0],
      up: "y+",
      ambient: 0.8,
    }),
  ).toMatchPngSnapshot(import.meta.path)
}, 30_000)
