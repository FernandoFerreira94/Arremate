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
        <span className="brand-intro__letter">A</span>
        <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="90" height="90" rx="3" pathLength="1" />
        </svg>
      </div>
      <span className="brand-intro__name">Arremate</span>
    </div>
  );
}
