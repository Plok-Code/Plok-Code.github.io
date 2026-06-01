import { prefersReducedMotion } from './config.js';

let pjaxController = null;
let pjaxNavigationId = 0;
const FADE_OUT_MS = 320;
const FADE_IN_MS = 480;

// Need a callback system or similar to re-init components after load
// We will export a variable that the main.js can set
export let initPageFeatures = () => { };
export const setInitPageFeatures = (fn) => { initPageFeatures = fn; };

export const replacePage = (nextDoc, newUrlHref) => {
    const currentPage = document.querySelector(".page");
    const nextPage = nextDoc.querySelector(".page");
    if (!currentPage || !nextPage) return false;

    // Resolve relative paths globally based on the new injected content
    // This allows nested PJAX (/pages/projet.html) to navigate back and forth securely.
    // We rewrite src/href that belong to our domain as absolute paths from the root
    if (newUrlHref) {
        // We compute the true absolute URL of a resource relative to the *new* page,
        // then back-calculate what that relative path should be from the *current* page's perspective.
        const resolveRelative = (attr) => {
            if (!attr || attr.startsWith('data:') || attr.startsWith('http') || attr.startsWith('#') || attr.startsWith('mailto:')) return attr;
            // 1. Get the true absolute URL of the requested resource as if we were on the new page
            const absoluteResourceUrl = new URL(attr, newUrlHref);
            // 2. Set the element to that absolute path
            return absoluteResourceUrl.pathname;
        };

        const elementsWithSrc = nextPage.querySelectorAll('[src]');
        for (const el of elementsWithSrc) {
            el.setAttribute('src', resolveRelative(el.getAttribute('src')));
        }

        const elementsWithHref = nextPage.querySelectorAll('[href]');
        for (const el of elementsWithHref) {
            el.setAttribute('href', resolveRelative(el.getAttribute('href')));
        }
    }

    const adoptedPage = document.importNode(nextPage, true);
    currentPage.replaceWith(adoptedPage);

    document.title = nextDoc.title || document.title;
    initPageFeatures();
    return true;
};

export const pjaxLoad = async (url) => {
    const navigationId = ++pjaxNavigationId;
    pjaxController?.abort();
    const controller = new AbortController();
    pjaxController = controller;

    const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let html = "";
    if (window.TextDecoder) {
        const buffer = await response.arrayBuffer();
        html = new TextDecoder("utf-8").decode(buffer);
    } else {
        html = await response.text();
    }
    if (navigationId !== pjaxNavigationId) return false;

    const nextDoc = new DOMParser().parseFromString(html, "text/html");
    return replacePage(nextDoc, url);
};

export const hardNavigate = (href) => {
    window.location.assign(href);
};

export const canPjaxNavigateTo = (url) => {
    // PJAX actif sur tous les liens internes en .html.
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.toLowerCase().endsWith(".html")) return false;
    return true;
};

export const pjaxNavigate = async (href, { updateHistory = true } = {}) => {
    const url = new URL(href, window.location.href);

    if (!canPjaxNavigateTo(url)) {
        hardNavigate(url.href);
        return;
    }

    const current = new URL(window.location.href);
    if (url.pathname === current.pathname && url.search === current.search && url.hash) {
        hardNavigate(url.href);
        return;
    }

    const cleanUrl = new URL(url.href);
    cleanUrl.hash = "";

    // === FONDU ENCHAINE FLUIDE ============================
    // Marque le body en amont : desactive les cascades enfant pour
    // que toute la nouvelle page apparaisse EN BLOC (pas de stagger
    // qui parasiterait l'effet).
    document.body.classList.add('is-pjax-loaded');

    const currentPage = document.querySelector('.page');

    // === FADE OUT : 320ms, opacity 1->0 + translateY 0->8px =======
    if (!prefersReducedMotion && currentPage) {
        try {
            await currentPage.animate([
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: 'translateY(8px)' }
            ], {
                duration: FADE_OUT_MS,
                easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
                fill: 'forwards'
            }).finished;
        } catch (_e) { /* anim cancelled */ }
    }

    try {
        const swapped = await pjaxLoad(cleanUrl.href);
        if (!swapped) {
            const cp = document.querySelector('.page');
            if (cp) cp.style.opacity = '1';
            hardNavigate(url.href);
            return;
        }
        if (updateHistory) history.pushState({ pjax: true }, "", url.href);
    } catch (error) {
        const cp = document.querySelector('.page');
        if (cp) cp.style.opacity = '1';
        if (error?.name === "AbortError") return;
        hardNavigate(url.href);
        return;
    }

    // === FADE IN : CRUCIAL pour eviter le flash ===================
    // On force opacity:0 SUR LE NOUVEAU .page IMMEDIATEMENT (avant
    // tout repaint), sinon il s'affiche brievement a opacity:1 puis
    // saute a 0 quand l'animation demarre. La sequence :
    //   1. forced reflow -> commit l'inline opacity:0
    //   2. scroll to top (invisible donc indolore)
    //   3. animate 0 -> 1 sur 480ms
    //   4. cleanup l'inline style en fin d'anim
    const newPage = document.querySelector('.page');
    if (newPage) {
        if (!prefersReducedMotion) {
            newPage.style.opacity = '0';
            newPage.style.transform = 'translateY(-8px)';
            void newPage.offsetWidth; // force reflow
        }

        if (url.hash) {
            const id = url.hash.slice(1);
            const target = id ? document.getElementById(id) : null;
            if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
            else window.scrollTo({ top: 0, behavior: 'auto' });
        } else {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }

        if (!prefersReducedMotion) {
            const anim = newPage.animate([
                { opacity: 0, transform: 'translateY(-8px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], {
                duration: FADE_IN_MS,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards'
            });
            anim.finished.finally(() => {
                newPage.style.opacity = '';
                newPage.style.transform = '';
            });
        }
    }
};

export const setupPjax = () => {
    document.addEventListener(
        "click",
        (event) => {
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const anchor = event.target?.closest?.("a[href]");
            if (!anchor) return;
            if (anchor.target && anchor.target !== "_self") return;
            if (anchor.hasAttribute("download")) return;
            if (anchor.dataset.pjax === "off") return;

            const href = anchor.getAttribute("href");
            if (!href) return;
            if (href.startsWith("#")) return;

            const url = new URL(href, window.location.href);
            if (!canPjaxNavigateTo(url)) return;

            event.preventDefault();
            void pjaxNavigate(url.href);
        },
        { capture: true },
    );

    window.addEventListener("popstate", () => {
        void pjaxNavigate(window.location.href, { updateHistory: false });
    });
};
