import { prefersReducedMotion } from "./config.js";

const focusableSelector =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const getFocusable = (root) =>
    Array.from(root.querySelectorAll(focusableSelector)).filter((element) => {
        if (element.hidden) return false;
        const style = window.getComputedStyle(element);
        return style.visibility !== "hidden" && style.display !== "none";
    });

export const initBriefModals = () => {
    const modals = document.querySelectorAll("[data-brief-modal]");
    if (!modals.length) return;

    for (const modal of modals) {
        if (modal.dataset.briefModalInit === "1") continue;

        const key = modal.dataset.briefModal;
        const openButtons = Array.from(document.querySelectorAll("[data-brief-open]")).filter(
            (button) => button.dataset.briefOpen === key,
        );
        const backdrop = modal.querySelector("[data-brief-modal-backdrop]");
        const panel = modal.querySelector("[data-brief-modal-panel]");
        const closeButton = modal.querySelector("[data-brief-modal-close]");
        const modalBody = modal.querySelector(".deck-modal__body");

        if (!key || !openButtons.length || !backdrop || !panel || !closeButton || !modalBody) continue;
        modal.dataset.briefModalInit = "1";

        let closeTimer = null;
        let lastFocus = null;

        const syncTriggerState = (isOpen) => {
            for (const button of openButtons) {
                button.setAttribute("aria-expanded", isOpen ? "true" : "false");
            }
        };

        const updateScrollHint = () => {
            const isScrollable = modalBody.scrollHeight - modalBody.clientHeight > 8;
            modal.classList.toggle("is-scrollable", isScrollable);
        };

        const finalizeClose = ({ restoreFocus = true } = {}) => {
            modal.hidden = true;
            modal.setAttribute("aria-hidden", "true");
            modal.classList.remove("is-open");
            modal.classList.remove("is-scrollable");
            document.body.classList.remove("is-modal-open");
            syncTriggerState(false);

            if (restoreFocus && lastFocus instanceof HTMLElement) {
                lastFocus.focus();
            }
            lastFocus = null;
        };

        const closeModal = (options = {}) => {
            if (modal.hidden) return;

            window.clearTimeout(closeTimer);
            modal.classList.remove("is-open");
            modal.classList.remove("is-scrollable");

            if (prefersReducedMotion) {
                finalizeClose(options);
                return;
            }

            closeTimer = window.setTimeout(() => finalizeClose(options), 360);
        };

        const openModal = (trigger) => {
            window.clearTimeout(closeTimer);
            lastFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;

            modal.hidden = false;
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("is-modal-open");
            modalBody.scrollTop = 0;
            syncTriggerState(true);

            window.requestAnimationFrame(() => {
                modal.classList.add("is-open");
                updateScrollHint();
                const focusTarget = getFocusable(panel)[0] || panel;
                focusTarget.focus();
            });
        };

        const handleKeydown = (event) => {
            if (modal.hidden) return;

            if (event.key === "Escape") {
                event.preventDefault();
                closeModal();
                return;
            }

            if (event.key !== "Tab") return;

            const focusable = getFocusable(panel);
            if (!focusable.length) {
                event.preventDefault();
                panel.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        for (const button of openButtons) {
            button.addEventListener("click", () => openModal(button));
        }

        for (const image of modalBody.querySelectorAll("img")) {
            if (image.complete) continue;
            image.addEventListener("load", updateScrollHint, { once: true });
            image.addEventListener("error", updateScrollHint, { once: true });
        }

        closeButton.addEventListener("click", () => closeModal());
        backdrop.addEventListener("click", () => closeModal());
        modal.addEventListener("keydown", handleKeydown);
        window.addEventListener("resize", updateScrollHint);
    }
};
