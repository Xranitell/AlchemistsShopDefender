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
  /** Canvas-pixel offset applied AFTER the centered scale. Used to
   *  recenter zoomed content on the canvas midpoint when the zoom
   *  factor is greater than the world→canvas base scale (e.g. the
   *  phone-zoom in `getRenderCamera`). Defaults to 0 / 0 so the
   *  existing pure-scale path stays a no-op. */
  offsetX?: number;
  offsetY?: number;
}

export function applyIsoTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
): void {
  const ox = camera.offsetX ?? 0;
  const oy = camera.offsetY ?? 0;
  if (camera.scale === 1 && ox === 0 && oy === 0) return;
  if (ox !== 0 || oy !== 0) ctx.translate(ox, oy);
  if (camera.scale !== 1) {
    ctx.translate(camera.cx, camera.cy);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.cx, -camera.cy);
  }
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera,
): { x: number; y: number } {
  const ox = camera.offsetX ?? 0;
  const oy = camera.offsetY ?? 0;
  if (camera.scale === 1 && ox === 0 && oy === 0) {
    return { x: sx, y: sy };
  }
  // Inverse of `applyIsoTransform`: undo the post-scale offset, then
  // undo the centered scale.
  const ax = sx - ox;
  const ay = sy - oy;
  return {
    x: camera.cx + (ax - camera.cx) / camera.scale,
    y: camera.cy + (ay - camera.cy) / camera.scale,
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
  const ox = camera.offsetX ?? 0;
  const oy = camera.offsetY ?? 0;
  if (camera.scale === 1 && ox === 0 && oy === 0) {
    return { x: wx, y: wy };
  }
  return {
    x: camera.cx + (wx - camera.cx) * camera.scale + ox,
    y: camera.cy + (wy - camera.cy) * camera.scale + oy,
  };
}
