"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  arrowPan,
  clamp,
  DESKTOP_MAX,
  distance,
  doubleTapScale,
  fitSize,
  IDENTITY,
  nextClickLevel,
  pan,
  pinchScale,
  stepScale,
  TOUCH_MAX,
  viewportRect,
  zoomTo,
  type Point,
  type Size,
  type ZoomState,
} from "../lib/zoom";

/** D28: estado do zoom (Z3) como reducer puro; o hook só liga ponteiro, teclado e tamanho do visor. */
export type ZoomModel = { zoom: ZoomState; view: Size; natural: Size; max: number };
export type ZoomAction =
  | { type: "view"; view: Size }
  | { type: "natural"; natural: Size }
  | { type: "click"; at: Point }
  | { type: "step"; direction: 1 | -1 }
  | { type: "reset" }
  | { type: "doubleTap"; at: Point }
  | { type: "pinch"; startScale: number; startDistance: number; distance: number; at: Point }
  | { type: "pan"; dx: number; dy: number }
  | { type: "key"; key: string }
  | { type: "max"; max: number };

export const INITIAL_ZOOM: ZoomModel = { zoom: IDENTITY, view: { width: 0, height: 0 }, natural: { width: 0, height: 0 }, max: DESKTOP_MAX };

export function zoomReducer(model: ZoomModel, action: ZoomAction): ZoomModel {
  const content = fitSize(model.natural, model.view);
  const set = (zoom: ZoomState): ZoomModel => (zoom.scale === model.zoom.scale && zoom.x === model.zoom.x && zoom.y === model.zoom.y ? model : { ...model, zoom });
  switch (action.type) {
    case "view": {
      if (model.view.width === action.view.width && model.view.height === action.view.height) return model;
      const next = { ...model, view: action.view };
      return { ...next, zoom: clamp(model.zoom, action.view, fitSize(model.natural, action.view), TOUCH_MAX) };
    }
    case "natural":
      return { ...model, natural: action.natural };
    case "max":
      return model.max === action.max ? model : { ...model, max: action.max };
    case "click":
      return set(zoomTo(model.zoom, nextClickLevel(model.zoom.scale), model.view, content, TOUCH_MAX, action.at));
    case "step":
      return set(zoomTo(model.zoom, stepScale(model.zoom.scale, action.direction, model.max), model.view, content, TOUCH_MAX));
    case "reset":
      return set(IDENTITY);
    case "doubleTap":
      return set(zoomTo(model.zoom, doubleTapScale(model.zoom.scale), model.view, content, TOUCH_MAX, action.at));
    case "pinch":
      return set(zoomTo(model.zoom, pinchScale(action.startScale, action.startDistance, action.distance), model.view, content, TOUCH_MAX, action.at));
    case "pan":
      return set(pan(model.zoom, action.dx, action.dy, model.view, content));
    case "key": {
      if (action.key === "+" || action.key === "=") return zoomReducer(model, { type: "step", direction: 1 });
      if (action.key === "-" || action.key === "_") return zoomReducer(model, { type: "step", direction: -1 });
      if (action.key === "0") return set(IDENTITY);
      const delta = arrowPan(action.key, model.view);
      return delta ? set(pan(model.zoom, delta.x, delta.y, model.view, content)) : model;
    }
  }
}

const TAP_MS = 300;
const TAP_SLOP = 24;
const DRAG_SLOP = 4;

type Gesture = {
  pointers: Map<number, Point>;
  start: Point | null;
  last: Point | null;
  moved: boolean;
  pinch: { scale: number; distance: number } | null;
  lastTap: { at: Point; time: number } | null;
};

/** Hook reutilizável do zoom: clique, arrastar, pinça, duplo toque, teclado e minimapa. */
export function useZoom() {
  const [model, dispatch] = useReducer(zoomReducer, INITIAL_ZOOM);
  const [dragging, setDragging] = useState(false);
  const viewport = useRef<HTMLDivElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const gesture = useRef<Gesture>({ pointers: new Map(), start: null, last: null, moved: false, pinch: null, lastTap: null });
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(pointer: coarse)");
    if (!query) return;
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    viewport.current = node;
    if (!node) return;
    const measure = () => dispatch({ type: "view", view: { width: node.clientWidth, height: node.clientHeight } });
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(node);
  }, []);

  const relative = useCallback((clientX: number, clientY: number): Point => {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) };
  }, []);

  const max = coarse ? TOUCH_MAX : DESKTOP_MAX;
  useEffect(() => dispatch({ type: "max", max }), [max]);
  const scaleRef = useRef(model.zoom.scale);
  useEffect(() => {
    scaleRef.current = model.zoom.scale;
  }, [model.zoom.scale]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const g = gesture.current;
    const point = relative(event.clientX, event.clientY);
    g.pointers.set(event.pointerId, point);
    if (g.pointers.size === 1) {
      g.start = point;
      g.last = point;
      g.moved = false;
    } else if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinch = { scale: scaleRef.current, distance: distance(a!, b!) };
      g.moved = true;
    }
  }, [relative]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(event.pointerId)) return;
    const point = relative(event.clientX, event.clientY);
    g.pointers.set(event.pointerId, point);
    if (g.pointers.size >= 2 && g.pinch) {
      const [a, b] = [...g.pointers.values()];
      dispatch({ type: "pinch", startScale: g.pinch.scale, startDistance: g.pinch.distance, distance: distance(a!, b!), at: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 } });
      return;
    }
    if (!g.last || !g.start) return;
    if (!g.moved && distance(point, g.start) > DRAG_SLOP) {
      g.moved = true;
      if (scaleRef.current > 1) setDragging(true);
    }
    if (g.moved && scaleRef.current > 1) dispatch({ type: "pan", dx: point.x - g.last.x, dy: point.y - g.last.y });
    g.last = point;
  }, [relative]);

  const finish = useCallback((event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g.pointers.has(event.pointerId)) return;
    g.pointers.delete(event.pointerId);
    if (g.pointers.size > 0) return;
    const wasPinch = g.pinch !== null;
    g.pinch = null;
    setDragging(false);
    if (cancelled || g.moved || wasPinch) {
      g.start = g.last = null;
      return;
    }
    const at = relative(event.clientX, event.clientY);
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      dispatch({ type: "click", at });
    } else {
      const now = event.timeStamp || performance.now();
      if (g.lastTap && now - g.lastTap.time < TAP_MS && distance(at, g.lastTap.at) < TAP_SLOP) {
        dispatch({ type: "doubleTap", at });
        g.lastTap = null;
      } else {
        g.lastTap = { at, time: now };
      }
    }
    g.start = g.last = null;
  }, [relative]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (["+", "=", "-", "_", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      dispatch({ type: "key", key: event.key });
    }
  }, []);

  const onImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    dispatch({ type: "natural", natural: { width: img.naturalWidth, height: img.naturalHeight } });
  }, []);

  const content = fitSize(model.natural, model.view);
  const minimap = viewportRect(model.zoom, model.view, content);

  return {
    scale: model.zoom.scale,
    x: model.zoom.x,
    y: model.zoom.y,
    max,
    natural: model.natural,
    dragging,
    minimap,
    viewportRef,
    transform: `translate3d(${model.zoom.x}px, ${model.zoom.y}px, 0) scale(${model.zoom.scale})`,
    handlers: { onPointerDown, onPointerMove, onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => finish(e, false), onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => finish(e, true) },
    onKeyDown,
    onImageLoad,
    zoomIn: () => dispatch({ type: "step", direction: 1 }),
    zoomOut: () => dispatch({ type: "step", direction: -1 }),
    reset: () => dispatch({ type: "reset" }),
  };
}
