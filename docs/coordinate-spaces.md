# CAD rotation through the existing Scene3D frame

All lengths remain millimetres, including exported glTF. This change does not
migrate Scene3D to Z-up or alter model-origin policies.

| Space | Coordinates relative to Circuit JSON P | Up | Role |
| --- | --- | --- | --- |
| Native model N | Format/asset dependent | Asset dependent | Loader input and authored model origin |
| Circuit JSON P | `(Px, Py, Pz)` | +Z | PCB placement and authored CAD rotations |
| Intermediate Scene3D S | `(Px, Pz, Py)` | +Y | Prepared meshes, box centers and sizes |
| Exported glTF G | `(-Px, Pz, Py)` | +Y | Mesh attributes and node translations |

The P-to-S Y/Z swap, A, has determinant -1: it reverses handedness.
The final S-to-G X mirror also has determinant -1. Together they form a
proper, determinant +1 change of basis, not a mirror of the physical board.

## 1. Native asset preparation (unchanged)

`getDefaultModelTransform` selects existing format/board-normal behavior.
Loaders apply their `CoordinateTransformConfig` using
`applyCoordinateTransform`: axis mapping, axis flips, then fixed-axis X, Y, Z
rotations in degrees. These rotations act on the mapped coordinates, not on
the Circuit JSON placement axes, and do not use CAD's intrinsic XYZ order.

`getMeshWithBoardNormalTransform`, `getMeshOrigin`, unit scaling and
`fitMeshToCadBounds` retain their existing order and policies in
`convertCircuitJsonTo3D`. An explicit native origin follows the configured
loader and board-normal transforms; inferred origins retain the existing
contact-patch/center rules. No origin or native-axis policy is corrected here.

The result enters placement as a local Scene3D mesh. Native asset coordinate
systems are not interchangeable with project or exported glTF coordinates.

## 2. Project placement encoded in Scene3D

`convertCircuitJsonTo3D` stores a project position as
`box.center = {x: Px, y: Pz, z: Py}`. Sizes use the same permutation.

CAD rotation angles are right-handed intrinsic XYZ in project coordinates:

```text
R_P = Rx(thetaX) * Ry(thetaY) * Rz(thetaZ)
```

For column-vector points, the actual application order is **Z, then Y, then X**,
matching Three.js Euler XYZ and the viewer's CAD placement.

The existing `box.rotation` record holds radians in the unusual order
`(thetaX, thetaZ, thetaY)`. It is an encoding of the project angles, **not**
an ordinary scene-frame Euler. Both the field permutation and the reflected
basis must be accounted for.

Implicit bottom-layer half-turns remain format-specific: the scene `z` field
for GLB/glTF/footprinter encodes project Y180; the other fallback uses project
X180. Explicit CAD rotations continue to override those fallbacks.

## 3. `transformMesh`: rotate inside the retained frame

For a mesh already in S, the required rotation is:

```text
R_S = A * R_P * inverse(A)
    = Rx(-thetaX) * Rz(-thetaY) * Ry(-thetaZ)
    = Rx(-rotation.x) * Rz(-rotation.z) * Ry(-rotation.y)
```

Thus the stored angles act as **scene -Y, then -Z, then -X** rotations.
The old implementation retained the project Z sense but reversed X/Y and
applied them in the wrong mixed-axis order.

`transformMesh` composes this matrix once and uses it for positions and
normals. Optional scene-axis scale still precedes rotation; scene translation
still follows it. Normals receive no translation. Existing nonuniform-scale
normal handling and winding policies are outside this rotation-only change.

`foldRigidBox` calls the same function to bake the local CAD pose, then moves
it into project space for the physical fold and returns a Scene3D mesh.
That path must not invent a second Euler convention.

## 4. Final glTF export

`GLTFBuilder` calls `transformMesh` before `convertMeshToGLTFOrientation`.
The latter mirrors X in positions and normals, and reverses triangle winding.
`toGltfTranslation` applies the same X mirror to `box.center`, separately
from the local mesh attributes.

For a prepared project-local point p with project placement t, the final
position is `G = (-qx, qz, qy)`, where `q = R_P * p + t`. Pure Z placement,
zero rotation, origin inference and the final output basis are unchanged.

## Regressions

The per-file `scene-rotation-*` unit tests check off-axis positions and normals
in final glTF coordinates, including a non-quarter-turn composition and
identity/translation/scale controls.
`upright-daughtercard-rotation.test.tsx` exports an actual TSX board, references
that unchanged GLB from a second TSX board, and verifies that its 12 mm height
extends above the carrier after project Y90. It does not use a manufactured
pre-rotated asset or a vendor download.
