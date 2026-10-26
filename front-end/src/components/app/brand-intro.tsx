// Estático e anterior ao body: decide a sessão antes do primeiro paint, sem esperar React.
export const INTRO_BOOT_SCRIPT = `(() => {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || sessionStorage.getItem('arremate:intro:v1')) return;
    sessionStorage.setItem('arremate:intro:v1', 'seen');
  } catch { return; }
  const root = document.documentElement;
  root.setAttribute('data-arremate-intro', 'playing');
  const finish = () => {
    root.removeAttribute('data-arremate-intro');
    clearTimeout(timer);
    window.removeEventListener('pointerdown', finish, true);
    window.removeEventListener('keydown', finish, true);
    document.removeEventListener('focusin', finish, true);
    window.removeEventListener('pagehide', finish);
  };
  const timer = setTimeout(finish, 3000);
  window.addEventListener('pointerdown', finish, true);
  window.addEventListener('keydown', finish, true);
  document.addEventListener('focusin', finish, true);
  window.addEventListener('pagehide', finish);
})();`;

export function BrandIntro() {
  return (
    <div className="brand-intro" aria-hidden="true">
      <div className="brand-intro__mark">
        {/* Martelo da L3 (public/brand/l3-simbolo-paper.svg) em papel sobre o bordô do selo. */}
        <svg className="brand-intro__glyph" viewBox="0 0 32 32" aria-hidden="true">
          <g transform="rotate(-40 16 15)">
            <rect x="8.5" y="6" width="15" height="7.5" rx="1.6" fill="#F6F3EC" />
            <rect x="11" y="6" width="1.6" height="7.5" fill="#A9823A" />
            <rect x="19.4" y="6" width="1.6" height="7.5" fill="#A9823A" />
            <rect x="14.7" y="12" width="2.6" height="13" rx="1.3" fill="#F6F3EC" />
          </g>
          <rect x="5" y="24.6" width="13" height="3" rx="1" fill="#A9823A" />
        </svg>
        <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="90" height="90" rx="3" pathLength="1" />
        </svg>
      </div>
      <span className="brand-intro__name">Arremate</span>
    </div>
  );
}
