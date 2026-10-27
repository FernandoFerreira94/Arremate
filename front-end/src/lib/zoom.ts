/**
 * D28 (Z3): matemática pura do zoom da obra — clique 1×→2×→3×, barra −/+/reset, pinça 1×–4×,
 * duplo toque 1×↔2,5×, arrastar e minimapa. Sem DOM, para testar em unidade e reaproveitar no hook.
 * Coordenadas: x/y é o deslocamento (px) do centro da imagem em relação ao centro do visor.
 */
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type ZoomState = { scale: number; x: number; y: number };

export const ZOOM_MIN = 1;
export const CLICK_LEVELS = [1, 2, 3] as const;
export const DESKTOP_MAX = 3;
export const TOUCH_MAX = 4;
export const DOUBLE_TAP_SCALE = 2.5;
export const STEP = 0.5;
export const IDENTITY: ZoomState = { scale: 1, x: 0, y: 0 };

/** Tamanho da imagem a 1× dentro do visor (object-contain). */
export function fitSize(natural: Size, view: Size): Size {
  if (!natural.width || !natural.height || !view.width || !view.height) return { width: 0, height: 0 };
  const ratio = Math.min(view.width / natural.width, view.height / natural.height);
  return { width: natural.width * ratio, height: natural.height * ratio };
}

const clampTo = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

/** Mantém a imagem cobrindo o visor: sem bordas vazias além do que sobra a 1×. */
export function clamp(state: ZoomState, view: Size, content: Size, max = TOUCH_MAX): ZoomState {
  const scale = round(clampTo(state.scale, ZOOM_MIN, max));
  const limitX = Math.max(0, (content.width * scale - view.width) / 2);
  const limitY = Math.max(0, (content.height * scale - view.height) / 2);
  return { scale, x: clampTo(state.x, -limitX, limitX) || 0, y: clampTo(state.y, -limitY, limitY) || 0 };
}

/** Muda a escala mantendo parado o ponto `at` (relativo ao centro do visor). Sem ponto, usa o centro. */
export function zoomTo(state: ZoomState, scale: number, view: Size, content: Size, max = TOUCH_MAX, at: Point = { x: 0, y: 0 }): ZoomState {
  const next = round(clampTo(scale, ZOOM_MIN, max));
  const factor = next / state.scale;
  return clamp({ scale: next, x: at.x - (at.x - state.x) * factor, y: at.y - (at.y - state.y) * factor }, view, content, max);
}

/** Clique: 1× → 2× → 3× → 1× (Z3). */
export function nextClickLevel(scale: number): number {
  const next = CLICK_LEVELS.find((level) => level > scale + 0.01);
  return next ?? CLICK_LEVELS[0];
}

/** Barra e teclado: passo de 0,5×. */
export function stepScale(scale: number, direction: 1 | -1, max = DESKTOP_MAX): number {
  const snapped = direction > 0 ? Math.floor(scale / STEP + 1e-6) * STEP + STEP : Math.ceil(scale / STEP - 1e-6) * STEP - STEP;
  return clampTo(round(snapped), ZOOM_MIN, max);
}

/** Duplo toque: 1× ↔ 2,5×. */
export function doubleTapScale(scale: number): number {
  return scale > ZOOM_MIN + 0.01 ? ZOOM_MIN : DOUBLE_TAP_SCALE;
}

/** Pinça: escala inicial × razão entre as distâncias dos dedos, de 1× a 4×. */
export function pinchScale(startScale: number, startDistance: number, distance: number, max = TOUCH_MAX): number {
  if (startDistance <= 0) return startScale;
  return round(clampTo((startScale * distance) / startDistance, ZOOM_MIN, max));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pan(state: ZoomState, dx: number, dy: number, view: Size, content: Size, max = TOUCH_MAX): ZoomState {
  return clamp({ ...state, x: state.x + dx, y: state.y + dy }, view, content, max);
}

/** Setas: 10% do visor por toque. */
export function arrowPan(key: string, view: Size): Point | null {
  const step = { x: view.width * 0.1, y: view.height * 0.1 };
  switch (key) {
    case "ArrowLeft": return { x: step.x, y: 0 };
    case "ArrowRight": return { x: -step.x, y: 0 };
    case "ArrowUp": return { x: 0, y: step.y };
    case "ArrowDown": return { x: 0, y: -step.y };
    default: return null;
  }
}

/** Área visível em frações (0–1) da imagem, para o retângulo do minimapa. */
export function viewportRect(state: ZoomState, view: Size, content: Size): { left: number; top: number; width: number; height: number } {
  const scaledW = content.width * state.scale;
  const scaledH = content.height * state.scale;
  if (!scaledW || !scaledH) return { left: 0, top: 0, width: 1, height: 1 };
  const width = Math.min(1, view.width / scaledW);
  const height = Math.min(1, view.height / scaledH);
  const left = clampTo(0.5 - state.x / scaledW - width / 2, 0, 1 - width);
  const top = clampTo(0.5 - state.y / scaledH - height / 2, 0, 1 - height);
  return { left: round(left * 100) / 100, top: round(top * 100) / 100, width: round(width * 100) / 100, height: round(height * 100) / 100 };
}

export function percent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/** Dica do Dialog: cita os dois limites reais (clique até 3×, pinça até 4×). */
export function zoomHint(scale: number): string {
  if (scale === 1) return `${percent(scale)} · passe o mouse para a lupa · clique para ampliar até ${DESKTOP_MAX}× · pinça até ${TOUCH_MAX}×`;
  return scale < DESKTOP_MAX
    ? `${percent(scale)} · clique para ampliar até ${DESKTOP_MAX}× · pinça até ${TOUCH_MAX}×`
    : `${percent(scale)} · clique volta a 1×`;
}

/** Lupa: diâmetro em px e limites do aumento sobre a imagem exibida. */
export const LENS_SIZE = 220;
const LENS_MIN = 2;
const LENS_MAX = 4;

export type Lens = { left: number; top: number; backgroundSize: string; backgroundPosition: string; factor: number };

/**
 * Lupa sob o cursor (pedido do Fernando, 27/10): o cursor em `at` (relativo ao viewport) vira o centro de um círculo
 * que mostra a imagem de zoom (~2500 px) ampliada. O aumento acompanha a resolução real da imagem (entre 2× e 4×),
 * para a lupa nunca esticar pixels além do original. Fora da imagem (barras do object-contain) não há lupa.
 */
export function lensAt(at: Point, view: Size, natural: Size, size = LENS_SIZE): Lens | null {
  if (!view.width || !view.height || !natural.width || !natural.height) return null;
  const fit = Math.min(view.width / natural.width, view.height / natural.height);
  const shown = { width: natural.width * fit, height: natural.height * fit };
  const offset = { x: (view.width - shown.width) / 2, y: (view.height - shown.height) / 2 };
  const u = (at.x - offset.x) / shown.width;
  const v = (at.y - offset.y) / shown.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const factor = Math.min(LENS_MAX, Math.max(LENS_MIN, 1 / fit));
  const bg = { width: shown.width * factor, height: shown.height * factor };
  return {
    left: at.x - size / 2,
    top: at.y - size / 2,
    backgroundSize: `${bg.width}px ${bg.height}px`,
    backgroundPosition: `${size / 2 - u * bg.width}px ${size / 2 - v * bg.height}px`,
    factor,
  };
}
