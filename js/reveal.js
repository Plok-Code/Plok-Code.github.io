import { prefersReducedMotion } from './config.js';

let revealObserver = null;

export const initReveal = () => {
    revealObserver?.disconnect();
    revealObserver = null;

    const revealElements = document.querySelectorAll(".reveal:not(.reveal-on-load)");
    if (!revealElements.length) return;

    const delayGroups = new Map();
    for (const element of revealElements) {
        if (element.dataset.revealDelayBound === "1") continue;
        element.dataset.revealDelayBound = "1";
        element.dataset.revealInit = "1";
        const group = element.closest(".section") || element.closest("main") || document.body;
        const index = delayGroups.get(group) ?? 0;
        delayGroups.set(group, index + 1);
        const delay = prefersReducedMotion ? 0 : Math.min(index, 8) * 110;
        element.style.setProperty("--reveal-delay", `${delay}ms`);
    }

    revealObserver = new IntersectionObserver(
        (entries, observer) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        },
        { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );

    for (const element of revealElements) revealObserver.observe(element);
};

export const initRevealOnLoad = () => {
    const revealOnLoad = document.querySelectorAll(".reveal-on-load");
    if (!revealOnLoad.length) return;
    const baseDelay = prefersReducedMotion ? 0 : 70;
    revealOnLoad.forEach((element, index) => {
        element.dataset.revealInit = "1";
        if (element.dataset.revealDelayBound !== "1") {
            element.dataset.revealDelayBound = "1";
            const staggerDelay = prefersReducedMotion ? 0 : Math.min(index, 6) * 90;
            element.style.setProperty("--reveal-delay", `${staggerDelay}ms`);
        }
        const delay = prefersReducedMotion ? 0 : baseDelay + index * 90;
        window.setTimeout(() => element.classList.add("is-visible"), delay);
    });
};
