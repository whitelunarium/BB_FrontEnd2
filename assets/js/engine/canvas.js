// engine/canvas.js
// Responsibility: Canvas setup, DPI scaling, resize handling.
// WORKER — no game state, no side effects beyond canvas configuration.

const LOGICAL_WIDTH  = 800;
const LOGICAL_HEIGHT = 600;
let   CANVAS_SCALE   = 1;

/**
 * Purpose: Initialize the canvas, apply devicePixelRatio scaling, start resize listener.
 * @param {string} canvasId - ID of the <canvas> element
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
 * Algorithm:
 * 1. Grab canvas element
 * 2. Scale backing buffer by devicePixelRatio for sharp rendering
 * 3. Apply initial CSS resize
 * 4. Add window resize listener
 */
function setupCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  const dpr    = window.devicePixelRatio || 1;

  canvas.width  = LOGICAL_WIDTH  * dpr;
  canvas.height = LOGICAL_HEIGHT * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;   // pixel-art style

  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));

  return { canvas, ctx };
}

/**
 * Purpose: Scale the canvas CSS size to fill the window while preserving 4:3 aspect ratio.
 * @param {HTMLCanvasElement} canvas
 * @returns {void}
 */
function resizeCanvas(canvas) {
  const scaleX = window.innerWidth  / LOGICAL_WIDTH;
  const scaleY = window.innerHeight / LOGICAL_HEIGHT;
  CANVAS_SCALE = Math.min(scaleX, scaleY);

  canvas.style.width  = (LOGICAL_WIDTH  * CANVAS_SCALE) + 'px';
  canvas.style.height = (LOGICAL_HEIGHT * CANVAS_SCALE) + 'px';
  canvas.style.left   = ((window.innerWidth  - LOGICAL_WIDTH  * CANVAS_SCALE) / 2) + 'px';
  canvas.style.top    = ((window.innerHeight - LOGICAL_HEIGHT * CANVAS_SCALE) / 2) + 'px';
}

/**
 * Purpose: Clear the entire logical canvas surface.
 * @param {CanvasRenderingContext2D} ctx
 * @returns {void}
 */
function clearCanvas(ctx) {
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}
