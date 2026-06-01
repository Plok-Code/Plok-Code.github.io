/**
 * Profile filter avec animations juciness :
 * - Exit : les cards filtrees out shrinkent + tournent + blurent + s'envolent
 * - Scan line : un trait vert vif balaye le grid de gauche a droite
 * - FLIP : les cards qui restent visibles glissent vers leur nouvelle
 *          position avec overshoot bounce
 * - Entry : les nouvelles cards tombent du ciel avec bounce + scale
 *
 * Idempotent (safe sur pjax / view-transition).
 */

import { prefersReducedMotion } from './config.js';

// Generation token : chaque clic incremente ce compteur. Une passe
// d'animation (asynchrone) capture sa generation au depart ; si un clic
// plus recent survient pendant ses `await`, la passe obsolete abandonne
// avant d'appliquer l'etat hidden, et laisse le DERNIER clic appliquer
// l'etat final. Garantit que les cartes affichees matchent toujours le
// dernier onglet clique, quelle que soit la vitesse de clic (fix race
// condition : avant, l'onglet actif changeait mais les cartes restaient
// celles de la section precedente).
let animGen = 0;

const triggerScanLine = (grid) => {
    if (prefersReducedMotion) return;
    const line = document.createElement('div');
    line.className = 'profile__scan-line';
    grid.appendChild(line);

    const gridWidth = grid.offsetWidth;
    const anim = line.animate([
        { transform: 'translateX(-20px)', opacity: 0 },
        { transform: 'translateX(-20px)', opacity: 1, offset: 0.08 },
        { transform: `translateX(${gridWidth}px)`, opacity: 1, offset: 0.92 },
        { transform: `translateX(${gridWidth + 20}px)`, opacity: 0 }
    ], {
        duration: 700,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
    anim.onfinish = () => line.remove();
};

/**
 * Annule uniquement les animations Web Animations API (creees via
 * element.animate()) sur l'element, en preservant les CSS animations
 * (qui ont un animationName). Sinon on annulerait aussi le fade-in
 * de load et les cards deviendraient invisibles (CSS de base
 * opacity: 0 + animation forwards qui les amenait a 1).
 */
const cancelAllAnims = (el) => {
    if (!el || typeof el.getAnimations !== 'function') return;
    for (const a of el.getAnimations()) {
        // CSS animations ont un animationName non vide ; on les laisse.
        if (a.animationName) continue;
        try { a.cancel(); } catch (_e) {}
    }
};

/**
 * Force une card a son etat VISIBLE definitif, independamment des
 * animations. Indispensable apres un clic rapide : une passe abandonnee
 * a pu lancer un animateExit (fill:forwards -> opacity 0) sur une card
 * que la passe gagnante veut visible. Comme le CSS de base est
 * opacity:0 (anim de load profileCardIn), il ne suffit pas d'annuler les
 * WAAPI : on pose une opacity/transform/filter inline qui font autorite.
 */
const forceVisible = (el) => {
    cancelAllAnims(el);
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.filter = 'none';
};

const animateExit = (card, idx) => {
    if (prefersReducedMotion) return Promise.resolve();
    const rotate = (Math.random() - 0.5) * 18;
    const driftY = -(20 + Math.random() * 30);
    const driftX = (Math.random() - 0.5) * 60;
    const anim = card.animate([
        { opacity: 1, transform: 'scale(1) translate(0, 0) rotate(0)', filter: 'blur(0)' },
        { opacity: 0, transform: `scale(0.35) translate(${driftX}px, ${driftY}px) rotate(${rotate}deg)`, filter: 'blur(8px)' }
    ], {
        duration: 420,
        delay: idx * 28,
        easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)',
        fill: 'forwards'
    });
    // anim.finished rejette si l'animation est .cancel() (clic rapide).
    // On avale le rejet pour ne pas declencher d'unhandledrejection ni
    // casser le Promise.all des sorties.
    return anim.finished.catch(() => {});
};

const animateEntry = (card, idx) => {
    if (prefersReducedMotion) return;
    card.animate([
        { opacity: 0, transform: 'scale(0.4) translateY(-50px) rotate(-6deg)', filter: 'blur(10px)' },
        { opacity: 1, transform: 'scale(1.08) translateY(8px) rotate(0)', filter: 'blur(0)', offset: 0.6 },
        { opacity: 1, transform: 'scale(0.97) translateY(-2px) rotate(0)', filter: 'blur(0)', offset: 0.82 },
        { opacity: 1, transform: 'scale(1) translateY(0) rotate(0)', filter: 'blur(0)' }
    ], {
        duration: 720,
        delay: idx * 55,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        fill: 'none'
    });
};

const animateHeader = (header, action) => {
    if (prefersReducedMotion) return;
    if (action === 'out') {
        header.animate([
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-10px)' }
        ], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    } else {
        header.animate([
            { opacity: 0, transform: 'translateY(-10px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'none' });
    }
};

const flipCards = (firstRects) => {
    for (const [card, firstRect] of firstRects.entries()) {
        if (card.hidden) continue;
        const lastRect = card.getBoundingClientRect();
        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        card.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' }
        ], {
            duration: 580,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            fill: 'none'
        });
    }
};

export const initProfileFilter = () => {
    const tabContainer = document.querySelector('.profile__tabs');
    if (!tabContainer) return;
    if (tabContainer.dataset.filterInit === '1') return;
    tabContainer.dataset.filterInit = '1';

    const tabs = tabContainer.querySelectorAll('.profile__tab');
    const grid = document.querySelector('.profile__grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.profile__card');
    const sectionHeaders = grid.querySelectorAll('.profile__section-header');

    const applyFilterAnimated = async (filter) => {
        // Marque cette passe comme la plus recente. Toute passe anterieure
        // encore en cours deviendra obsolete (myGen < animGen) et abandonnera.
        const myGen = ++animGen;

        // 1. Mesurer positions (FIRST) des cards visibles avant le switch
        const firstRects = new Map();
        for (const card of cards) {
            if (!card.hidden) firstRects.set(card, card.getBoundingClientRect());
        }

        // 2. Determiner qui part / qui arrive
        const exitingCards = [];
        const enteringCards = [];
        for (const card of cards) {
            const cat = card.dataset.category || '';
            const willBeVisible = filter === 'all' || cat === filter;
            if (!card.hidden && !willBeVisible) exitingCards.push(card);
            else if (card.hidden && willBeVisible) enteringCards.push(card);
        }

        const exitingHeaders = [];
        const enteringHeaders = [];
        for (const header of sectionHeaders) {
            const willBeVisible = filter === 'all';
            if (!header.hidden && !willBeVisible) exitingHeaders.push(header);
            else if (header.hidden && willBeVisible) enteringHeaders.push(header);
        }

        // 3. Scan line
        triggerScanLine(grid);

        // 4. EXIT : on annule d'abord toute anim residuelle puis on lance
        //    la sortie (fill forwards : la card reste invisible jusqu'a
        //    ce qu'on la hide via display:none)
        for (const card of exitingCards) cancelAllAnims(card);
        const exitPromises = exitingCards.map((card, i) => animateExit(card, i));
        exitingHeaders.forEach(h => animateHeader(h, 'out'));

        // 5. Attendre la fin du dernier exit (ou un timeout safe)
        await Promise.race([
            Promise.all(exitPromises),
            new Promise(r => setTimeout(r, 700))
        ]);

        // 5b. Si un clic plus recent est arrive pendant l'await, cette passe
        //     est obsolete : on abandonne SANS toucher au hidden state. C'est
        //     la passe la plus recente qui appliquera l'etat final correct.
        if (myGen !== animGen) return;

        // 6. Appliquer hidden state
        for (const card of cards) {
            const cat = card.dataset.category || '';
            card.hidden = !(filter === 'all' || cat === filter);
        }
        for (const header of sectionHeaders) {
            header.hidden = filter !== 'all';
        }

        // 7. CRUCIAL : forcer chaque element VISIBLE a son etat propre
        //    (opacity 1, sans transform/filter residuel). Annule aussi les
        //    WAAPI en cours. Sans ca, un animateExit fill:forwards lance par
        //    une passe abandonnee (clic rapide) laisse des cards a opacity 0,
        //    et le CSS de base (opacity:0 + profileCardIn) ne les rattrape pas.
        for (const card of cards) {
            if (card.hidden) cancelAllAnims(card);
            else forceVisible(card);
        }
        for (const header of sectionHeaders) {
            if (header.hidden) cancelAllAnims(header);
            else forceVisible(header);
        }

        // 8. FLIP pour les cards restees visibles
        flipCards(firstRects);

        // 9. ENTRY : les nouvelles cards arrivent en bouncant. fill:none ->
        //    a la fin, la card revient a l'opacity:1 inline pose en 7.
        enteringCards.forEach((card, i) => animateEntry(card, i));
        enteringHeaders.forEach(h => animateHeader(h, 'in'));

        // 10. Notifier le detail panel pour qu'il puisse switcher de carte
        //     active si l'actuelle est devenue hidden apres le filter.
        window.dispatchEvent(new CustomEvent('profile:filter-applied', { detail: { filter } }));
    };

    for (const tab of tabs) {
        tab.addEventListener('click', () => {
            const filter = tab.dataset.filter || 'all';
            for (const t of tabs) {
                const isActive = t === tab;
                t.classList.toggle('is-active', isActive);
                t.setAttribute('aria-selected', isActive ? 'true' : 'false');
                t.setAttribute('tabindex', isActive ? '0' : '-1');
            }
            applyFilterAnimated(filter);
        });

        tab.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const list = Array.from(tabs);
            const idx = list.indexOf(tab);
            const next = e.key === 'ArrowRight'
                ? list[(idx + 1) % list.length]
                : list[(idx - 1 + list.length) % list.length];
            next.focus();
            next.click();
        });
    }
};
