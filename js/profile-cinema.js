/**
 * Profile Cinema (Hollywood theme).
 *
 * Galerie d'affiches Saul Bass : click sur un poster = ouverture d'une
 * MODAL CENTRALE qui affiche l'affiche en grand + le chapitre. Plus
 * de feature panel inline ; tout passe par la modal pour eviter les
 * conflits UI (scroll-jump, layout shift, overflow).
 *
 * Reuse les <template data-card-template="..."> du profil classic
 * pour le contenu (zero duplication).
 *
 * Tabs : meme principe que profile-filter.js mais selectors propres.
 *
 * Idempotent (safe sur pjax / theme switch).
 */

import { prefersReducedMotion } from './config.js';

export const initProfileCinema = () => {
    const section = document.querySelector(".profile-cinema");
    if (!section) return;
    if (section.dataset.cinemaInit === "1") return;
    section.dataset.cinemaInit = "1";

    const posters = section.querySelectorAll(".profile-cinema__poster[data-cinema-card]");
    const tabs = section.querySelectorAll(".profile-cinema__tab");

    // Modal elements
    const modal = section.querySelector("[data-cinema-modal]");
    const modalPanel = modal?.querySelector(".profile-cinema__modal-panel");
    const modalImage = section.querySelector("[data-cinema-modal-image]");
    const modalChapter = section.querySelector("[data-cinema-modal-chapter]");
    const modalTitle = section.querySelector("[data-cinema-modal-title]");
    const modalContent = section.querySelector("[data-cinema-modal-content]");
    const modalBody = modal?.querySelector(".profile-cinema__modal-body");
    const modalCloseTriggers = modal?.querySelectorAll("[data-cinema-modal-close]");

    if (!posters.length || !modal || !modalPanel) return;

    let lastFocus = null;
    let closeTimer = null;

    // ============== MASTHEAD HEIGHT TRACKING ==============
    // La modal doit etre centree entre la base du header et le bas du
    // viewport. Comme le masthead peut wrap sur mobile (boutons sur 2
    // lignes), on mesure sa hauteur reelle et on la pousse en CSS var.
    const masthead = document.querySelector(".masthead");
    const updateMastheadHeight = () => {
        if (!masthead) return;
        const h = masthead.getBoundingClientRect().height;
        modal.style.setProperty("--masthead-height", `${Math.round(h)}px`);
    };
    updateMastheadHeight();
    if (typeof ResizeObserver === "function" && masthead) {
        const ro = new ResizeObserver(updateMastheadHeight);
        ro.observe(masthead);
    } else {
        window.addEventListener("resize", updateMastheadHeight, { passive: true });
    }

    // ============== CHIP POSITION ANCHORING ==============
    // L'image utilise object-fit: contain donc elle est centree dans son
    // conteneur avec du whitespace autour si les ratios different. Pour
    // que le chip CH. XX reste colle au coin haut-gauche de l'IMAGE
    // visible (pas du conteneur), on calcule l'offset du whitespace.
    const modalImageEl = modalImage;
    const modalPosterCol = section.querySelector(".profile-cinema__modal-poster");
    const INSET = 10; // px depuis le coin de l'image visible

    const updateChipPosition = () => {
        if (!modalImageEl || !modalPosterCol) return;
        const imgRect = modalImageEl.getBoundingClientRect();
        const colRect = modalPosterCol.getBoundingClientRect();
        if (!imgRect.width || !imgRect.height || !modalImageEl.naturalWidth) return;

        // L'img element occupe une zone X au sein du col, mais avec
        // object-fit: contain l'image visible est centree dans cette zone.
        // Le whitespace est sur l'axe ou le ratio du conteneur depasse
        // le ratio naturel.
        const natR = modalImageEl.naturalWidth / modalImageEl.naturalHeight;
        const boxR = imgRect.width / imgRect.height;
        let visibleW, visibleH, padX, padY;
        if (boxR > natR) {
            // Box plus large que l'image : whitespace gauche/droite
            visibleH = imgRect.height;
            visibleW = visibleH * natR;
            padX = (imgRect.width - visibleW) / 2;
            padY = 0;
        } else {
            // Box plus haute que l'image : whitespace haut/bas
            visibleW = imgRect.width;
            visibleH = visibleW / natR;
            padX = 0;
            padY = (imgRect.height - visibleH) / 2;
        }

        // Position du coin haut-gauche de l'image visible, relative au col
        const topInCol = (imgRect.top - colRect.top) + padY + INSET;
        const leftInCol = (imgRect.left - colRect.left) + padX + INSET;
        modalPosterCol.style.setProperty("--chip-top", `${Math.round(topInCol)}px`);
        modalPosterCol.style.setProperty("--chip-left", `${Math.round(leftInCol)}px`);
    };

    // Mise a jour du chip : a chaque resize de la modal/img
    if (typeof ResizeObserver === "function" && modalImageEl) {
        const ro = new ResizeObserver(updateChipPosition);
        ro.observe(modalImageEl);
        ro.observe(modalPosterCol);
    }
    window.addEventListener("resize", updateChipPosition, { passive: true });
    // Au load de l'image (premiere ouverture ou nouveau src)
    if (modalImageEl) {
        modalImageEl.addEventListener("load", updateChipPosition);
    }

    // ============== MODAL OPEN / CLOSE ==============

    const openModal = (poster) => {
        if (!poster) return;
        const key = poster.dataset.cardKey;
        const titleHtml = poster.dataset.cardTitle || "";
        const chapterText = poster.querySelector(".profile-cinema__poster-chapter")?.textContent?.trim() || "";
        const img = poster.querySelector(".profile-cinema__poster-image img");
        const imgSrc = img?.getAttribute("src") || "";
        const template = document.querySelector(`template[data-card-template="${key}"]`);

        // Populate modal
        if (modalImage) {
            modalImage.src = imgSrc;
            modalImage.alt = poster.dataset.cardTitle || "";
        }
        if (modalChapter) modalChapter.textContent = chapterText;
        if (modalTitle) modalTitle.innerHTML = titleHtml;
        if (modalContent) {
            modalContent.replaceChildren();
            if (template?.content && template.content.childNodes.length) {
                modalContent.appendChild(template.content.cloneNode(true));
            } else {
                const fb = document.createElement("p");
                fb.className = "muted";
                fb.textContent = "Chapitre indisponible.";
                modalContent.appendChild(fb);
            }
        }

        // Reset scroll dans la modal
        if (modalBody) modalBody.scrollTop = 0;

        // Garde le focus return
        lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        // Open animation
        window.clearTimeout(closeTimer);
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-cinema-modal-open");

        // Force reflow puis ajoute is-open pour declencher la transition
        void modal.offsetWidth;
        modal.classList.add("is-open");

        // Recalcule la position du chip apres ouverture (l'image peut
        // deja etre loadee si cache, le load event ne refire pas)
        requestAnimationFrame(updateChipPosition);

        // Focus sur le panel (pour Escape)
        modalPanel.focus();
    };

    const closeModal = () => {
        if (modal.hidden) return;
        modal.classList.remove("is-open");

        const finalize = () => {
            modal.hidden = true;
            modal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("is-cinema-modal-open");
            if (lastFocus instanceof HTMLElement) lastFocus.focus();
            lastFocus = null;
        };

        if (prefersReducedMotion) {
            finalize();
        } else {
            closeTimer = window.setTimeout(finalize, 300);
        }
    };

    // Click handlers sur posters
    for (const poster of posters) {
        if (poster.dataset.cinemaBound === "1") continue;
        poster.dataset.cinemaBound = "1";
        poster.addEventListener("click", () => openModal(poster));
    }

    // Close triggers (backdrop + close button)
    for (const trigger of (modalCloseTriggers || [])) {
        trigger.addEventListener("click", closeModal);
    }

    // Escape key
    modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            closeModal();
            return;
        }
        // Focus trap basic : tab boucle dans la modal
        if (e.key !== "Tab") return;
        const focusables = modalPanel.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;
        if (e.shiftKey && current === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && current === last) {
            e.preventDefault();
            first.focus();
        }
    });

    // ============== TAB FILTER ==============

    const triggerFlash = () => {
        if (prefersReducedMotion) return;
        const flash = document.createElement("div");
        flash.style.cssText = `
            position: fixed; inset: 0; background: rgba(var(--accent-rgb), 0.06);
            pointer-events: none; z-index: 999; opacity: 0;
        `;
        document.body.appendChild(flash);
        flash.animate(
            [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }],
            { duration: 320, easing: "ease-out" }
        ).finished.finally(() => flash.remove());
    };

    const applyFilter = (filter) => {
        triggerFlash();
        for (const poster of posters) {
            const cat = poster.dataset.category || "";
            poster.hidden = !(filter === "all" || cat === filter);
        }
    };

    for (const tab of tabs) {
        if (tab.dataset.cinemaTabBound === "1") continue;
        tab.dataset.cinemaTabBound = "1";

        tab.addEventListener("click", () => {
            const filter = tab.dataset.cinemaFilter || "all";
            for (const t of tabs) {
                const isActive = t === tab;
                t.classList.toggle("is-active", isActive);
                t.setAttribute("aria-selected", isActive ? "true" : "false");
                t.setAttribute("tabindex", isActive ? "0" : "-1");
            }
            applyFilter(filter);
        });

        tab.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const list = Array.from(tabs);
            const idx = list.indexOf(tab);
            const next = e.key === "ArrowRight"
                ? list[(idx + 1) % list.length]
                : list[(idx - 1 + list.length) % list.length];
            next.focus();
            next.click();
        });
    }
};
