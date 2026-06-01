/**
 * Theme switcher : applique data-theme="..." sur <html>, persiste
 * dans localStorage. L'application initiale du theme est faite par
 * un inline script anti-FOUT dans le <head> ; cette fonction ne
 * gere que le wiring du dropdown + le toggle au clic.
 */

const THEMES = ['classic', 'hollywood'];
const STORAGE_KEY = 'portfolio:theme';

const readTheme = () => {
    try {
        // URL param ?theme=... prend priorite (utile pour preview / test)
        const urlParams = new URLSearchParams(window.location.search);
        const urlTheme = urlParams.get('theme');
        if (urlTheme && THEMES.includes(urlTheme)) return urlTheme;

        const saved = localStorage.getItem(STORAGE_KEY);
        return THEMES.includes(saved) ? saved : 'classic';
    } catch (_e) {
        return 'classic';
    }
};

const writeTheme = (theme) => {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch (_e) {
        // localStorage indispo (mode privé, etc.) - on continue sans persistence
    }
};

export const initThemeSwitcher = () => {
    const menus = document.querySelectorAll('.masthead__theme-menu');
    if (!menus.length) return;

    const current = readTheme();
    // Le data-theme est deja pose sur <html> par l'inline script du head,
    // mais on le re-confirme ici au cas ou.
    document.documentElement.setAttribute('data-theme', current);

    for (const menu of menus) {
        if (menu.dataset.themeInit === '1') continue;
        menu.dataset.themeInit = '1';

        const options = menu.querySelectorAll('.masthead__theme-option');

        // Marque l'option active au mount
        for (const option of options) {
            const isActive = option.dataset.theme === current;
            option.classList.toggle('is-active', isActive);
            option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }

        // Wire le clic sur chaque option
        for (const option of options) {
            option.addEventListener('click', () => {
                const newTheme = option.dataset.theme;
                if (!THEMES.includes(newTheme)) return;

                document.documentElement.setAttribute('data-theme', newTheme);
                writeTheme(newTheme);

                // Met a jour les classes is-active sur TOUS les menus
                // (si plusieurs sur la page, peu probable mais safe)
                for (const m of menus) {
                    for (const o of m.querySelectorAll('.masthead__theme-option')) {
                        const active = o.dataset.theme === newTheme;
                        o.classList.toggle('is-active', active);
                        o.setAttribute('aria-pressed', active ? 'true' : 'false');
                    }
                }

                // Ferme le dropdown apres selection
                const details = option.closest('details');
                if (details) details.open = false;
            });
        }
    }
};
