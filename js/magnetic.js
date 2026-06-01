/**
 * Magnetic effect : les boutons et l'avatar du hero "attirent" le curseur quand on s'en approche.
 * Pattern inspire de Ribbit / 1x.tech / Vercel.
 *
 * Cibles : tout element avec data-magnetic, par defaut les .btn.primary et .hero-profile__avatar.
 * Force : configurable par data-magnetic-strength (default 0.3 = soft).
 */
import { prefersReducedMotion } from './config.js';

const ACTIVE_RADIUS = 80; // distance en px au-dela de laquelle l'effet s'arrete
const RESET_DUR = 600; // ms pour revenir au repos

const handlers = new WeakMap();

const bindMagnetic = (el) => {
    if (handlers.has(el)) return;

    const strength = parseFloat(el.dataset.magneticStrength) || 0.3;

    const onMove = (e) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);

        // Hors zone : reset (l'event mouseleave sur le parent s'en occupera aussi)
        if (dist > Math.max(rect.width, rect.height) / 2 + ACTIVE_RADIUS) {
            el.style.transform = '';
            return;
        }

        // Force decroissante avec la distance
        const factor = Math.min(1, 1 - dist / (Math.max(rect.width, rect.height) + ACTIVE_RADIUS));
        const tx = dx * strength * factor;
        const ty = dy * strength * factor;
        el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
        el.style.transition = `transform 180ms cubic-bezier(0.16, 1, 0.3, 1)`;
    };

    const onLeave = () => {
        el.style.transform = '';
        el.style.transition = `transform ${RESET_DUR}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    handlers.set(el, { onMove, onLeave });
};

export const initMagnetic = () => {
    if (prefersReducedMotion) return;
    // Coarse pointers (touch) : pas d'effet magnetic
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const selectors = [
        '[data-magnetic]',
        '.hero-actions .btn.primary',
        '.hero-profile__avatar-wrap',
    ];
    const targets = document.querySelectorAll(selectors.join(', '));
    for (const el of targets) {
        bindMagnetic(el);
    }
};
