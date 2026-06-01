let lightboxReady = false;

export const ensureLightbox = () => {
    if (lightboxReady) return;
    lightboxReady = true;

    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Aper\u00e7u de l'image");
    overlay.setAttribute("data-lightbox-root", "");
    overlay.tabIndex = -1;

    const panel = document.createElement("div");
    panel.className = "lightbox__panel";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "lightbox__close";
    closeButton.setAttribute("aria-label", "Fermer");
    closeButton.textContent = "\u00d7";

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "lightbox__nav lightbox__nav--prev";
    prevButton.setAttribute("aria-label", "Image precedente");
    prevButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7"></path>
        </svg>
    `;

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "lightbox__nav lightbox__nav--next";
    nextButton.setAttribute("aria-label", "Image suivante");
    nextButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 5l7 7-7 7"></path>
        </svg>
    `;

    const image = document.createElement("img");
    image.className = "lightbox__img";
    image.alt = "";
    image.decoding = "async";

    const caption = document.createElement("div");
    caption.className = "lightbox__caption";
    caption.hidden = true;

    panel.append(closeButton, prevButton, nextButton, image, caption);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let restoreFocusEl = null;
    let galleryItems = [];
    let currentIndex = -1;

    const syncNavState = () => {
        const hasGallery = galleryItems.length > 1 && currentIndex >= 0;
        prevButton.hidden = !hasGallery;
        nextButton.hidden = !hasGallery;
    };

    const renderImage = (sourceImage) => {
        const src = sourceImage?.currentSrc || sourceImage?.src;
        if (!src) return;

        image.src = src;
        image.alt = sourceImage.alt || "";

        const rawCaption = (sourceImage.dataset.caption || sourceImage.alt || "").trim();
        if (rawCaption && rawCaption.length <= 160) {
            caption.textContent = rawCaption;
            caption.hidden = false;
        } else {
            caption.hidden = true;
            caption.textContent = "";
        }
    };

    const showImageAt = (index) => {
        if (!galleryItems.length) return;
        currentIndex = (index + galleryItems.length) % galleryItems.length;
        renderImage(galleryItems[currentIndex]);
        syncNavState();
    };

    const close = () => {
        if (!overlay.classList.contains("is-open")) return;
        overlay.classList.remove("is-open");
        document.body.classList.remove("is-lightbox-open");
        image.src = "";
        image.alt = "";
        caption.hidden = true;
        caption.textContent = "";
        galleryItems = [];
        currentIndex = -1;
        syncNavState();

        if (restoreFocusEl && typeof restoreFocusEl.focus === "function") restoreFocusEl.focus();
        restoreFocusEl = null;
    };

    const getGalleryItems = (sourceImage) => {
        const groupRoot = sourceImage.closest("[data-lightbox-gallery]") || sourceImage.closest(".project-showcase");
        if (!groupRoot) return [sourceImage];

        const items = Array.from(groupRoot.querySelectorAll("img[data-lightbox]")).filter((img) => img.src);
        return items.length ? items : [sourceImage];
    };

    const open = (sourceImage) => {
        galleryItems = getGalleryItems(sourceImage);
        const startIndex = Math.max(0, galleryItems.indexOf(sourceImage));
        if (!galleryItems[startIndex]) return;

        restoreFocusEl = document.activeElement;

        document.body.classList.add("is-lightbox-open");
        overlay.classList.add("is-open");
        showImageAt(startIndex);
        window.setTimeout(() => closeButton.focus(), 0);
    };

    const showPrevious = () => showImageAt(currentIndex - 1);
    const showNext = () => showImageAt(currentIndex + 1);

    closeButton.addEventListener("click", close);
    prevButton.addEventListener("click", (event) => {
        event.stopPropagation();
        showPrevious();
    });
    nextButton.addEventListener("click", (event) => {
        event.stopPropagation();
        showNext();
    });

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });

    overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            showPrevious();
            return;
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            showNext();
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();
            closeButton.focus();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        close();
    });

    document.addEventListener("click", (event) => {
        const target = event.target?.closest?.("img[data-lightbox]");
        if (!target) return;
        event.preventDefault();
        open(target);
    });
};
