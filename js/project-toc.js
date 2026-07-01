// Sommaire ancrable des pages projet : surligne le lien de la section
// actuellement visible. Rejoue a chaque navigation PJAX via initPageFeatures.
let tocObserver = null;

export const initProjectToc = () => {
    if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }
    const links = Array.prototype.slice.call(
        document.querySelectorAll('.proj-doc__toc a[href^="#"]')
    );
    if (!links.length || !('IntersectionObserver' in window)) return;

    const map = {};
    links.forEach((a) => {
        const t = document.getElementById(decodeURIComponent(a.hash.slice(1)));
        if (t) map[t.id] = a;
    });

    tocObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                links.forEach((l) => l.classList.remove('is-active'));
                if (map[e.target.id]) map[e.target.id].classList.add('is-active');
            }
        });
    }, { rootMargin: '-96px 0px -65% 0px', threshold: 0 });

    Object.keys(map).forEach((id) => {
        const t = document.getElementById(id);
        if (t) tocObserver.observe(t);
    });
};
