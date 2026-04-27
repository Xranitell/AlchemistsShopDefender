// Isometric camera: rotates the world 45 degrees and compresses Y to create
// a classic isometric top-down view like Alien Shooter / Diablo.
// The game logic stays in flat 2D; this transform is only applied during rendering.

const ISO_ANGLE = Math.PI / 4; // 45 degrees
const ISO_Y_SCALE = 0.55; // Y compression for depth effect
const COS = Math.cos(ISO_ANGLE);
const SIN = Math.sin(ISO_ANGLE);

export interface Camera {
  cx: number;
  cy: number;
  scale: number;
}

export function applyIsoTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
): void {
  ctx.translate(camera.cx, camera.cy);
  ctx.scale(camera.scale, camera.scale);
  // Rotate 45 degrees and compress Y
  ctx.transform(COS, SIN * ISO_Y_SCALE, -SIN, COS * ISO_Y_SCALE, 0, 0);
  ctx.translate(-camera.cx / camera.scale, -camera.cy / camera.scale);
}

// Convert screen coordinates (mouse position) to world coordinates
// by inverting the isometric transform.
export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera,
): { x: number; y: number } {
  // Undo translate to center
  const dx = (sx - camera.cx) / camera.scale;
  const dy = (sy - camera.cy) / camera.scale;
  // Invert the rotation + y-scale matrix
  // Forward: [COS, SIN*ISO_Y_SCALE; -SIN, COS*ISO_Y_SCALE]
  // Determinant = COS*COS*ISO_Y_SCALE + SIN*SIN*ISO_Y_SCALE = ISO_Y_SCALE
  const det = ISO_Y_SCALE;
  const wx = (dy * SIN + dx * COS * ISO_Y_SCALE) / det;
  const wy = (dy * COS - dx * SIN * ISO_Y_SCALE) / det;
  return {
    x: wx + camera.cx / camera.scale,
    y: wy + camera.cy / camera.scale,
  };
}
