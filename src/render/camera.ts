// Flat 2D top-down camera (no rotation, no Y compression).
//
// The game art is pixel-art drawn in a 2.5D style (walls/buildings show a
// visible top face + front face, but the camera itself is orthographic and
// looks straight down at the floor). Older revisions used to apply a runtime
// 45° + Y-scale isometric transform, but that made the scene feel 3D-extruded
// along Z. All rendering code still goes through `applyIsoTransform` /
// `screenToWorld` so the call-sites stay stable even though the transform is
// now identity (with optional uniform zoom around the canvas centre).

export interface Camera {
  cx: number;
  cy: number;
  scale: number;
}

export function applyIsoTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
): void {
  if (camera.scale === 1) return;
  ctx.translate(camera.cx, camera.cy);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-camera.cx, -camera.cy);
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera,
): { x: number; y: number } {
  if (camera.scale === 1) {
    return { x: sx, y: sy };
  }
  return {
    x: camera.cx + (sx - camera.cx) / camera.scale,
    y: camera.cy + (sy - camera.cy) / camera.scale,
  };
}

/** Inverse of `screenToWorld`. Used by overlay UI (tutorial spotlights,
 *  damage numbers anchored to entities) that needs to convert a world
 *  coordinate back into a canvas-space pixel position. */
export function worldToScreen(
  wx: number,
  wy: number,
  camera: Camera,
): { x: number; y: number } {
  if (camera.scale === 1) {
    return { x: wx, y: wy };
  }
  return {
    x: camera.cx + (wx - camera.cx) * camera.scale,
    y: camera.cy + (wy - camera.cy) * camera.scale,
  };
}
