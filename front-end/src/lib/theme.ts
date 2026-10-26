export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "arremate:theme";

/** Escolha salva vence; sem escolha, segue o sistema. Valor salvo inválido conta como ausente. */
export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemDark ? "dark" : "light";
}

/**
 * Roda no <head> antes da hidratação (com o nonce da CSP) para não piscar o tema claro.
 * Mantém a mesma regra de `resolveTheme`; sem JS a página fica no tema claro.
 */
export const THEME_BOOT_SCRIPT = `(() => {
  let stored = null;
  try { stored = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch {}
  const dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();`;
