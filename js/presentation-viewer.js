const PBIX_HREF = "../assets/documents/Equipe%20RAVI%20_%20TOYS%20and%20MODELS.pbix";
const SOURCE_HREF = "../assets/presentation/toys-models/presentation-toys-models.pdf";
const REPORT_CTA_SLIDE_INDEX = 20; // slide 21 (1-based)
const REPORT_LINK_ZONE = {
    x: 0.58,
    y: 0.84,
    width: 0.38,
    height: 0.12,
};
const SLIDES = Array.from({ length: 23 }, (_, index) => {
    const page = String(index + 1).padStart(2, "0");
    return `../assets/presentation/toys-models/slides-rendered/slide-${page}.png`;
});

const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"]);

const renderViewer = () => `
    <section class="tm-gslide" aria-label="Presentation Toys and Models">
        <div class="tm-gslide__main">
            <div class="tm-gslide__topbar">
                <div class="tm-gslide__meta">
                    <p class="tm-gslide__eyebrow">Toys &amp; Models</p>
                    <h3>Presentation</h3>
                    <p class="tm-gslide__status">
                        <span class="tm-gslide__status-label">Diapositive</span>
                        <input
                            class="tm-gslide__status-input"
                            type="number"
                            min="1"
                            max="${SLIDES.length}"
                            value="1"
                            inputmode="numeric"
                            data-gslide-jump-input
                            aria-label="Aller a la diapositive"
                        >
                        <span class="tm-gslide__status-total">/ ${SLIDES.length}</span>
                    </p>
                </div>

                <div class="tm-gslide__nav">
                    <button class="btn secondary tm-gslide__nav-btn" type="button" data-gslide-prev>
                        <span aria-hidden="true">&larr;</span>
                        <span>Diapositive precedente</span>
                    </button>
                    <button class="btn secondary tm-gslide__nav-btn" type="button" data-gslide-next>
                        <span>Diapositive suivante</span>
                        <span aria-hidden="true">&rarr;</span>
                    </button>
                </div>

                <div class="tm-gslide__actions">
                    <a class="btn secondary btn--sm" href="${SOURCE_HREF}" download>Source (.pdf)</a>
                    <a class="btn primary btn--sm" href="${PBIX_HREF}" download>Power BI (.pbix)</a>
                    <button class="icon-btn" type="button" data-gslide-fullscreen aria-label="Plein ecran" title="Plein ecran">
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M4 9V4h5"></path>
                            <path d="M20 9V4h-5"></path>
                            <path d="M4 15v5h5"></path>
                            <path d="M20 15v5h-5"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="tm-gslide__stage" data-gslide-stage tabindex="0" role="region" aria-label="Diapositives">
                <img class="tm-gslide__image" data-gslide-image src="${SLIDES[0]}" alt="Diapositive 1" loading="eager" decoding="async">
                <div class="tm-gslide__slide-label" data-gslide-slide-label aria-hidden="true">
                    Telecharger le rapport Power BI
                </div>
            </div>
        </div>
    </section>
`;

const clamp = (value) => Math.max(0, Math.min(SLIDES.length - 1, value));

const toggleFullscreen = (target) => {
    if (!(target instanceof HTMLElement)) return;
    if (!document.fullscreenElement) {
        target.requestFullscreen?.();
        return;
    }
    document.exitFullscreen?.();
};

const triggerReportDownload = () => {
    const link = document.createElement("a");
    link.href = PBIX_HREF;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
};

const preloadSlides = () => {
    for (const slide of SLIDES) {
        const image = new Image();
        image.decoding = "async";
        image.src = slide;
    }
};

const initViewer = (container) => {
    if (!(container instanceof HTMLElement)) return;
    if (container.dataset.viewerInit === "1") return;
    container.dataset.viewerInit = "1";

    container.innerHTML = renderViewer();

    const stage = container.querySelector("[data-gslide-stage]");
    const slideImage = container.querySelector("[data-gslide-image]");
    const slideLabel = container.querySelector("[data-gslide-slide-label]");
    const jumpInput = container.querySelector("[data-gslide-jump-input]");
    const prevButton = container.querySelector("[data-gslide-prev]");
    const nextButton = container.querySelector("[data-gslide-next]");
    const fullscreenButton = container.querySelector("[data-gslide-fullscreen]");

    if (
        !(stage instanceof HTMLElement) ||
        !(slideImage instanceof HTMLImageElement) ||
        !(slideLabel instanceof HTMLDivElement) ||
        !(jumpInput instanceof HTMLInputElement) ||
        !(prevButton instanceof HTMLButtonElement) ||
        !(nextButton instanceof HTMLButtonElement)
    ) {
        return;
    }

    let index = 0;

    const positionSlideLabel = () => {
        const stageRect = stage.getBoundingClientRect();
        const imageRect = slideImage.getBoundingClientRect();
        if (!stageRect.width || !stageRect.height || !imageRect.width || !imageRect.height) return;

        const left = imageRect.left - stageRect.left + imageRect.width * REPORT_LINK_ZONE.x;
        const top = imageRect.top - stageRect.top + imageRect.height * REPORT_LINK_ZONE.y;
        const width = imageRect.width * REPORT_LINK_ZONE.width;
        const height = imageRect.height * REPORT_LINK_ZONE.height;

        slideLabel.style.left = `${left}px`;
        slideLabel.style.top = `${top}px`;
        slideLabel.style.width = `${width}px`;
        slideLabel.style.height = `${height}px`;
        slideLabel.style.fontSize = `${Math.max(12, imageRect.width * 0.018)}px`;
    };

    const isInReportLinkZone = (clientX, clientY) => {
        if (index !== REPORT_CTA_SLIDE_INDEX) return false;

        const imageRect = slideImage.getBoundingClientRect();
        if (!imageRect.width || !imageRect.height) return false;

        const left = imageRect.left + imageRect.width * REPORT_LINK_ZONE.x;
        const top = imageRect.top + imageRect.height * REPORT_LINK_ZONE.y;
        const width = imageRect.width * REPORT_LINK_ZONE.width;
        const height = imageRect.height * REPORT_LINK_ZONE.height;

        return clientX >= left && clientX <= left + width && clientY >= top && clientY <= top + height;
    };

    const syncUI = () => {
        slideImage.src = SLIDES[index];
        slideImage.alt = `Diapositive ${index + 1}`;
        jumpInput.value = String(index + 1);
        prevButton.disabled = index <= 0;
        nextButton.disabled = index >= SLIDES.length - 1;
        stage.style.cursor = "";
        slideLabel.classList.toggle("is-active", index === REPORT_CTA_SLIDE_INDEX);
    };

    const goTo = (requestedIndex) => {
        const nextIndex = clamp(requestedIndex);
        if (nextIndex === index) return;
        index = nextIndex;
        syncUI();
    };

    prevButton.addEventListener("click", () => goTo(index - 1));
    nextButton.addEventListener("click", () => goTo(index + 1));
    fullscreenButton?.addEventListener("click", () => toggleFullscreen(stage));
    const submitJump = () => {
        const requestedSlide = Number.parseInt(jumpInput.value, 10);
        if (Number.isNaN(requestedSlide)) {
            jumpInput.value = String(index + 1);
            return;
        }

        goTo(requestedSlide - 1);
    };
    jumpInput.addEventListener("change", submitJump);
    jumpInput.addEventListener("blur", submitJump);
    jumpInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        submitJump();
        stage.focus();
    });
    slideImage.addEventListener("load", positionSlideLabel);
    stage.addEventListener("mousemove", (event) => {
        stage.style.cursor = isInReportLinkZone(event.clientX, event.clientY) ? "pointer" : "";
    });
    stage.addEventListener("mouseleave", () => {
        stage.style.cursor = "";
    });
    window.addEventListener("resize", positionSlideLabel);
    document.addEventListener("fullscreenchange", positionSlideLabel);
    stage.addEventListener("click", (event) => {
        if (isInReportLinkZone(event.clientX, event.clientY)) {
            triggerReportDownload();
            return;
        }

        const rect = stage.getBoundingClientRect();
        if (!rect.width) return;

        const clickX = event.clientX - rect.left;
        if (clickX < rect.width / 2) {
            goTo(index - 1);
            return;
        }

        goTo(index + 1);
    });

    stage.addEventListener("keydown", (event) => {
        if (!NAV_KEYS.has(event.key)) return;
        event.preventDefault();

        if (event.key === "Home") {
            goTo(0);
            return;
        }

        if (event.key === "End") {
            goTo(SLIDES.length - 1);
            return;
        }

        goTo(index + (event.key === "ArrowLeft" || event.key === "PageUp" ? -1 : 1));
    });

    syncUI();
    preloadSlides();
};

export const initPresentationViewers = () => {
    const containers = document.querySelectorAll('[data-presentation-viewer="toys-models"]');
    if (!containers.length) return;

    containers.forEach((container) => initViewer(container));
};
