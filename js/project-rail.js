import { prefersReducedMotion } from './config.js';

let projectObserver = null;
let projectRailCleanup = null;

export const initProjectRail = () => {
    projectObserver?.disconnect();
    projectObserver = null;
    projectRailCleanup?.();
    projectRailCleanup = null;

    const rail = document.querySelector("#project-rail");
    const navList = document.querySelector("#project-nav");
    const navCurrent = document.querySelector("#project-nav-current");

    if (!rail || !navList) return;

    const navMenu = navList.closest("details");
    const mobileMenuMedia = window.matchMedia?.("(max-width: 820px)") ?? null;
    const syncNavMenu = () => {
        if (!navMenu || !mobileMenuMedia) return;
        navMenu.open = !mobileMenuMedia.matches;
    };
    syncNavMenu();
    if (navMenu && mobileMenuMedia) {
        if (typeof mobileMenuMedia.addEventListener === "function") mobileMenuMedia.addEventListener("change", syncNavMenu);
        else if (typeof mobileMenuMedia.addListener === "function") mobileMenuMedia.addListener(syncNavMenu);
    }

    const getScreenGroup = (screen) => screen.dataset.navGroup || "other";

    const rawScreens = Array.from(rail.querySelectorAll("[data-project-screen]"));
    if (!rawScreens.length) return;

    const groupRank = {
        ia: 0,
        data: 1,
        "automation-backend": 2,
        other: 3,
    };
    const screens = rawScreens
        .map((screen, index) => ({ screen, index, group: getScreenGroup(screen) }))
        .sort((a, b) => (groupRank[a.group] - groupRank[b.group]) || (a.index - b.index))
        .map((entry) => entry.screen);

    // Keep project groups together in the rail and nav.
    for (const screen of screens) rail.appendChild(screen);

    navList.innerHTML = "";

    const getGroupLabel = (group) => {
        if (group === "automation-backend") return "Automation / Backend";
        if (group === "ia") return "IA";
        if (group === "data") return "Data / Analytics";
        return "Autres projets";
    };
    let previousGroup = null;

    const navItems = screens.map((screen) => {
        const label =
            screen.dataset.navLabel ||
            screen.getAttribute("aria-label") ||
            screen.querySelector("h2, h3")?.textContent?.trim() ||
            "Bloc projet";
        const group = getScreenGroup(screen);

        if (previousGroup !== group) {
            const separator = document.createElement("div");
            separator.className = "project-nav-separator";
            separator.setAttribute("role", "separator");
            separator.setAttribute("aria-label", `Séparation: ${getGroupLabel(group)}`);

            const separatorLabel = document.createElement("span");
            separatorLabel.className = "project-nav-separator__label";
            separatorLabel.textContent = getGroupLabel(group);
            separator.append(separatorLabel);

            navList.appendChild(separator);
        }
        previousGroup = group;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "project-nav-item";
        button.dataset.target = screen.id;
        button.dataset.label = label;
        button.dataset.group = group;
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-controls", screen.id);

        const dot = document.createElement("span");
        dot.className = "project-dot";
        dot.setAttribute("aria-hidden", "true");

        const title = document.createElement("span");
        title.className = "project-nav-title";
        title.textContent = label;

        button.append(dot, title);

        button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.target);
            if (!target) return;

            target.scrollIntoView({
                behavior: prefersReducedMotion ? "auto" : "smooth",
                block: "start",
            });

            if (navMenu && mobileMenuMedia?.matches) navMenu.open = false;
        });

        navList.appendChild(button);
        return button;
    });

    let activeId = "";
    const setActive = (id) => {
        if (!id || id === activeId) return;
        activeId = id;

        for (const button of navItems) {
            const isActive = button.dataset.target === id;
            button.classList.toggle("is-active", isActive);
            if (isActive) button.setAttribute("aria-current", "true");
            else button.removeAttribute("aria-current");
        }

        for (const screen of screens) {
            screen.classList.toggle("is-active", screen.id === id);
        }

        const activeItem = navItems.find((button) => button.dataset.target === id);
        // Note : on n'emet plus de sparks au scroll : c'etait visuellement
        // bruyant. Le focus visuel passe maintenant par le rail vertical
        // gauche + sibling dim + scale + glow doux de l'image (CSS pur).
    };

    const intersections = new Map();
    projectObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) intersections.set(entry.target.id, entry);

            const visible = [];
            for (const screen of screens) {
                const latest = intersections.get(screen.id);
                if (!latest?.isIntersecting) continue;
                visible.push(latest);
            }
            if (!visible.length) return;

            visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            setActive(visible[0].target.id);
        },
        (() => {
            const styles = window.getComputedStyle(rail);
            const overflowY = styles.overflowY;
            const usesInternalScroll =
                (overflowY === "auto" || overflowY === "scroll") && rail.scrollHeight > rail.clientHeight + 1;
            const thresholds = usesInternalScroll ? [0.55, 0.65] : [0.15, 0.25, 0.35, 0.45, 0.55];
            return usesInternalScroll ? { root: rail, threshold: thresholds } : { threshold: thresholds };
        })(),
    );

    for (const screen of screens) projectObserver.observe(screen);

    setActive(screens[0]?.id);

    const onKeyDown = (event) => {
        const keys = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"];
        if (!keys.includes(event.key)) return;

        const currentIndex = screens.findIndex((screen) => screen.id === activeId);
        if (currentIndex < 0) return;

        let nextIndex = currentIndex;
        if (event.key === "ArrowDown" || event.key === "PageDown") nextIndex = Math.min(screens.length - 1, currentIndex + 1);
        if (event.key === "ArrowUp" || event.key === "PageUp") nextIndex = Math.max(0, currentIndex - 1);
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = screens.length - 1;

        if (nextIndex === currentIndex) return;

        event.preventDefault();
        screens[nextIndex].scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
        });
    };

    rail.addEventListener("keydown", onKeyDown);

    projectRailCleanup = () => {
        rail.removeEventListener("keydown", onKeyDown);
        if (navMenu && mobileMenuMedia) {
            if (typeof mobileMenuMedia.removeEventListener === "function") {
                mobileMenuMedia.removeEventListener("change", syncNavMenu);
            } else if (typeof mobileMenuMedia.removeListener === "function") {
                mobileMenuMedia.removeListener(syncNavMenu);
            }
        }
    };
};
