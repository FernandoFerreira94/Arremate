import { describe, expect, it } from "vitest";
import { DESKTOP_MAX, TOUCH_MAX, clamp, fitSize, nextClickLevel, pinchScale, stepScale, viewportRect, zoomHint } from "../lib/zoom";
import { INITIAL_ZOOM, zoomReducer, type ZoomAction, type ZoomModel } from "./use-zoom";

const ready = (max = DESKTOP_MAX): ZoomModel =>
  [
    { type: "view", view: { width: 1000, height: 600 } },
    { type: "natural", natural: { width: 2500, height: 1500 } },
    { type: "max", max },
  ].reduce<ZoomModel>((model, action) => zoomReducer(model, action as ZoomAction), INITIAL_ZOOM);
const run = (model: ZoomModel, ...actions: ZoomAction[]) => actions.reduce(zoomReducer, model);

describe("zoom Z3 (D28): matemática", () => {
  it("encaixa a obra no visor (object-contain)", () => {
    expect(fitSize({ width: 2500, height: 1500 }, { width: 1000, height: 600 })).toEqual({ width: 1000, height: 600 });
    expect(fitSize({ width: 1000, height: 2000 }, { width: 1000, height: 600 })).toEqual({ width: 300, height: 600 });
  });

  it("clique vai de 1× a 2×, 3× e volta a 1×", () => {
    expect([1, 2, 3].map(nextClickLevel)).toEqual([2, 3, 1]);
    expect(nextClickLevel(2.5)).toBe(3);
  });

  it("barra anda de 0,5× e respeita o teto do desktop e do toque", () => {
    expect(stepScale(1, 1)).toBe(1.5);
    expect(stepScale(3, 1)).toBe(DESKTOP_MAX);
    expect(stepScale(3, 1, TOUCH_MAX)).toBe(3.5);
    expect(stepScale(1.2, -1)).toBe(1);
  });

  it("pinça fica entre 1× e 4×", () => {
    expect(pinchScale(1, 100, 250)).toBe(2.5);
    expect(pinchScale(2, 100, 900)).toBe(TOUCH_MAX);
    expect(pinchScale(2, 100, 10)).toBe(1);
  });

  it("não deixa arrastar para fora da obra", () => {
    const view = { width: 1000, height: 600 };
    expect(clamp({ scale: 2, x: 5000, y: -5000 }, view, view)).toEqual({ scale: 2, x: 500, y: -300 });
    expect(clamp({ scale: 1, x: 40, y: 40 }, view, view)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("minimapa mostra a fração visível", () => {
    const view = { width: 1000, height: 600 };
    expect(viewportRect({ scale: 1, x: 0, y: 0 }, view, view)).toEqual({ left: 0, top: 0, width: 1, height: 1 });
    expect(viewportRect({ scale: 2, x: 0, y: 0 }, view, view)).toEqual({ left: 0.25, top: 0.25, width: 0.5, height: 0.5 });
    expect(viewportRect({ scale: 2, x: 500, y: 300 }, view, view)).toEqual({ left: 0, top: 0, width: 0.5, height: 0.5 });
  });
});

describe("useZoom (D28): reducer do hook", () => {
  it("mesmo tamanho de viewport devolve o mesmo estado (sem laço de render)", () => {
    const model = run(INITIAL_ZOOM, { type: "view", view: { width: 800, height: 600 } });
    expect(zoomReducer(model, { type: "view", view: { width: 800, height: 600 } })).toBe(model);
  });

  it("clique amplia no ponto clicado e o terceiro clique volta a 1×", () => {
    const two = run(ready(), { type: "click", at: { x: 200, y: 100 } });
    expect(two.zoom).toEqual({ scale: 2, x: -200, y: -100 });
    const three = run(two, { type: "click", at: { x: 0, y: 0 } });
    expect(three.zoom.scale).toBe(3);
    expect(run(three, { type: "click", at: { x: 0, y: 0 } }).zoom).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("teclado: + e − mudam o zoom, setas movem e 0 redefine", () => {
    let model = run(ready(), { type: "key", key: "+" }, { type: "key", key: "+" });
    expect(model.zoom.scale).toBe(2);
    model = run(model, { type: "key", key: "ArrowRight" });
    expect(model.zoom.x).toBe(-100);
    model = run(model, { type: "key", key: "-" });
    expect(model.zoom.scale).toBe(1.5);
    expect(run(model, { type: "key", key: "0" }).zoom).toEqual({ scale: 1, x: 0, y: 0 });
    expect(run(ready(), { type: "key", key: "a" })).toEqual(ready());
  });

  it("duplo toque alterna 1× e 2,5×; pinça chega a 4× no toque", () => {
    const tapped = run(ready(TOUCH_MAX), { type: "doubleTap", at: { x: 0, y: 0 } });
    expect(tapped.zoom.scale).toBe(2.5);
    expect(run(tapped, { type: "doubleTap", at: { x: 0, y: 0 } }).zoom.scale).toBe(1);
    const pinched = run(ready(TOUCH_MAX), { type: "pinch", startScale: 1, startDistance: 100, distance: 600, at: { x: 0, y: 0 } });
    expect(pinched.zoom.scale).toBe(4);
  });

  it("arrastar só move com zoom e para na borda; redefinir volta ao centro", () => {
    expect(run(ready(), { type: "pan", dx: 50, dy: 50 }).zoom).toEqual({ scale: 1, x: 0, y: 0 });
    const panned = run(ready(), { type: "click", at: { x: 0, y: 0 } }, { type: "pan", dx: 9999, dy: 10 });
    expect(panned.zoom).toEqual({ scale: 2, x: 500, y: 10 });
    expect(run(panned, { type: "reset" }).zoom).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("visor menor reajusta o deslocamento", () => {
    const panned = run(ready(), { type: "click", at: { x: 0, y: 0 } }, { type: "pan", dx: 500, dy: 0 });
    const resized = run(panned, { type: "view", view: { width: 500, height: 300 } });
    expect(resized.zoom.x).toBe(250);
  });

  it("dica cita os dois limites reais: clique até 3× e pinça até 4× (QA N3)", () => {
    expect(zoomHint(1)).toBe("100% · clique para ampliar até 3× · pinça até 4×");
    expect(zoomHint(2)).toBe("200% · clique para ampliar até 3× · pinça até 4×");
    expect(zoomHint(3)).toBe("300% · clique volta a 1×");
    expect(zoomHint(TOUCH_MAX)).toBe("400% · clique volta a 1×");
  });
});
