"use client";

import { useSyncExternalStore } from "react";
import { preferenceOf, resolveTheme, THEME_STORAGE_KEY, type Theme, type ThemePreference } from "./theme";

const PREFERENCE_EVENT = "arremate:theme-preference";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

function current(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Tema aplicado no <html>; `null` no servidor e antes da hidratação. */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, current, () => null);
}

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribePreference(onChange: () => void) {
  // "Sistema" acompanha a troca do sistema operacional com a página aberta.
  const media = window.matchMedia(SYSTEM_DARK);
  const onSystem = () => {
    if (preferenceOf(readStored()) === "system") document.documentElement.setAttribute("data-theme", media.matches ? "dark" : "light");
  };
  media.addEventListener("change", onSystem);
  window.addEventListener(PREFERENCE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    media.removeEventListener("change", onSystem);
    window.removeEventListener(PREFERENCE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Escolha do menu (Claro, Escuro ou Sistema); `null` no servidor. */
export function useThemePreference(): ThemePreference | null {
  return useSyncExternalStore(subscribePreference, () => preferenceOf(readStored()), () => null);
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // aba anônima ou armazenamento bloqueado: vale só para esta página
  }
  const theme = resolveTheme(preference === "system" ? null : preference, window.matchMedia(SYSTEM_DARK).matches);
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
}
