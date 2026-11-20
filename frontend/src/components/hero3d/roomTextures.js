// Texturas dibujadas en un canvas 2D para la habitación (sin archivos extra).
//
// Las superficies grandes llevan una "oclusión ambiental" pintada: se oscurecen
// cerca de los rincones, como en una escena con la luz horneada en Blender.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { COLORS } from './roomLayout.js';

const AO_TINT = '70, 45, 20'; // marrón cálido: oscurece sin ensuciar el color

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Sombra suave que entra desde un borde del canvas (top/bottom/left/right).
function edgeShade(ctx, w, h, edge, depth, strength) {
  const horizontal = edge === 'left' || edge === 'right';
  const span = (horizontal ? w : h) * depth;
  const [x0, y0, x1, y1] = {
    top: [0, 0, 0, span],
    bottom: [0, h, 0, h - span],
    left: [0, 0, span, 0],
    right: [w, 0, w - span, 0],
  }[edge];
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `rgba(${AO_TINT}, ${strength})`);
  g.addColorStop(0.35, `rgba(${AO_TINT}, ${strength * 0.45})`);
  g.addColorStop(1, `rgba(${AO_TINT}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Cara interior de una pared: blanco (lo tiñe el color del material), un poco
 * más clara arriba y con sombra en el piso y en el rincón.
 * @param {'left'|'right'} cornerEdge  Lado del canvas que toca la otra pared.
 */
export function makeWallTexture(cornerEdge) {
  return canvasTexture(256, 168, (ctx, w, h) => {
    const light = ctx.createLinearGradient(0, 0, 0, h);
    light.addColorStop(0, '#FFFFFF');
    light.addColorStop(1, '#F1EDE4');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    edgeShade(ctx, w, h, 'bottom', 0.22, 0.3);
    edgeShade(ctx, w, h, cornerEdge, 0.2, 0.26);
  });
}

// Piso de tablas con variación leve por tabla y sombra junto a las paredes
// (arriba = pared del fondo, izquierda = pared izquierda).
export function makeFloorTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const planks = 9;
    const pw = w / planks;
    let seed = 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < planks; i += 1) {
      const shade = 236 + Math.round(rand() * 19);
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`;
      ctx.fillRect(i * pw, 0, pw, h);
      // Junta entre tablas y un corte transversal escalonado.
      ctx.fillStyle = 'rgba(90, 55, 25, 0.28)';
      ctx.fillRect(i * pw, 0, 2, h);
      const cut = (0.2 + rand() * 0.6) * h;
      ctx.fillRect(i * pw, cut, pw, 2);
    }
    edgeShade(ctx, w, h, 'top', 0.16, 0.4);
    edgeShade(ctx, w, h, 'left', 0.16, 0.4);
  });
}

// Mancha redonda y difusa para apoyar muebles en el piso (sombra de contacto).
export function makeBlobTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, `rgba(${AO_TINT}, 0.5)`);
    g.addColorStop(0.5, `rgba(${AO_TINT}, 0.22)`);
    g.addColorStop(1, `rgba(${AO_TINT}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// Letras pintadas en la pared. Nunito ya está en la página; si todavía no cargó
// se dibuja con la fuente de respaldo y se repinta cuando llega.
export function makeWallLettering(text, color) {
  const draw = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "900 190px Nunito, 'Arial Rounded MT Bold', sans-serif";
    ctx.fillText(text, w / 2, h / 2 + 8);
  };
  const texture = canvasTexture(512, 256, draw);
  document.fonts?.load("900 190px Nunito").then(() => {
    draw(texture.image.getContext('2d'), texture.image.width, texture.image.height);
    texture.needsUpdate = true;
  }).catch(() => {});
  return texture;
}

// Pintura del atril: sol amarillo, cerro morado y suelo naranja, planos.
export function makeCanvasPainting() {
  return canvasTexture(128, 160, (ctx, w, h) => {
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.32, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.achievement;
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.78);
    ctx.quadraticCurveTo(w * 0.35, h * 0.3, w + 10, h * 0.8);
    ctx.lineTo(w + 10, h);
    ctx.lineTo(-10, h);
    ctx.fill();
    ctx.fillStyle = COLORS.streak;
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  });
}

// Pelota de playa: gajos de colores (se mapea sobre una esfera).
export function makeBallTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const colors = [COLORS.yellow, COLORS.cream, COLORS.achievement, COLORS.cream, COLORS.streak, COLORS.cream];
    const gw = w / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(i * gw, 0, gw + 1, h);
    });
  });
}

// Todas las texturas de la habitación, creadas una vez y liberadas al salir.
export function useRoomTextures() {
  const textures = useMemo(
    () => ({
      floor: makeFloorTexture(),
      backWall: makeWallTexture('left'),
      leftWall: makeWallTexture('right'),
      blob: makeBlobTexture(),
      lettering: makeWallLettering('Titi', COLORS.yellowDark),
      painting: makeCanvasPainting(),
      ball: makeBallTexture(),
    }),
    [],
  );
  useEffect(() => () => Object.values(textures).forEach((t) => t.dispose()), [textures]);
  return textures;
}
