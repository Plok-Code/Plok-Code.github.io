(() => {
  document.documentElement.classList.add("js");
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const formatTime = (value) => {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const whole = Math.floor(value);
    const minutes = Math.floor(whole / 60);
    const seconds = String(whole % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };
  const playerStorageKey = "ina-player-state";
  const storage = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const readStoredPlayerState = () => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(playerStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  };
  const writeStoredPlayerState = (state) => {
    if (!storage) return;
    try {
      storage.setItem(playerStorageKey, JSON.stringify(state));
    } catch {
      // Ignore storage errors.
    }
  };
  const playerGlobalKey = "ina-player-global-enabled";
  const session = (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();
  const isGlobalPlayerEnabled = () => {
    if (!session) return false;
    try {
      return session.getItem(playerGlobalKey) === "1";
    } catch {
      return false;
    }
  };
  const setGlobalPlayerEnabled = (enabled) => {
    if (!session) return;
    try {
      if (enabled) session.setItem(playerGlobalKey, "1");
      else session.removeItem(playerGlobalKey);
    } catch {
      // Ignore storage errors.
    }
  };

  let revealObserver = null;
  let projectObserver = null;
  let projectRailCleanup = null;
  let lightboxReady = false;

  const initReveal = () => {
    revealObserver?.disconnect();
    revealObserver = null;

    const revealElements = document.querySelectorAll(".reveal:not(.reveal-on-load)");
    if (!revealElements.length) return;

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

  const initRevealOnLoad = () => {
    const revealOnLoad = document.querySelectorAll(".reveal-on-load");
    if (!revealOnLoad.length) return;
    const baseDelay = prefersReducedMotion ? 0 : 70;
    revealOnLoad.forEach((element, index) => {
      const delay = prefersReducedMotion ? 0 : baseDelay + index * 90;
      window.setTimeout(() => element.classList.add("is-visible"), delay);
    });
  };

  const initProjectRail = () => {
    projectObserver?.disconnect();
    projectObserver = null;
    projectRailCleanup?.();
    projectRailCleanup = null;

    const rail = document.querySelector("#project-rail");
    const navList = document.querySelector("#project-nav");
    const navCurrent = document.querySelector("#project-nav-current");

    if (!rail || !navList) return;

    const screens = Array.from(rail.querySelectorAll("[data-project-screen]"));
    if (!screens.length) return;

    navList.innerHTML = "";

    const navItems = screens.map((screen) => {
      const label =
        screen.dataset.navLabel ||
        screen.getAttribute("aria-label") ||
        screen.querySelector("h2, h3")?.textContent?.trim() ||
        "Bloc projet";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "project-nav-item";
      button.dataset.target = screen.id;
      button.dataset.label = label;
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
      if (navCurrent && activeItem) navCurrent.textContent = activeItem.dataset.label;
    };

    projectObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;

        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        setActive(visible[0].target.id);
      },
      { root: rail, threshold: [0.55, 0.65] },
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
    projectRailCleanup = () => rail.removeEventListener("keydown", onKeyDown);
  };

  const ensureLightbox = () => {
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

    const image = document.createElement("img");
    image.className = "lightbox__img";
    image.alt = "";
    image.decoding = "async";

    const caption = document.createElement("div");
    caption.className = "lightbox__caption";
    caption.hidden = true;

    panel.append(closeButton, image, caption);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let restoreFocusEl = null;

    const close = () => {
      if (!overlay.classList.contains("is-open")) return;
      overlay.classList.remove("is-open");
      document.body.classList.remove("is-lightbox-open");
      image.src = "";
      image.alt = "";
      caption.hidden = true;
      caption.textContent = "";

      if (restoreFocusEl && typeof restoreFocusEl.focus === "function") restoreFocusEl.focus();
      restoreFocusEl = null;
    };

    const open = (sourceImage) => {
      const src = sourceImage.currentSrc || sourceImage.src;
      if (!src) return;

      restoreFocusEl = document.activeElement;

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

      document.body.classList.add("is-lightbox-open");
      overlay.classList.add("is-open");
      window.setTimeout(() => closeButton.focus(), 0);
    };

    closeButton.addEventListener("click", close);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
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

  const initCardDecks = () => {
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
          animation.finished.catch(() => {}).then(reveal);
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

  const initPageFeatures = () => {
    initReveal();
    initRevealOnLoad();
    initProjectRail();
    ensureLightbox();
    initCardDecks();
  };

  initPageFeatures();

  let players = document.querySelectorAll("[data-player]");
  const rawPlaylist = window.INA_PLAYLIST;
  const playlist = Array.isArray(rawPlaylist) ? rawPlaylist : [];

  const validTracks = playlist.filter(
    (track) => track && typeof track.title === "string" && track.title.trim() && typeof track.src === "string" && track.src.trim(),
  );

  const storedState = readStoredPlayerState();
  const isProfilePage = () => (window.location?.pathname ?? "").endsWith("profil.html");

  const mountSitePlayer = () => {
    if (document.querySelector("[data-site-player]")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "site-player";
    wrapper.setAttribute("data-site-player", "");
    wrapper.innerHTML = `
      <div class="player" data-player>
        <button class="icon-btn" type="button" data-player-toggle aria-label="Lecture" aria-pressed="false">
          <svg class="icon icon--filled" data-icon="play" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8 5v14l11-7z"></path>
          </svg>
          <svg class="icon icon--filled" data-icon="pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 6h2v12H9zM13 6h2v12h-2z"></path>
          </svg>
        </button>
        <button class="icon-btn" type="button" data-player-panel-toggle aria-label="Ouvrir la playlist" aria-expanded="false" aria-controls="player-panel">
          <svg class="icon" data-icon="playlist" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 6h11"></path>
            <path d="M4 12h11"></path>
            <path d="M4 18h11"></path>
            <path d="M18 9v6l3-3z"></path>
          </svg>
        </button>
        <div class="player-panel" id="player-panel" data-player-panel aria-label="Playlist" aria-hidden="true" hidden>
          <p class="muted player-panel__hint">Playlist : ajoutez vos morceaux.</p>
          <div class="player-tracks" data-player-tracks></div>
        </div>
        <audio data-player-audio preload="none"></audio>
      </div>
    `;

    document.body.appendChild(wrapper);
  };

  if (!players.length && isGlobalPlayerEnabled() && !isProfilePage()) {
    mountSitePlayer();
    players = document.querySelectorAll("[data-player]");
  }

  if (players.length) {
    document.body.classList.add("has-site-player");

    let storedStateConsumed = false;

    for (const player of players) {
      const playButton = player.querySelector("[data-player-toggle]");
      const panelButton = player.querySelector("[data-player-panel-toggle]");
      const panel = player.querySelector("[data-player-panel]");
      const tracksRoot = player.querySelector("[data-player-tracks]");
      const hint = player.querySelector(".player-panel__hint");
      const audio = player.querySelector("[data-player-audio]");

      if (!playButton || !panelButton || !panel || !tracksRoot || !audio) continue;

      const initialState = storedStateConsumed ? null : storedState;
      storedStateConsumed = true;

      const inline = document.createElement("div");
      inline.className = "player-inline";

      const transport = document.createElement("div");
      transport.className = "player-transport";

      const prevButton = document.createElement("button");
      prevButton.type = "button";
      prevButton.className = "icon-btn player-btn";
      prevButton.setAttribute("aria-label", "Morceau pr\u00e9c\u00e9dent");
      prevButton.innerHTML = `
        <svg class="icon icon--filled" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 7v10l-7-5z"></path>
          <path d="M19 7v10l-7-5z"></path>
        </svg>
      `;

      const nextButton = document.createElement("button");
      nextButton.type = "button";
      nextButton.className = "icon-btn player-btn";
      nextButton.setAttribute("aria-label", "Morceau suivant");
      nextButton.innerHTML = `
        <svg class="icon icon--filled" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 7v10l7-5z"></path>
          <path d="M12 7v10l7-5z"></path>
        </svg>
      `;

      playButton.classList.add("player-play");
      transport.append(prevButton, playButton, nextButton);

      const info = document.createElement("div");
      info.className = "player-info";
      const titleEl = document.createElement("div");
      titleEl.className = "player-title";
      titleEl.textContent = validTracks.length ? "S\u00e9lectionnez un morceau" : "Ajoutez vos morceaux";
      const statusEl = document.createElement("div");
      statusEl.className = "player-status";
      statusEl.textContent = validTracks.length ? "Pr\u00eat" : "Aucune piste";
      info.append(titleEl, statusEl);

      const progress = document.createElement("div");
      progress.className = "player-progress";
      const currentTimeEl = document.createElement("span");
      currentTimeEl.className = "player-time";
      currentTimeEl.textContent = "0:00";
      const progressInput = document.createElement("input");
      progressInput.type = "range";
      progressInput.className = "player-progress__input";
      progressInput.min = "0";
      progressInput.max = "0";
      progressInput.step = "0.1";
      progressInput.value = "0";
      progressInput.disabled = true;
      progressInput.setAttribute("aria-label", "Position dans le morceau");
      const durationEl = document.createElement("span");
      durationEl.className = "player-time";
      durationEl.textContent = "0:00";
      progress.append(currentTimeEl, progressInput, durationEl);

      const volumeWrap = document.createElement("div");
      volumeWrap.className = "player-volume";
      const volumeButton = document.createElement("button");
      volumeButton.type = "button";
      volumeButton.className = "icon-btn player-volume-btn";
      volumeButton.setAttribute("aria-label", "Activer ou couper le son");
      volumeButton.innerHTML = `
        <svg class="icon" data-icon="volume" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 10v4h3l4 4V6l-4 4z"></path>
          <path d="M17 8a4 4 0 0 1 0 8"></path>
          <path d="M19 5a7 7 0 0 1 0 14"></path>
        </svg>
        <svg class="icon" data-icon="mute" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 10v4h3l4 4V6l-4 4z"></path>
          <path d="M20 9l-4 4"></path>
          <path d="M16 9l4 4"></path>
        </svg>
      `;
      const volumeSlider = document.createElement("input");
      volumeSlider.type = "range";
      volumeSlider.className = "player-volume__slider";
      volumeSlider.min = "0";
      volumeSlider.max = "1";
      volumeSlider.step = "0.01";
      volumeSlider.value = "1";
      volumeSlider.setAttribute("aria-label", "Volume");
      volumeWrap.append(volumeButton, volumeSlider);

      inline.append(transport, info, progress, volumeWrap);
      player.insertBefore(inline, panelButton);

      const globalToggleButton = document.createElement("button");
      globalToggleButton.type = "button";
      globalToggleButton.className = "icon-btn player-global-btn";
      globalToggleButton.innerHTML = `
        <svg class="icon" data-icon="pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 4h6v5l2 3v2H7v-2l2-3z"></path>
          <path d="M12 14v7"></path>
        </svg>
      `;
      player.insertBefore(globalToggleButton, panelButton);

      let activeIndex = -1;
      let panelOpen = false;
      let isSeeking = false;
      let lastPersist = 0;
      let lastNonZeroVolume = clamp(Number(initialState?.volume ?? 1), 0, 1) || 0.7;
      let statusOverride = "";

      const persistState = (overrides = {}, { immediate = false } = {}) => {
        if (!storage) return;
        const now = Date.now();
        if (!immediate && now - lastPersist < 750) return;
        lastPersist = now;
        const payload = {
          trackIndex: activeIndex,
          time: audio.currentTime || 0,
          isPlaying: !audio.paused && !audio.ended,
          volume: audio.volume,
          muted: audio.muted,
          ...overrides,
        };
        writeStoredPlayerState(payload);
      };

      const updateGlobalToggleUI = () => {
        const enabled = isGlobalPlayerEnabled();
        globalToggleButton.classList.toggle("is-active", enabled);
        globalToggleButton.setAttribute("aria-pressed", enabled ? "true" : "false");
        globalToggleButton.setAttribute(
          "aria-label",
          enabled ? "D\u00e9sactiver le lecteur sur les autres pages" : "Activer le lecteur sur les autres pages",
        );
        globalToggleButton.title = enabled ? "Le lecteur est visible sur tout le site" : "Afficher le lecteur sur tout le site";
      };

      const stopPlayback = () => {
        statusOverride = "";
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore seek issues.
        }
        updateProgressUI();
        updatePlayUI();
        persistState({ time: 0, isPlaying: false }, { immediate: true });
      };

      updateGlobalToggleUI();

      globalToggleButton.addEventListener("click", () => {
        const nextEnabled = !isGlobalPlayerEnabled();
        setGlobalPlayerEnabled(nextEnabled);
        updateGlobalToggleUI();

        if (!nextEnabled) {
          if (!isProfilePage()) {
            stopPlayback();
            document.querySelector("[data-site-player]")?.remove();
            document.body.classList.remove("has-site-player");
          }
        }
      });

      const setPanelOpen = (nextOpen) => {
        const shouldOpen = Boolean(nextOpen);
        if (panelOpen === shouldOpen) return;
        panelOpen = shouldOpen;

        if (panelOpen) {
          panel.hidden = false;
          panel.setAttribute("aria-hidden", "false");
          panelButton.setAttribute("aria-expanded", "true");
          panelButton.setAttribute("aria-label", "Fermer la playlist");
          window.requestAnimationFrame(() => panel.classList.add("is-open"));
          return;
        }

        panel.classList.remove("is-open");
        panel.setAttribute("aria-hidden", "true");
        panelButton.setAttribute("aria-expanded", "false");
        panelButton.setAttribute("aria-label", "Ouvrir la playlist");

        if (prefersReducedMotion) {
          panel.hidden = true;
          return;
        }

        panel.addEventListener(
          "transitionend",
          () => {
            if (panelOpen) return;
            panel.hidden = true;
          },
          { once: true },
        );
      };

      const updateVolumeUI = () => {
        const isMuted = audio.muted || audio.volume === 0;
        volumeButton.classList.toggle("is-muted", isMuted);
        volumeButton.setAttribute("aria-pressed", isMuted ? "true" : "false");
        volumeSlider.value = audio.volume.toString();
        const volumePercent = Math.round(audio.volume * 100);
        volumeSlider.style.setProperty("--volume-level", `${volumePercent}%`);
      };

      const updatePlayUI = () => {
        const isPlaying = !audio.paused && !audio.ended;
        const hasTrack = Number.isFinite(activeIndex) && activeIndex >= 0 && Boolean(audio.src);
        playButton.setAttribute("aria-pressed", isPlaying ? "true" : "false");
        playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Lecture");

        if (!validTracks.length) {
          statusEl.textContent = "Aucune piste";
          return;
        }

        if (!hasTrack) {
          statusEl.textContent = "Pr\u00eat";
          return;
        }

        if (audio.ended) {
          statusEl.textContent = "Morceau termin\u00e9";
          return;
        }

        if (statusOverride) {
          statusEl.textContent = statusOverride;
          return;
        }

        statusEl.textContent = isPlaying ? "Lecture en cours" : "En pause";
      };

      const updateProgressUI = () => {
        const hasTrack = Number.isFinite(activeIndex) && activeIndex >= 0 && Boolean(audio.src);
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        if (!hasTrack || duration <= 0) {
          progressInput.disabled = true;
          progressInput.max = "0";
          if (!isSeeking) progressInput.value = "0";
          durationEl.textContent = "0:00";
          progressInput.style.setProperty("--progress", "0%");
        } else {
          progressInput.disabled = false;
          progressInput.max = duration.toString();
          durationEl.textContent = formatTime(duration);
        }

        if (!isSeeking) {
          currentTimeEl.textContent = formatTime(audio.currentTime);
          if (!progressInput.disabled) progressInput.value = audio.currentTime.toString();
        }

        const progressPercent = duration > 0 ? Math.min((audio.currentTime / duration) * 100, 100) : 0;
        progressInput.style.setProperty("--progress", `${progressPercent}%`);
      };

      const highlightActiveTrack = () => {
        for (const el of tracksRoot.querySelectorAll("[data-track-index]")) {
          el.classList.toggle("is-active", Number(el.dataset.trackIndex) === activeIndex);
        }
      };

      const setActiveTrack = async (index, { autoplay = false, resumeTime = null } = {}) => {
        const nextIndex = Number.isFinite(index) ? index : -1;
        if (nextIndex < 0 || nextIndex >= validTracks.length) return null;
        const wasActive = activeIndex === nextIndex && audio.src;
        activeIndex = nextIndex;
        const track = validTracks[activeIndex];

        if (!wasActive) {
          audio.src = track.src;
          titleEl.textContent = track.title;
          progressInput.value = "0";
          progressInput.disabled = true;
          progressInput.style.setProperty("--progress", "0%");
          currentTimeEl.textContent = "0:00";
          durationEl.textContent = "0:00";
        }

        highlightActiveTrack();

        const targetTime = Number.isFinite(resumeTime) ? Math.max(0, resumeTime) : null;
        if (targetTime !== null) {
          const seekAfterMetadata = () => {
            try {
              const duration = Number.isFinite(audio.duration) ? audio.duration : null;
              const safeTime = duration ? Math.min(targetTime, Math.max(duration - 0.25, 0)) : targetTime;
              audio.currentTime = safeTime;
              updateProgressUI();
            } catch {
              // Ignore seek issues.
            }
            audio.removeEventListener("loadedmetadata", seekAfterMetadata);
            audio.removeEventListener("canplay", seekAfterMetadata);
          };

          if (audio.readyState >= 1) seekAfterMetadata();
          else {
            audio.addEventListener("loadedmetadata", seekAfterMetadata);
            audio.addEventListener("canplay", seekAfterMetadata);
          }
        }

        if (autoplay) {
          statusOverride = "Chargement...";
          updatePlayUI();
          try {
            await audio.play();
          } catch {
            statusOverride = "Impossible de lancer la lecture";
          }
        }

        updatePlayUI();
        persistState({ trackIndex: activeIndex, time: audio.currentTime || 0 }, { immediate: true });
        return track;
      };

      const renderTracks = () => {
        tracksRoot.innerHTML = "";

        if (!validTracks.length) {
          if (hint) hint.textContent = "Playlist : ajoutez vos morceaux.";
          return;
        }

        if (hint) hint.textContent = "S\u00e9lectionnez un morceau :";

        validTracks.forEach((track, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "player-track";
          button.dataset.trackIndex = String(index);
          button.textContent = track.title;
          button.addEventListener("click", async () => {
            await setActiveTrack(index, { autoplay: true });
            updatePlayUI();
            setPanelOpen(false);
          });
          tracksRoot.appendChild(button);
        });
      };

      renderTracks();

      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
      panelButton.setAttribute("aria-expanded", "false");

      prevButton.disabled = validTracks.length <= 1;
      nextButton.disabled = validTracks.length <= 1;

      const storedVolume = clamp(Number(initialState?.volume ?? 1), 0, 1);
      const storedMuted = Boolean(initialState?.muted);
      audio.volume = storedVolume;
      volumeSlider.value = storedVolume.toString();
      if (storedMuted && storedVolume > 0) lastNonZeroVolume = storedVolume;
      audio.muted = storedMuted;
      updateVolumeUI();

      if (initialState && Number.isFinite(initialState.trackIndex) && initialState.trackIndex >= 0 && initialState.trackIndex < validTracks.length) {
        void setActiveTrack(initialState.trackIndex, {
          autoplay: Boolean(initialState.isPlaying) && isGlobalPlayerEnabled(),
          resumeTime: Number(initialState.time) || 0,
        });
      } else {
        updatePlayUI();
      }

      playButton.addEventListener("click", async () => {
        if (!validTracks.length) {
          setPanelOpen(true);
          return;
        }

        if (!audio.src) {
          await setActiveTrack(0, { autoplay: true });
          return;
        }

        if (audio.paused || audio.ended) {
          statusOverride = "Chargement...";
          updatePlayUI();
          try {
            await audio.play();
          } catch {
            statusOverride = "Impossible de lancer la lecture";
          }
        } else {
          audio.pause();
        }

        updatePlayUI();
        persistState({}, { immediate: true });
      });

      prevButton.addEventListener("click", async () => {
        if (!validTracks.length) return;
        const baseIndex = activeIndex < 0 ? 0 : activeIndex;
        const nextIndex = baseIndex <= 0 ? validTracks.length - 1 : baseIndex - 1;
        await setActiveTrack(nextIndex, { autoplay: true });
      });

      nextButton.addEventListener("click", async () => {
        if (!validTracks.length) return;
        const baseIndex = activeIndex < 0 ? -1 : activeIndex;
        const nextIndex = baseIndex >= validTracks.length - 1 ? 0 : baseIndex + 1;
        await setActiveTrack(nextIndex, { autoplay: true });
      });

      progressInput.addEventListener("pointerdown", () => {
        if (progressInput.disabled) return;
        isSeeking = true;
      });

      progressInput.addEventListener("pointerup", () => {
        if (progressInput.disabled) return;
        isSeeking = false;
      });

      progressInput.addEventListener("input", () => {
        if (progressInput.disabled) return;
        const nextValue = Number(progressInput.value);
        currentTimeEl.textContent = formatTime(nextValue);
        const maxValue = Number(progressInput.max) || 0;
        const percent = maxValue > 0 ? Math.min((nextValue / maxValue) * 100, 100) : 0;
        progressInput.style.setProperty("--progress", `${percent}%`);
      });

      progressInput.addEventListener("change", () => {
        if (progressInput.disabled) return;
        const nextValue = Number(progressInput.value);
        if (Number.isFinite(nextValue)) audio.currentTime = Math.max(0, nextValue);
        isSeeking = false;
        updateProgressUI();
        persistState({}, { immediate: true });
      });

      volumeSlider.addEventListener("input", () => {
        const value = clamp(Number(volumeSlider.value), 0, 1);
        audio.volume = value;
        if (value > 0) {
          lastNonZeroVolume = value;
          if (audio.muted) audio.muted = false;
        } else {
          audio.muted = true;
        }
        updateVolumeUI();
        persistState({}, { immediate: true });
      });

      volumeButton.addEventListener("click", () => {
        if (audio.muted || audio.volume === 0) {
          audio.muted = false;
          audio.volume = lastNonZeroVolume || 0.7;
        } else {
          audio.muted = true;
        }
        updateVolumeUI();
        persistState({}, { immediate: true });
      });

      panelButton.addEventListener("click", () => setPanelOpen(!panelOpen));

      document.addEventListener(
        "pointerdown",
        (event) => {
          if (!panelOpen) return;
          if (player.contains(event.target)) return;
          setPanelOpen(false);
        },
        { capture: true },
      );

      document.addEventListener("keydown", (event) => {
        if (!panelOpen) return;
        if (event.key !== "Escape") return;
        setPanelOpen(false);
      });

      audio.addEventListener("play", () => {
        updatePlayUI();
        persistState({}, { immediate: true });
      });
      audio.addEventListener("playing", () => {
        statusOverride = "";
        updatePlayUI();
      });
      audio.addEventListener("waiting", () => {
        if (!audio.paused && !audio.ended) {
          statusOverride = "Chargement...";
          updatePlayUI();
        }
      });
      audio.addEventListener("error", () => {
        const code = audio.error?.code;
        if (code === 4) statusOverride = "Fichier introuvable ou format non support\u00e9";
        else statusOverride = "Erreur de lecture";
        updatePlayUI();
      });
      audio.addEventListener("pause", () => {
        statusOverride = "";
        updatePlayUI();
        persistState({}, { immediate: true });
      });
      audio.addEventListener("ended", async () => {
        statusOverride = "";
        updatePlayUI();
        persistState({}, { immediate: true });
        if (!validTracks.length) return;
        const hasNext = activeIndex < validTracks.length - 1;
        const nextIndex = hasNext ? activeIndex + 1 : 0;
        await setActiveTrack(nextIndex, { autoplay: true });
      });
      audio.addEventListener("timeupdate", () => {
        updateProgressUI();
        persistState();
      });
      audio.addEventListener("durationchange", updateProgressUI);
      audio.addEventListener("loadedmetadata", updateProgressUI);
      audio.addEventListener("volumechange", () => {
        updateVolumeUI();
        persistState({}, { immediate: true });
      });
    }
  }

  let pjaxController = null;
  let pjaxNavigationId = 0;

  const replacePage = (nextDoc) => {
    const currentPage = document.querySelector(".page");
    const nextPage = nextDoc.querySelector(".page");
    if (!currentPage || !nextPage) return false;

    nextPage.querySelector("[data-site-player]")?.remove();

    const sitePlayer = document.querySelector("[data-site-player]");
    if (sitePlayer) sitePlayer.remove();

    const adoptedPage = document.importNode(nextPage, true);
    currentPage.replaceWith(adoptedPage);

    if (sitePlayer) document.body.appendChild(sitePlayer);

    document.title = nextDoc.title || document.title;
    initPageFeatures();
    return true;
  };

  const pjaxLoad = async (url) => {
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
    return replacePage(nextDoc);
  };

  const hardNavigate = (href) => {
    window.location.assign(href);
  };

  const canPjaxNavigateTo = (url) => {
    if (!isGlobalPlayerEnabled()) return false;
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.toLowerCase().endsWith(".html")) return false;
    return true;
  };

  const pjaxNavigate = async (href, { updateHistory = true } = {}) => {
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

    try {
      const swapped = await pjaxLoad(cleanUrl.href);
      if (!swapped) return;

      if (updateHistory) history.pushState({ pjax: true }, "", url.href);
    } catch (error) {
      if (error?.name === "AbortError") return;
      hardNavigate(url.href);
      return;
    }

    if (url.hash) {
      const id = url.hash.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
      return;
    }

    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!isGlobalPlayerEnabled()) return;

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
    if (!isGlobalPlayerEnabled()) {
      hardNavigate(window.location.href);
      return;
    }
    void pjaxNavigate(window.location.href, { updateHistory: false });
  });

})();
