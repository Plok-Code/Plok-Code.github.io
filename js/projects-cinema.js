/**
 * Projets Hollywood : pellicule 35mm + projection mode.
 *
 * INTERACTIONS PELLICULE :
 * 1. Molette verticale → scroll horizontal
 * 2. Click + maintien souris + bouger = drag scroll
 * 3. Doigt tactile = swipe drag (touchstart/touchmove/touchend)
 * 4. Boutons prev/next + fleches clavier
 * 5. LOOP INFINI : la pellicule est triplee (clones gauche + originaux
 *    + clones droite). Quand le scroll passe dans une zone clone, on
 *    le ramene silencieusement a la position equivalente des originaux.
 *
 * PROJECTION MODE : click sur une frame = takeover plein viewport.
 * L'image devient le fond cinemascope, bandes letterbox slident, contenu
 * en sous-titres cinema. Different du modal du profil (qui est centre
 * 2-col).
 *
 * Idempotent (safe sur pjax / theme switch).
 */

import { prefersReducedMotion } from './config.js';
import { pjaxNavigate, canPjaxNavigateTo, hardNavigate } from './pjax.js';

export const initProjectsCinema = () => {
    const section = document.querySelector(".projects-cinema");
    if (!section) return;
    if (section.dataset.cinemaInit === "1") return;
    section.dataset.cinemaInit = "1";

    const reel = section.querySelector("[data-projects-reel]");
    const framesContainer = section.querySelector(".projects-cinema__frames");
    const originalFrames = Array.from(framesContainer?.querySelectorAll("[data-projects-frame]") || []);
    const prevBtn = section.querySelector("[data-projects-prev]");
    const nextBtn = section.querySelector("[data-projects-next]");
    const counter = section.querySelector("[data-projects-counter]");

    const projection = section.querySelector("[data-projects-projection]");
    const projImage = section.querySelector("[data-projects-projection-image]");
    const projReel = section.querySelector("[data-projects-projection-reel]");
    const projKicker = section.querySelector("[data-projects-projection-kicker]");
    const projTitle = section.querySelector("[data-projects-projection-title]");
    const projSynopsis = section.querySelector("[data-projects-projection-synopsis]");
    const projCta = section.querySelector("[data-projects-projection-cta]");
    const projCloseTriggers = section.querySelectorAll("[data-projects-projection-close]");

    if (!reel || !framesContainer || !originalFrames.length || !projection) return;

    let lastFocus = null;
    let closeTimer = null;
    const TOTAL_ORIGINALS = originalFrames.length;

    // ============== CLONE FRAMES POUR LOOP INFINI ==============
    // On clone toutes les frames une fois a gauche et une fois a droite.
    // DOM total : [clones_gauche x N] + [originaux x N] + [clones_droite x N]
    // Au boot, on positionne scrollLeft = largeur des clones gauche
    // (= start des originaux). Quand le scroll depasse les seuils, on
    // ramene silencieusement a la position equivalente des originaux.
    const cloneFrame = (frame, position) => {
        const c = frame.cloneNode(true);
        c.setAttribute("data-clone", position);
        c.dataset.frameBound = "";
        // Important : le clone garde tous les data-* attrs (title, image, etc)
        // donc click ouvre la meme projection que l'original.
        return c;
    };

    const leftClones = originalFrames.map(f => cloneFrame(f, "left"));
    const rightClones = originalFrames.map(f => cloneFrame(f, "right"));

    // Prepend left clones (en ordre normal)
    for (let i = leftClones.length - 1; i >= 0; i--) {
        framesContainer.insertBefore(leftClones[i], framesContainer.firstChild);
    }
    // Append right clones
    for (const c of rightClones) {
        framesContainer.appendChild(c);
    }

    // Maintenant ALL frames (clones + originaux) :
    const allFrames = Array.from(framesContainer.querySelectorAll("[data-projects-frame]"));

    // ============== MESURE LARGEUR D'UN SET ==============
    // Apres rendering, on mesure la largeur d'un set de N originaux
    // (somme largeurs + gaps + padding). On utilise getBoundingClientRect
    // sur le 1er et le (N+1)-ieme frame pour avoir l'offset.
    let setWidth = 0;
    let initialScrollLeft = 0;

    const measureSet = () => {
        if (allFrames.length < TOTAL_ORIGINALS * 2) return;
        const firstClone = allFrames[0];
        const firstOriginal = allFrames[TOTAL_ORIGINALS];
        if (!firstClone || !firstOriginal) return;
        const aRect = firstClone.getBoundingClientRect();
        const bRect = firstOriginal.getBoundingClientRect();
        setWidth = bRect.left - aRect.left;
        initialScrollLeft = setWidth; // start of originals
    };

    // Mesure + positionne au start des originaux apres le premier layout
    const initLoopPosition = () => {
        measureSet();
        if (setWidth > 0) {
            // Disable smooth scroll behavior temporarily
            const prevBehavior = reel.style.scrollBehavior;
            reel.style.scrollBehavior = "auto";
            reel.scrollLeft = initialScrollLeft;
            reel.style.scrollBehavior = prevBehavior;
            updateCounter();
        }
    };

    requestAnimationFrame(() => requestAnimationFrame(initLoopPosition));
    // Recalcule en cas de resize (rotation tablette, etc.)
    window.addEventListener("resize", () => {
        // Sauvegarde la frame courante AVANT recalcul, puis re-aligne
        const curIdx = getCurrentRealIndex();
        measureSet();
        if (setWidth > 0) {
            scrollToFrame(curIdx, false);
        }
    }, { passive: true });

    // ============== LOOP DETECTION ==============
    // Quand le scroll est trop a gauche (dans les clones gauche) ou trop
    // a droite (dans les clones droite), on saute silencieusement de
    // +/- 1 setWidth pour rester dans la zone "originaux + voisins".
    //
    // Important : le seuil droit doit etre REACHABLE par l'utilisateur.
    // Le max scrollLeft naturel est scrollWidth - clientWidth = environ
    // 3*setWidth - clientWidth. Si on met le seuil a 2.5*setWidth, il
    // peut etre superieur au max et donc inatteignable, ce qui empeche
    // le loop droit. On utilise des seuils plus proches des frontieres
    // entre zones (1*setWidth et 2*setWidth), avec un petit offset pour
    // eviter les micro-oscillations exactement a la frontiere.
    const enforceLoop = () => {
        if (setWidth <= 0) {
            measureSet();
            if (setWidth <= 0) return;
        }
        const sl = reel.scrollLeft;
        if (sl < setWidth * 0.85) {
            // Dans la zone clone gauche : sauter vers la droite d'un set
            const prev = reel.style.scrollBehavior;
            reel.style.scrollBehavior = "auto";
            reel.scrollLeft = sl + setWidth;
            reel.style.scrollBehavior = prev;
        } else if (sl > setWidth * 2.05) {
            // Dans la zone clone droite : sauter vers la gauche d'un set
            const prev = reel.style.scrollBehavior;
            reel.style.scrollBehavior = "auto";
            reel.scrollLeft = sl - setWidth;
            reel.style.scrollBehavior = prev;
        }
    };

    // ============== COUNTER ==============
    const formatCounter = (idx) => {
        const cur = String(idx + 1).padStart(2, "0");
        const tot = String(TOTAL_ORIGINALS).padStart(2, "0");
        return `${cur} / ${tot}`;
    };

    const getCurrentRealIndex = () => {
        // Frame la plus proche du centre visible
        const reelRect = reel.getBoundingClientRect();
        const centerX = reelRect.left + reelRect.width / 2;
        let bestI = 0;
        let bestD = Infinity;
        allFrames.forEach((f, i) => {
            const r = f.getBoundingClientRect();
            const fx = r.left + r.width / 2;
            const d = Math.abs(fx - centerX);
            if (d < bestD) { bestD = d; bestI = i; }
        });
        // Mappe sur l'index reel (0..N-1) via modulo
        return bestI % TOTAL_ORIGINALS;
    };

    const updateCounter = () => {
        if (!counter) return;
        counter.textContent = formatCounter(getCurrentRealIndex());
    };

    const scrollToFrame = (realIdx, smooth = true) => {
        if (setWidth <= 0) {
            measureSet();
            if (setWidth <= 0) return;
        }
        // On reste dans la zone des originaux (index N..2N-1 dans allFrames)
        // pour profiter du buffer de clones de chaque cote.
        const targetIdx = TOTAL_ORIGINALS + ((realIdx % TOTAL_ORIGINALS + TOTAL_ORIGINALS) % TOTAL_ORIGINALS);
        const frame = allFrames[targetIdx];
        if (!frame) return;
        const reelRect = reel.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const targetLeft = reel.scrollLeft + (frameRect.left - reelRect.left) - (reelRect.width - frameRect.width) / 2;
        reel.scrollTo({
            left: targetLeft,
            behavior: smooth && !prefersReducedMotion ? "smooth" : "auto",
        });
    };

    // ============== SCROLL EVENT ==============
    let scrollRaf = 0;
    reel.addEventListener("scroll", () => {
        if (scrollRaf) cancelAnimationFrame(scrollRaf);
        scrollRaf = requestAnimationFrame(() => {
            enforceLoop();
            updateCounter();
        });
    });

    // ============== MOLETTE ==============
    reel.addEventListener("wheel", (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        reel.scrollLeft += e.deltaY;
    }, { passive: false });

    // ============== DRAG SOURIS ==============
    let isDragging = false;
    let dragStartX = 0;
    let scrollStartX = 0;
    let dragMoved = 0;

    const onMouseDown = (e) => {
        // On laisse passer le clic frame seulement si pas drag
        isDragging = true;
        dragMoved = 0;
        dragStartX = e.pageX;
        scrollStartX = reel.scrollLeft;
        reel.classList.add("is-dragging");
        // Empeche la selection
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.pageX - dragStartX;
        dragMoved = Math.max(dragMoved, Math.abs(dx));
        reel.scrollLeft = scrollStartX - dx;
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        reel.classList.remove("is-dragging");
        // Si on a vraiment drag (> 6px), bloque le prochain click sur frame
        // pour eviter d'ouvrir la projection par accident
        if (dragMoved > 6) {
            const blockClickOnce = (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                reel.removeEventListener("click", blockClickOnce, true);
            };
            reel.addEventListener("click", blockClickOnce, true);
        }
    };

    reel.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // ============== DRAG TACTILE (touch) ==============
    // Pour smartphone / tablette : touchstart + touchmove + touchend
    let touchStartX = 0;
    let touchScrollStart = 0;
    let touchMoved = 0;
    let isTouching = false;

    reel.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;
        isTouching = true;
        touchMoved = 0;
        touchStartX = e.touches[0].pageX;
        touchScrollStart = reel.scrollLeft;
    }, { passive: true });

    reel.addEventListener("touchmove", (e) => {
        if (!isTouching || e.touches.length !== 1) return;
        const dx = e.touches[0].pageX - touchStartX;
        touchMoved = Math.max(touchMoved, Math.abs(dx));
        // Note : on laisse le browser scroller nativement grace a touch-action:
        // pan-x, mais on observe pour bloquer le click si gros mouvement.
    }, { passive: true });

    reel.addEventListener("touchend", () => {
        if (!isTouching) return;
        isTouching = false;
        if (touchMoved > 8) {
            // Bloque le tap click suivant (eviter ouvrir projection apres swipe)
            const blockClickOnce = (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                reel.removeEventListener("click", blockClickOnce, true);
            };
            reel.addEventListener("click", blockClickOnce, true);
        }
    }, { passive: true });

    // ============== CLAVIER ==============
    reel.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            scrollToFrame(getCurrentRealIndex() - 1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            scrollToFrame(getCurrentRealIndex() + 1);
        }
    });

    prevBtn?.addEventListener("click", () => scrollToFrame(getCurrentRealIndex() - 1));
    nextBtn?.addEventListener("click", () => scrollToFrame(getCurrentRealIndex() + 1));

    // ============== PROJECTION MODE ==============
    const openProjection = (frame) => {
        if (!frame) return;
        const reelNum = frame.dataset.reel || "";
        const title = frame.dataset.title || "";
        const kicker = frame.dataset.kicker || "";
        const synopsis = frame.dataset.synopsis || "";
        const image = frame.dataset.image || "";
        const href = frame.dataset.href || "#";

        if (projImage) projImage.style.backgroundImage = image ? `url('${image}')` : "";
        if (projReel) projReel.textContent = `Reel ${reelNum} / ${String(TOTAL_ORIGINALS).padStart(2, "0")}`;
        if (projKicker) projKicker.textContent = kicker;
        if (projTitle) projTitle.innerHTML = title;
        if (projSynopsis) projSynopsis.textContent = synopsis;
        if (projCta) projCta.setAttribute("href", href);

        lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        window.clearTimeout(closeTimer);
        projection.hidden = false;
        projection.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-projection-open");

        void projection.offsetWidth;
        projection.classList.add("is-open");

        const firstClose = projCloseTriggers[0];
        firstClose?.focus();
    };

    const closeProjection = () => {
        if (projection.hidden) return;
        projection.classList.remove("is-open");

        const finalize = () => {
            projection.hidden = true;
            projection.setAttribute("aria-hidden", "true");
            document.body.classList.remove("is-projection-open");
            if (lastFocus instanceof HTMLElement) lastFocus.focus();
            lastFocus = null;
        };

        if (prefersReducedMotion) {
            finalize();
        } else {
            closeTimer = window.setTimeout(finalize, 360);
        }
    };

    // ============== CLICK FRAME = NAVIGATE TO PROJECT PAGE ==============
    // Click sur une frame ouvre directement la page projet detaillee.
    // Si la cible est un .html interne, on passe par PJAX pour la
    // transition douce ; sinon hard navigate.
    const navigateToProject = (href) => {
        if (!href || href === "#") return;
        try {
            const url = new URL(href, window.location.href);
            if (canPjaxNavigateTo(url)) {
                void pjaxNavigate(url.href);
            } else {
                hardNavigate(href);
            }
        } catch {
            hardNavigate(href);
        }
    };

    for (const frame of allFrames) {
        if (frame.dataset.frameBound === "1") continue;
        frame.dataset.frameBound = "1";
        frame.addEventListener("click", () => {
            // Si dragMoved > seuil, le blockClickOnce a deja arrete la propagation
            const href = frame.dataset.href;
            navigateToProject(href);
        });
    }

    for (const trigger of projCloseTriggers) {
        trigger.addEventListener("click", closeProjection);
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !projection.hidden) {
            e.preventDefault();
            closeProjection();
        }
    });

    projection.addEventListener("click", (e) => {
        if (e.target === projection || e.target.classList.contains("projects-cinema__projection-image")) {
            closeProjection();
        }
    });
};
