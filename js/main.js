import { initSparks } from './sparks.js';
import { initReveal, initRevealOnLoad } from './reveal.js';
import { ensureLightbox } from './lightbox.js';
import { initProjectRail } from './project-rail.js';
import { initCardDecks } from './decks.js';
import { initProfileFilter } from './profile-filter.js';
import { initProfileDetail } from './profile-detail.js';
import { initProfileCinema } from './profile-cinema.js';
import { initProjectsCinema } from './projects-cinema.js';
import { initThemeSwitcher } from './theme-switcher.js';
import { initBriefModals } from './brief-modal.js';
import { initContactForms } from './contact.js';
import { initPresentationViewers } from './presentation-viewer.js';
import { setupPjax, setInitPageFeatures, hardNavigate } from './pjax.js';
import { initMagnetic } from './magnetic.js';

document.documentElement.classList.add("js");

const initPageFeatures = () => {
    initReveal();
    initRevealOnLoad();
    initProjectRail();
    ensureLightbox();
    initCardDecks();
    initProfileFilter();
    initProfileDetail();
    initProfileCinema();
    initProjectsCinema();
    initThemeSwitcher();
    initBriefModals();
    initContactForms();
    initPresentationViewers();
    initMagnetic();
};

// Set pjax callback
setInitPageFeatures(initPageFeatures);

const initGlobals = () => {
    initSparks();
    setupPjax();
};

// View Transitions re-init (Astro / Navigation API)
document.addEventListener("astro:after-swap", () => {
    initPageFeatures();
});

// Kickoff
initPageFeatures();
initGlobals();
