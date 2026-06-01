import { prefersReducedMotion } from './config.js';

export const initCardDecks = () => {
    const decks = document.querySelectorAll("[data-card-deck]");
    if (!decks.length) return;

    const modal = document.querySelector("[data-deck-modal]");
    const backdrop = modal?.querySelector?.("[data-deck-modal-backdrop]");
    const panel = modal?.querySelector?.("[data-deck-modal-panel]");
    const closeButton = modal?.querySelector?.("[data-deck-modal-close]");
    const hero = modal?.querySelector?.("[data-deck-modal-hero]");
    const modalBody = modal?.querySelector?.(".deck-modal__body");
    const modalTitle = modal?.querySelector?.("[data-deck-modal-title]");
    const modalContent = modal?.querySelector?.("[data-deck-modal-content]");
    const scrollCue = modal?.querySelector?.("[data-deck-modal-scroll-cue]");

    if (!modal || !backdrop || !panel || !closeButton || !hero || !modalBody || !modalTitle || !modalContent) return;
    if (modal.dataset.modalInit === "1") return;
    modal.dataset.modalInit = "1";

    let lastFocus = null;
    let activeCard = null;
    let closeTimer = null;
    let modalToken = 0;
    let activeFlyAnimation = null;
    let readyTimer = null;

    const focusableSelector =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const getFocusable = () =>
        Array.from(panel.querySelectorAll(focusableSelector)).filter((el) => {
            if (el.hidden) return false;
            const style = window.getComputedStyle(el);
            return style.visibility !== "hidden" && style.display !== "none";
        });

    const updateScrollHint = () => {
        if (!scrollCue) return;
        const scrollable = modalBody.scrollHeight - modalBody.clientHeight > 8;
        modal.classList.toggle("is-scrollable", scrollable);
    };

    const finalizeClose = ({ restoreFocus = true } = {}) => {
        modal.classList.remove("is-open");
        modal.classList.remove("is-ready");
        modal.classList.remove("is-scrollable");
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-modal-open");

        modalTitle.textContent = "";
        modalContent.replaceChildren();
        hero.replaceChildren();

        for (const deck of decks) {
            for (const item of deck.querySelectorAll("[data-deck-card]")) {
                item.classList.remove("is-active");
                item.setAttribute("aria-expanded", "false");
            }
        }
        activeCard = null;

        if (restoreFocus && lastFocus instanceof HTMLElement) lastFocus.focus();
        lastFocus = null;
    };

    const closeModal = (options) => {
        if (modal.hidden) return;
        modalToken += 1;
        window.clearTimeout(readyTimer);
        readyTimer = null;
        activeFlyAnimation?.cancel?.();
        activeFlyAnimation = null;
        modal.classList.remove("is-ready");
        modal.classList.remove("is-open");
        window.clearTimeout(closeTimer);

        if (prefersReducedMotion) {
            finalizeClose(options);
            return;
        }

        closeTimer = window.setTimeout(() => finalizeClose(options), 460);
    };

    const animateCardToModal = (card, heroImage) => {
        if (!card || !heroImage || prefersReducedMotion) return null;

        const cardInner = card.querySelector(".deck-card__inner");
        if (!cardInner || typeof cardInner.animate !== "function") return null;

        const sourceRect = card.getBoundingClientRect();
        const targetRect = heroImage.getBoundingClientRect();
        if (!sourceRect.width || !sourceRect.height || !targetRect.width || !targetRect.height) return null;

        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.left = `${sourceRect.left}px`;
        wrapper.style.top = `${sourceRect.top}px`;
        wrapper.style.width = `${sourceRect.width}px`;
        wrapper.style.height = `${sourceRect.height}px`;
        wrapper.style.zIndex = "130";
        wrapper.style.pointerEvents = "none";
        wrapper.style.perspective = "900px";
        wrapper.style.transformOrigin = "top left";

        const clone = cardInner.cloneNode(true);
        clone.style.width = "100%";
        clone.style.height = "100%";
        clone.style.aspectRatio = "auto";
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        card.classList.add("is-animating");
        heroImage.style.opacity = "0";

        const dx = targetRect.left - sourceRect.left;
        const dy = targetRect.top - sourceRect.top;
        const scaleX = targetRect.width / sourceRect.width;
        const scaleY = targetRect.height / sourceRect.height;

        const easing = "cubic-bezier(0.2, 0.8, 0.2, 1)";
        const duration = 620;

        let flyAnimation = null;
        try {
            flyAnimation = wrapper.animate(
                [
                    { transform: "translate(0px, 0px) scale(1, 1)" },
                    { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})` },
                ],
                { duration, easing, fill: "forwards" },
            );
        } catch (error) {
            wrapper.remove();
            heroImage.style.opacity = "1";
            card.classList.remove("is-animating");
            return null;
        }

        clone.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], {
            duration,
            easing,
            fill: "forwards",
        });

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            wrapper.remove();
            heroImage.style.opacity = "1";
            card.classList.remove("is-animating");
        };

        flyAnimation.onfinish = () => {
            cleanup();
        };

        flyAnimation.oncancel = () => {
            cleanup();
        };

        return flyAnimation;
    };

    const openModal = (card) => {
        if (!card) return;
        modalToken += 1;
        const token = modalToken;
        window.clearTimeout(closeTimer);
        window.clearTimeout(readyTimer);
        readyTimer = null;
        activeFlyAnimation?.cancel?.();
        activeFlyAnimation = null;
        modal.classList.remove("is-ready");
        modal.classList.remove("is-scrollable");

        activeCard = card;
        lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        for (const deck of decks) {
            for (const item of deck.querySelectorAll("[data-deck-card]")) {
                item.classList.toggle("is-active", item === card);
                item.setAttribute("aria-expanded", item === card ? "true" : "false");
            }
        }

        const cardTitle = card.dataset.cardTitle || card.getAttribute("aria-label") || "D\u00e9tail";
        modalTitle.textContent = cardTitle;

        const key = card.dataset.cardKey;
        const sourceImage = card.querySelector(".deck-card__media");
        const sourceSrc = sourceImage?.getAttribute?.("src") || "";
        const sourceBasename = (() => {
            if (!sourceSrc) return "";
            const cleaned = sourceSrc.split("#")[0].split("?")[0];
            const file = cleaned.split("/").pop() || cleaned.split("\\").pop() || "";
            return file ? file.replace(/\.[a-z0-9]+$/i, "") : "";
        })();
        const candidateKeys = Array.from(
            new Set(
                [key, sourceBasename, "debut-voie-pro", "debutcarrierre", "debutcarriere", "carriere", "voiepro", "pro"].filter(
                    (value) => typeof value === "string" && value.trim(),
                ),
            ),
        );

        const template = (() => {
            for (const candidate of candidateKeys) {
                const matches = document.querySelectorAll(`template[data-card-template="${candidate}"]`);
                const tpl = matches.length ? matches[matches.length - 1] : null;
                if (!tpl?.content) continue;
                if (!tpl.content.childNodes.length) continue;
                return tpl;
            }
            return null;
        })();

        modalContent.replaceChildren();
        if (template?.content && template.content.childNodes.length) {
            modalContent.appendChild(template.content.cloneNode(true));
        } else {
            const fallback = document.createElement("p");
            fallback.className = "callout";
            fallback.textContent =
                "Contenu en cours de r\u00e9daction. Ajoute un <template data-card-template=\"" +
                (key || sourceBasename || "") +
                "\">...</template> pour cette carte.";
            modalContent.appendChild(fallback);
        }
        modalBody.scrollTop = 0;

        hero.replaceChildren();
        let heroImage = null;

        if (sourceSrc) {
            heroImage = document.createElement("img");
            heroImage.src = sourceSrc;
            heroImage.alt = cardTitle;
            heroImage.decoding = "async";
            heroImage.loading = "eager";
            hero.appendChild(heroImage);
        }

        const scheduleScrollHintUpdate = () => {
            window.requestAnimationFrame(() => {
                if (token !== modalToken) return;
                updateScrollHint();
            });
        };

        if (scrollCue) {
            for (const img of modalContent.querySelectorAll("img")) {
                if (img.complete) continue;
                img.addEventListener("load", scheduleScrollHintUpdate, { once: true });
                img.addEventListener("error", scheduleScrollHintUpdate, { once: true });
            }
            if (heroImage && !heroImage.complete) {
                heroImage.addEventListener("load", scheduleScrollHintUpdate, { once: true });
                heroImage.addEventListener("error", scheduleScrollHintUpdate, { once: true });
            }
        }

        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-modal-open");

        window.requestAnimationFrame(() => {
            if (token !== modalToken) return;
            modal.classList.add("is-open");
            updateScrollHint();
            if (!heroImage || prefersReducedMotion) {
                modal.classList.add("is-ready");
                updateScrollHint();
                return;
            }

            const animation = animateCardToModal(card, heroImage);
            if (!animation) {
                modal.classList.add("is-ready");
                updateScrollHint();
                return;
            }

            activeFlyAnimation = animation;

            const reveal = () => {
                if (token !== modalToken) return;
                if (modal.hidden) return;
                modal.classList.add("is-ready");
                updateScrollHint();
                activeFlyAnimation = null;
            };

            readyTimer = window.setTimeout(() => {
                if (token !== modalToken) return;
                if (modal.hidden) return;
                modal.classList.add("is-ready");
                updateScrollHint();
            }, 980);

            if (animation.finished && typeof animation.finished.then === "function") {
                animation.finished.catch(() => { }).then(reveal);
            } else {
                reveal();
            }
        });

        closeButton.focus();
    };

    backdrop.addEventListener("click", () => closeModal());
    closeButton.addEventListener("click", () => closeModal());

    modal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeModal();
            return;
        }

        if (event.key !== "Tab") return;
        const focusable = getFocusable();
        if (focusable.length < 2) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;

        if (event.shiftKey && current === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
        }
    });

    for (const deck of decks) {
        for (const card of deck.querySelectorAll("[data-deck-card]")) {
            if (card.dataset.modalBound === "1") continue;
            card.dataset.modalBound = "1";
            card.addEventListener("click", () => openModal(card));
        }
    }
};
