(() => {
  document.documentElement.classList.add("js");
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  /* --- SPARK FX SYSTEM (Re-Enabled) --- */
  const createSpark = (x, y) => {
    if (prefersReducedMotion) return;
    const count = 6 + Math.random() * 4;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("div");
      spark.className = "fx-spark";
      const angle = Math.random() * Math.PI * 2;
      const velocity = 20 + Math.random() * 40;
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.setProperty("--tx", `${Math.cos(angle) * velocity}px`);
      spark.style.setProperty("--ty", `${Math.sin(angle) * velocity}px`);
      spark.style.backgroundColor = ["#FFF", "#FFB74D", "#00BCD4"][Math.floor(Math.random() * 3)];
      document.body.appendChild(spark);
      spark.addEventListener("animationend", () => spark.remove());
    }
  };
  document.addEventListener("click", (e) => createSpark(e.clientX, e.clientY));
  /* ----------------------- */

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
  const isGlobalPlayerEnabled = () => {
    if (!storage) return false;
    try {
      return storage.getItem(playerGlobalKey) === "1";
    } catch {
      return false;
    }
  };
  const setGlobalPlayerEnabled = (enabled) => {
    if (!storage) return;
    try {
      if (enabled) storage.setItem(playerGlobalKey, "1");
      else storage.removeItem(playerGlobalKey);
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

    const delayGroups = new Map();
    for (const element of revealElements) {
      if (element.dataset.revealDelayBound === "1") continue;
      element.dataset.revealDelayBound = "1";
      const group = element.closest(".section") || element.closest("main") || document.body;
      const index = delayGroups.get(group) ?? 0;
      delayGroups.set(group, index + 1);
      const delay = prefersReducedMotion ? 0 : Math.min(index, 6) * 90;
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

  const initRevealOnLoad = () => {
    const revealOnLoad = document.querySelectorAll(".reveal-on-load");
    if (!revealOnLoad.length) return;
    const baseDelay = prefersReducedMotion ? 0 : 70;
    revealOnLoad.forEach((element, index) => {
      if (element.dataset.revealDelayBound !== "1") {
        element.dataset.revealDelayBound = "1";
        const staggerDelay = prefersReducedMotion ? 0 : Math.min(index, 6) * 90;
        element.style.setProperty("--reveal-delay", `${staggerDelay}ms`);
      }
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
      if (navCurrent && activeItem) navCurrent.textContent = activeItem.dataset.label;
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

  const initContactForms = () => {
    const forms = document.querySelectorAll("[data-contact-form]");
    if (!forms.length) return;

    const ensureRecaptchaApi = (() => {
      let promise = null;
      return () => {
        if (window.grecaptcha?.render && window.grecaptcha?.getResponse) {
          return Promise.resolve(window.grecaptcha);
        }

        if (promise) return promise;

        promise = new Promise((resolve, reject) => {
          const existing = document.querySelector("script[data-ina-recaptcha]");
          if (existing) {
            existing.addEventListener("load", () => resolve(window.grecaptcha), { once: true });
            existing.addEventListener("error", () => reject(new Error("reCAPTCHA failed to load")), { once: true });
            return;
          }

          const script = document.createElement("script");
          script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
          script.async = true;
          script.defer = true;
          script.dataset.inaRecaptcha = "1";
          script.addEventListener("load", () => resolve(window.grecaptcha), { once: true });
          script.addEventListener("error", () => reject(new Error("reCAPTCHA failed to load")), { once: true });
          document.head.appendChild(script);
        }).then((grecaptcha) => {
          if (grecaptcha?.render && grecaptcha?.getResponse) return grecaptcha;
          throw new Error("reCAPTCHA unavailable");
        });

        return promise;
      };
    })();

    const globalEmailJs = (() => {
      const cfg = window.INA_SITE_CONFIG?.contact?.emailjs;
      if (!cfg) return null;
      return {
        publicKey: String(cfg.publicKey || "").trim(),
        serviceId: String(cfg.serviceId || "").trim(),
        templateId: String(cfg.templateId || "").trim(),
        toEmail: String(cfg.toEmail || "").trim(),
        toName: String(cfg.toName || "").trim(),
      };
    })();

    const buildMailtoHref = (toEmail, subject, body) => {
      const params = [];
      if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      return `mailto:${toEmail}${params.length ? `?${params.join("&")}` : ""}`;
    };

    const copyToClipboard = async (text) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // Ignore clipboard failures.
      }
      return false;
    };

    const normalizeEmailJsErrorText = (error) => {
      const raw = String(error?.details || error?.message || "").trim();
      if (!raw) return "";

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const value = parsed.message || parsed.text || parsed.error || raw;
          return String(value || "").trim();
        }
      } catch {
        // Ignore parse errors.
      }

      return raw;
    };

    const truncate = (text, limit) => {
      const value = String(text || "").trim();
      if (!value) return "";
      if (value.length <= limit) return value;
      return `${value.slice(0, limit - 1)}…`;
    };

    const formatEmailJsTroubleshooting = (details) => {
      const message = String(details || "").trim();
      const lower = message.toLowerCase();
      const protocol = String(window.location?.protocol || "").toLowerCase();

      if (protocol === "file:") {
        return "Ouvre le site via http(s) (Live Server / GitHub Pages) : EmailJS bloque l’envoi depuis un fichier local.";
      }

      if (lower.includes("api calls are disabled for non-browser applications")) {
        return "EmailJS bloque les envois hors navigateur (scripts, certains environnements). Teste depuis ton site en ligne ou un serveur local.";
      }

      if (lower.includes("insufficient authentication scopes") || lower.includes("gmail_api")) {
        return "Ton service Gmail EmailJS n’est pas correctement autorisé : va dans EmailJS → Email Services, reconnecte Gmail, puis accepte les permissions.";
      }

      if (lower.includes("origin") && (lower.includes("not allowed") || lower.includes("forbidden"))) {
        return "Le domaine/origine est refusé par EmailJS. Vérifie que tu testes bien depuis l’URL du site (pas un fichier local) et la sécurité EmailJS.";
      }

      if (lower.includes("service") && lower.includes("not found")) {
        return "Service EmailJS introuvable : vérifie `service_id` dans `contact.html`.";
      }

      if (lower.includes("template") && lower.includes("not found")) {
        return "Template EmailJS introuvable : vérifie `template_id` dans `contact.html`.";
      }

      if (lower.includes("public key") || lower.includes("user_id") || lower.includes("invalid user")) {
        return "Clé EmailJS invalide : vérifie la Public Key dans `contact.html`.";
      }

      return "EmailJS a refusé l’envoi : vérifie la configuration du service + du template (destinataire, champs) et réessaie.";
    };

    const sendViaEmailJs = async ({ serviceId, templateId, publicKey, templateParams }) => {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: templateParams,
        }),
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        const error = new Error(details || `HTTP ${response.status}`);
        error.details = details;
        error.status = response.status;
        throw error;
      }
    };

    for (const form of forms) {
      if (!(form instanceof HTMLFormElement)) continue;
      if (form.dataset.contactFormBound === "1") continue;
      form.dataset.contactFormBound = "1";

      const statusEl = form.querySelector("[data-contact-form-status]");
      const setStatus = (message, { actionHref = "", actionLabel = "" } = {}) => {
        if (!statusEl) return;
        statusEl.textContent = "";
        const textSpan = document.createElement("span");
        textSpan.textContent = message;
        statusEl.append(textSpan);

        if (!actionHref) return;
        const link = document.createElement("a");
        link.href = actionHref;
        link.textContent = actionLabel || actionHref;
        link.rel = "noreferrer";
        statusEl.append(" ", link);
      };

      const recaptchaSiteKey = (form.dataset.recaptchaSiteKey || "").trim();
      const captchaWrap = form.querySelector("[data-contact-captcha]");
      const captchaRoot = form.querySelector("[data-contact-recaptcha]");
      let recaptchaWidgetId = null;

      const updateCaptchaScale = () => {
        if (!(captchaWrap instanceof HTMLElement)) return;
        const container = form.closest(".contact-panel") || form;
        const available = Math.max(0, (container instanceof HTMLElement ? container.clientWidth : form.clientWidth) - 24);
        const scale = Math.max(0.65, Math.min(1, available / 304));
        captchaWrap.style.setProperty("--captcha-scale", scale.toFixed(3));
      };

      const mountRecaptcha = async () => {
        if (!recaptchaSiteKey) return;
        if (!(captchaWrap instanceof HTMLElement) || !(captchaRoot instanceof HTMLElement)) return;
        if (form.dataset.recaptchaBound === "1") return;
        form.dataset.recaptchaBound = "1";
        delete form.dataset.recaptchaUnavailable;

        captchaWrap.hidden = false;
        captchaWrap.setAttribute("aria-hidden", "false");
        updateCaptchaScale();

        try {
          const grecaptcha = await ensureRecaptchaApi();
          captchaRoot.textContent = "";
          recaptchaWidgetId = grecaptcha.render(captchaRoot, { sitekey: recaptchaSiteKey, theme: "dark" });
          form.dataset.recaptchaWidgetId = String(recaptchaWidgetId);
          updateCaptchaScale();
        } catch (error) {
          console.warn("reCAPTCHA init failed:", error);
          form.dataset.recaptchaUnavailable = "1";
          captchaWrap.hidden = true;
          captchaWrap.setAttribute("aria-hidden", "true");
        }
      };

      void mountRecaptcha();

      if (typeof window.ResizeObserver === "function" && captchaWrap instanceof HTMLElement) {
        const ro = new ResizeObserver(() => updateCaptchaScale());
        ro.observe(form);
      } else {
        window.addEventListener("resize", updateCaptchaScale, { passive: true });
      }

      const submitButton = form.querySelector('button[type="submit"]');
      const setBusy = (busy) => {
        form.dataset.contactSending = busy ? "1" : "";
        form.setAttribute("aria-busy", busy ? "true" : "false");
        if (submitButton instanceof HTMLButtonElement) submitButton.disabled = busy;
      };

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (form.dataset.contactSending === "1") return;

        setBusy(true);
        setStatus("Envoi en cours…");

        if (String(window.location?.protocol || "").toLowerCase() === "file:") {
          setStatus("Ouvre le site via http(s) (Live Server / GitHub Pages) pour envoyer un message.");
          setBusy(false);
          return;
        }

        if (typeof form.checkValidity === "function" && !form.checkValidity()) {
          form.reportValidity?.();
          setStatus("Merci de compléter les champs requis.");
          setBusy(false);
          return;
        }

        const data = new FormData(form);
        const honeypotValue = String(data.get("website") || data.get("_honey") || "").trim();
        if (honeypotValue) {
          setStatus("Message envoyé. Merci !");
          form.reset();
          setBusy(false);
          return;
        }

        try {
          const cooldownMs = 60_000;
          const now = Date.now();
          const lastSent = Number(window.localStorage?.getItem("ina_contact_last_sent") || "0");
          if (Number.isFinite(lastSent) && lastSent > 0 && now - lastSent < cooldownMs) {
            setStatus("Merci de patienter un peu avant de renvoyer un message.");
            setBusy(false);
            return;
          }
        } catch {
          // Ignore storage failures.
        }

        const fromName = String(data.get("name") || "").trim();
        const replyTo = String(data.get("email") || "").trim();
        const rawSubject = String(data.get("subject") || "").trim();
        const subject = rawSubject || `Message depuis le site${fromName ? ` — ${fromName}` : ""}`;
        const message = String(data.get("message") || "").trim();
        const toEmail = (form.dataset.contactToEmail || globalEmailJs?.toEmail || "").trim();
        const toName = (globalEmailJs?.toName || "").trim();

        const mailBody = [
          `Nom : ${fromName || "-"}`,
          `Email : ${replyTo || "-"}`,
          `Sujet : ${subject || "-"}`,
          "",
          message || "",
          "",
          `Envoyé depuis : ${window.location.href}`,
        ].join("\n");

        const mailtoHref = toEmail ? buildMailtoHref(toEmail, subject, mailBody) : "";

        const isPlaceholder = (value) => !value || /^YOUR_|CHANGE_ME/i.test(value);
        const provider = (form.dataset.contactProvider || "").trim().toLowerCase();
        const serviceId = (form.dataset.emailjsServiceId || globalEmailJs?.serviceId || "").trim();
        const templateId = (form.dataset.emailjsTemplateId || globalEmailJs?.templateId || "").trim();
        const publicKey = (form.dataset.emailjsPublicKey || globalEmailJs?.publicKey || "").trim();
        const hasEmailJsHints = Boolean(serviceId || templateId || publicKey) || provider === "emailjs";
        const hasEmailJsPlaceholders =
          /^YOUR_|CHANGE_ME/i.test(serviceId) || /^YOUR_|CHANGE_ME/i.test(templateId) || /^YOUR_|CHANGE_ME/i.test(publicKey);
        const canUseEmailJs =
          (provider === "emailjs" || (!provider && (serviceId || templateId || publicKey))) &&
          !isPlaceholder(serviceId) &&
          !isPlaceholder(templateId) &&
          !isPlaceholder(publicKey);

        const showFallback = async (reason) => {
          const copied = await copyToClipboard(mailBody);
          const linkedIn = document.querySelector('a[href*="linkedin.com/in/"]');
          const fallbackHref = mailtoHref || (linkedIn instanceof HTMLAnchorElement ? linkedIn.href : "");
          const fallbackLabel = mailtoHref ? `Écrire par email` : "Me contacter sur LinkedIn";
          setStatus(`${reason}${copied ? " Message copié." : ""}`, { actionHref: fallbackHref, actionLabel: fallbackLabel });
        };

        try {
          if (!canUseEmailJs) {
            await showFallback(
              hasEmailJsHints && hasEmailJsPlaceholders
                ? "Envoi automatique non configuré (EmailJS) : clés manquantes."
                : "Envoi automatique indisponible.",
            );
            return;
          }

          const widgetId = Number(form.dataset.recaptchaWidgetId);
          const recaptchaToken =
            Number.isFinite(widgetId) && widgetId >= 0 && window.grecaptcha?.getResponse
              ? String(window.grecaptcha.getResponse(widgetId) || "").trim()
              : "";

          if (recaptchaSiteKey && !recaptchaToken) {
            if (form.dataset.recaptchaUnavailable === "1") {
              await showFallback("reCAPTCHA bloqué/indisponible. Désactive le bloqueur de pubs ou contacte-moi via LinkedIn.");
              return;
            }

            setStatus("Merci de valider le reCAPTCHA avant l'envoi.");
            setBusy(false);
            return;
          }

          await sendViaEmailJs({
            serviceId,
            templateId,
            publicKey,
            templateParams: {
              name: fromName,
              title: subject,
              "g-recaptcha-response": recaptchaToken || undefined,
              to_name: toName || undefined,
              from_name: fromName,
              from_email: replyTo,
              reply_to: replyTo,
              email: replyTo,
              subject,
              message,
              page_url: window.location.href,
            },
          });

          setStatus("Message envoyé. Merci !");
          try {
            window.localStorage?.setItem("ina_contact_last_sent", String(Date.now()));
          } catch {
            // Ignore storage failures.
          }
          form.reset();
          if (Number.isFinite(widgetId) && widgetId >= 0 && window.grecaptcha?.reset) {
            window.grecaptcha.reset(widgetId);
          }
        } catch (error) {
          console.error("Contact form send failed:", error);
          const details = normalizeEmailJsErrorText(error);
          const hint = formatEmailJsTroubleshooting(details);
          const appendix = details ? ` Détails : ${truncate(details, 140)}` : "";
          await showFallback(`${hint}${appendix}`);
        } finally {
          setBusy(false);
        }
      });
    }
  };

  const initPageFeatures = () => {
    initReveal();
    initRevealOnLoad();
    initProjectRail();
    ensureLightbox();
    initCardDecks();
    initContactForms();
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

  const setSitePlayerVisible = (visible) => {
    const shouldShow = Boolean(visible);
    const sitePlayer = document.querySelector("[data-site-player]");
    if (sitePlayer) {
      sitePlayer.hidden = !shouldShow;
      sitePlayer.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    }
    document.body.classList.toggle("has-site-player", shouldShow && Boolean(document.querySelector("[data-player]")));
  };

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

  setSitePlayerVisible(isGlobalPlayerEnabled());

  if (players.length) {
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
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path>
        </svg>
      `;

      const nextButton = document.createElement("button");
      nextButton.type = "button";
      nextButton.className = "icon-btn player-btn";
      nextButton.setAttribute("aria-label", "Morceau suivant");
      nextButton.innerHTML = `
        <svg class="icon icon--filled" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path>
        </svg>
      `;

      playButton.classList.add("player-play");
      transport.append(prevButton, playButton, nextButton);

      const info = document.createElement("div");
      info.className = "player-info";
      const titleEl = document.createElement("div");
      titleEl.className = "player-title";
      const titleTrackEl = document.createElement("span");
      titleTrackEl.className = "player-title__track";
      const titleTextEl = document.createElement("span");
      titleTextEl.className = "player-title__text";
      const titleGapEl = document.createElement("span");
      titleGapEl.className = "player-title__gap";
      titleGapEl.setAttribute("aria-hidden", "true");
      const titleCloneEl = document.createElement("span");
      titleCloneEl.className = "player-title__text player-title__text--clone";
      titleCloneEl.setAttribute("aria-hidden", "true");

      const initialTitle = validTracks.length ? "S\u00e9lectionnez un morceau" : "Ajoutez vos morceaux";
      titleTextEl.textContent = initialTitle;
      titleCloneEl.textContent = initialTitle;
      titleTrackEl.append(titleTextEl, titleGapEl, titleCloneEl);
      titleEl.appendChild(titleTrackEl);
      titleEl.title = initialTitle;
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

      let activeIndex = -1;
      let panelOpen = false;
      let isSeeking = false;
      let lastPersist = 0;
      let lastNonZeroVolume = clamp(Number(initialState?.volume ?? 1), 0, 1) || 0.7;
      let statusOverride = "";
      let marqueeRaf = 0;

      const clearTitleMarquee = () => {
        titleEl.classList.remove("is-marquee");
        titleEl.style.removeProperty("--player-title-distance");
        titleEl.style.removeProperty("--player-title-duration");
      };

      const updateTitleMarquee = () => {
        clearTitleMarquee();
        if (prefersReducedMotion) return;

        const isPlaying = !audio.paused && !audio.ended;
        const hasTrack = Number.isFinite(activeIndex) && activeIndex >= 0 && Boolean(audio.src);
        if (!isPlaying || !hasTrack) return;

        void titleEl.offsetWidth;
        const containerWidth = titleEl.clientWidth;
        if (!containerWidth) return;

        const textWidth = titleTextEl.getBoundingClientRect().width;
        const overflow = Math.max(0, textWidth - containerWidth);
        if (overflow < 8) return;

        const gapValue = Number.parseFloat(window.getComputedStyle(titleEl).getPropertyValue("--player-title-gap")) || 40;
        const distance = textWidth + gapValue;
        const durationSeconds = Math.min(Math.max(distance / 40 + 2, 8), 45);
        titleEl.style.setProperty("--player-title-distance", `${distance.toFixed(2)}px`);
        titleEl.style.setProperty("--player-title-duration", `${durationSeconds}s`);

        void titleEl.offsetWidth;
        titleEl.classList.add("is-marquee");
      };

      const scheduleTitleMarqueeUpdate = () => {
        if (marqueeRaf) window.cancelAnimationFrame(marqueeRaf);
        marqueeRaf = window.requestAnimationFrame(() => {
          marqueeRaf = 0;
          updateTitleMarquee();
        });
      };

      let titleResizeObserver = null;
      if (typeof window.ResizeObserver === "function") {
        titleResizeObserver = new ResizeObserver(() => scheduleTitleMarqueeUpdate());
        titleResizeObserver.observe(titleEl);
      } else {
        window.addEventListener("resize", scheduleTitleMarqueeUpdate);
      }

      if (document.fonts?.ready) {
        document.fonts.ready.then(scheduleTitleMarqueeUpdate).catch(() => {});
      }

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
          scheduleTitleMarqueeUpdate();
          return;
        }

        if (!hasTrack) {
          statusEl.textContent = "Pr\u00eat";
          scheduleTitleMarqueeUpdate();
          return;
        }

        if (audio.ended) {
          statusEl.textContent = "Morceau termin\u00e9";
          scheduleTitleMarqueeUpdate();
          return;
        }

        if (statusOverride) {
          statusEl.textContent = statusOverride;
          scheduleTitleMarqueeUpdate();
          return;
        }

        statusEl.textContent = isPlaying ? "Lecture en cours" : "En pause";
        scheduleTitleMarqueeUpdate();
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
          titleTextEl.textContent = track.title;
          titleCloneEl.textContent = track.title;
          titleEl.title = track.title;
          progressInput.value = "0";
          progressInput.disabled = true;
          progressInput.style.setProperty("--progress", "0%");
          currentTimeEl.textContent = "0:00";
          durationEl.textContent = "0:00";
          scheduleTitleMarqueeUpdate();
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

  const showPlayerUnlockFireworks = ({ text = "Let Play Music", durationMs = 5200 } = {}) => {
    const existing = document.querySelector("[data-unlock-fireworks]");
    if (existing) existing.remove();

    const wrapper = document.createElement("div");
    wrapper.className = "unlock-fireworks";
    wrapper.dataset.unlockFireworks = "1";
    wrapper.innerHTML = `<canvas class="unlock-fireworks__canvas" aria-hidden="true"></canvas>`;
    document.body.appendChild(wrapper);

    let doneResolved = false;
    let resolveDone = null;
    const done = new Promise((resolve) => {
      resolveDone = () => {
        if (doneResolved) return;
        doneResolved = true;
        resolve();
      };
    });

    const removeWrapper = () => {
      if (wrapper.isConnected) wrapper.remove();
    };

    const canvas = wrapper.querySelector("canvas");
    const ctx = canvas?.getContext?.("2d", { alpha: true });
    if (!canvas || !ctx) {
      removeWrapper();
      resolveDone?.();
      return done;
    }

    let width = 0;
    let height = 0;

    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth || 0;
      height = window.innerHeight || 0;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    setCanvasSize();

    const textFontFamily = `"Bebas Neue", "Inter", system-ui, sans-serif`;
    const fitTextFontSize = (context, value, initialSize, maxWidth, { minSize = 28 } = {}) => {
      let size = Number.isFinite(initialSize) ? initialSize : 42;
      const min = Number.isFinite(minSize) ? minSize : 28;
      const iterations = 14;
      for (let i = 0; i < iterations; i++) {
        context.font = `900 ${Math.max(min, size)}px ${textFontFamily}`;
        const measured = context.measureText(String(value || "")).width || 0;
        if (measured <= maxWidth) break;
        const next = Math.floor(size * 0.92);
        if (next >= size) size -= 1;
        else size = next;
        if (size <= min) {
          size = min;
          break;
        }
      }
      return Math.max(min, size);
    };

    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const baseSize = Math.round(Math.max(Math.min(width * 0.1, 96), 46));
      const fontSize = fitTextFontSize(ctx, text, baseSize, width * 0.92, { minSize: 28 });
      ctx.font = `900 ${fontSize}px ${textFontFamily}`;
      ctx.fillText(text, width / 2, height * 0.34);

      wrapper.classList.add("is-out");
      window.setTimeout(() => resolveDone?.(), 420);
      window.setTimeout(removeWrapper, 900);
      return done;
    }

    const tau = Math.PI * 2;
    const neonHues = [0, 18, 35, 55, 95, 140, 185, 210, 255, 290, 320];
    const pickHue = () => neonHues[(Math.random() * neonHues.length) | 0] + (Math.random() * 16 - 8);

    const rockets = [];
    const particles = [];

    const makeColor = (hue, alpha) => `hsla(${hue}, 100%, 62%, ${alpha})`;

    const spawnBurst = (x, y, hue, { count = 60, speedMin = 4, speedMax = 12 } = {}) => {
      const baseHue = Number.isFinite(hue) ? hue : pickHue();
      for (let i = 0; i < count; i++) {
        const a = Math.random() * tau;
        const s = speedMin + Math.random() * (speedMax - speedMin);
        particles.push({
          type: "burst",
          x,
          y,
          lastX: x,
          lastY: y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          hue: baseHue + (Math.random() * 40 - 20),
          life: 1,
          decay: 0.012 + Math.random() * 0.016,
          width: 1.8 + Math.random() * 1.4,
        });
      }
    };

    const spawnRocket = () => {
      rockets.push({
        x: width * (0.12 + Math.random() * 0.76),
        y: height + 18,
        lastX: 0,
        lastY: 0,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(10 + Math.random() * 4.5),
        hue: pickHue(),
      });
    };

    const buildTextTargets = () => {
      const bufferW = Math.min(980, Math.max(320, Math.round(width * 0.92)));
      const buffer = document.createElement("canvas");
      buffer.width = bufferW;
      buffer.height = 1;
      const bctx = buffer.getContext("2d");
      if (!bctx) return [];

      const baseSize = Math.round(Math.max(Math.min(width * 0.11, 110), 52));
      const minSize = width < 360 ? 26 : 30;
      const fontSize = fitTextFontSize(bctx, text, baseSize, bufferW * 0.92, { minSize });
      const bufferH = Math.round(fontSize * 1.25);
      buffer.height = bufferH;

      bctx.clearRect(0, 0, bufferW, bufferH);
      bctx.fillStyle = "#fff";
      bctx.textAlign = "center";
      bctx.textBaseline = "middle";
      bctx.font = `900 ${fontSize}px ${textFontFamily}`;
      bctx.fillText(text, bufferW / 2, bufferH / 2);

      const pixels = bctx.getImageData(0, 0, bufferW, bufferH).data;
      const step = width < 520 ? 7 : 6;
      const points = [];
      for (let y = 0; y < bufferH; y += step) {
        for (let x = 0; x < bufferW; x += step) {
          const alpha = pixels[(y * bufferW + x) * 4 + 3];
          if (alpha > 160) points.push({ x, y });
        }
      }

      const maxPoints = width < 520 ? 700 : 1100;
      if (points.length > maxPoints) {
        const ratio = maxPoints / points.length;
        return points.filter(() => Math.random() < ratio).map((p) => ({ x: p.x, y: p.y, w: bufferW, h: bufferH }));
      }

      return points.map((p) => ({ x: p.x, y: p.y, w: bufferW, h: bufferH }));
    };

    const spawnTextFirework = () => {
      const rawTargets = buildTextTargets();
      if (!rawTargets.length) return false;

      const bufferW = rawTargets[0].w;
      const bufferH = rawTargets[0].h;
      const offsetX = (width - bufferW) / 2;
      const centerY = height * 0.32;
      const offsetY = centerY - bufferH / 2;
      const targets = rawTargets.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY }));

      const originX = width * (0.35 + Math.random() * 0.3);
      const originY = height * 0.72;
      spawnBurst(originX, originY, pickHue(), { count: 90, speedMin: 6, speedMax: 13 });

      for (const target of targets) {
        const angle = Math.random() * tau;
        const speed = 1.5 + Math.random() * 6;
        const hue = pickHue();
        particles.push({
          type: "text",
          x: originX,
          y: originY,
          lastX: originX,
          lastY: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 5,
          tx: target.x,
          ty: target.y,
          hue,
          life: 1,
          decay: 0.006 + Math.random() * 0.003,
          width: 2.1 + Math.random() * 1.6,
          hold: 140 + Math.random() * 90,
          arrived: false,
        });
      }

      return true;
    };

    const updateParticle = (p, dt) => {
      p.lastX = p.x;
      p.lastY = p.y;

      if (p.type === "burst") {
        p.vy += 0.22 * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        return;
      }

      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy) || 0;

      if (!p.arrived) {
        const maxSpeed = 12;
        const nearRadius = 140;
        const desiredSpeed = dist > nearRadius ? maxSpeed : (maxSpeed * dist) / nearRadius;
        const inv = dist ? 1 / dist : 0;
        const desiredVx = dx * inv * desiredSpeed;
        const desiredVy = dy * inv * desiredSpeed;

        const steerX = desiredVx - p.vx;
        const steerY = desiredVy - p.vy;
        const maxForce = 0.62;
        p.vx += Math.max(-maxForce, Math.min(steerX, maxForce)) * dt;
        p.vy += Math.max(-maxForce, Math.min(steerY, maxForce)) * dt;

        p.vx *= 0.92;
        p.vy *= 0.92;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (dist < 6) {
          p.arrived = true;
        }

        return;
      }

      if (p.hold > 0) {
        p.hold -= dt;
        const settleStrength = 0.09;
        p.vx += dx * settleStrength * dt;
        p.vy += dy * settleStrength * dt;
        p.vx *= 0.82;
        p.vy *= 0.82;
      } else {
        p.vy += 0.18 * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= (p.decay || 0.012) * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    };

    const drawParticle = (p) => {
      const alpha = Math.max(0, Math.min(1, p.life));
      if (alpha <= 0) return;

      if (p.type === "burst") {
        ctx.strokeStyle = makeColor(p.hue, alpha);
        ctx.lineWidth = p.width;
        ctx.beginPath();
        ctx.moveTo(p.lastX, p.lastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        return;
      }

      ctx.fillStyle = makeColor(p.hue, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.width, 0, tau);
      ctx.fill();
    };

    let cleanedUp = false;
    const cleanup = ({ immediate = false } = {}) => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.removeEventListener("resize", setCanvasSize);
      resolveDone?.();

      if (immediate) {
        removeWrapper();
        return;
      }

      wrapper.classList.add("is-out");
      wrapper.addEventListener("transitionend", removeWrapper, { once: true });
      window.setTimeout(removeWrapper, 900);
    };

    window.addEventListener("resize", setCanvasSize, { passive: true });

    const start = performance.now();
    let last = start;
    let nextRocketAt = start + 50;
    let textSpawned = false;
    let textSpawnedOk = false;
    const textSpawnAt = start + 560;
    const endAt = start + Math.max(1200, Number(durationMs) || 5200);

    const frame = (now) => {
      const dt = Math.min((now - last) / 16.666, 2);
      last = now;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";

      if (now >= nextRocketAt && now < endAt - 400) {
        spawnRocket();
        nextRocketAt = now + 220 + Math.random() * 240;
      }

      if (!textSpawned && now >= textSpawnAt) {
        textSpawnedOk = spawnTextFirework();
        textSpawned = true;
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.lastX = r.x;
        r.lastY = r.y;
        r.vy += 0.12 * dt;
        r.vx *= 0.995;
        r.x += r.vx * dt;
        r.y += r.vy * dt;

        ctx.strokeStyle = makeColor(r.hue, 0.9);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(r.lastX, r.lastY);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();

        const shouldExplode = r.vy >= 0 || r.y < height * 0.18;
        if (!shouldExplode) continue;

        spawnBurst(r.x, r.y, r.hue, { count: 70, speedMin: 6, speedMax: 14 });
        rockets.splice(i, 1);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        updateParticle(p, dt);
        drawParticle(p);
        if (p.life <= 0) particles.splice(i, 1);
      }

      if (textSpawnedOk) {
        const hasText = particles.some((p) => p.type === "text");
        if (!hasText) {
          cleanup({ immediate: true });
          return;
        }
      }

      const hasMore = now < endAt || rockets.length || particles.length;
      if (hasMore) {
        window.requestAnimationFrame(frame);
        return;
      }

      cleanup();
    };

    window.requestAnimationFrame(frame);
    return done;
  };

  const showPlayerUnlockToast = ({ until = null } = {}) => {
    const existing = document.querySelector("[data-player-unlock-toast]");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "player-unlock-toast";
    toast.dataset.playerUnlockToast = "1";
    toast.innerHTML = `
      <div class="player-unlock-toast__inner" role="status" aria-live="polite">
        <div class="player-unlock-toast__title">Lecteur musical d\u00e9bloqu\u00e9</div>
      </div>
    `;

    document.body.appendChild(toast);

    const exitToast = () => {
      if (prefersReducedMotion) {
        toast.remove();
        return;
      }

      toast.classList.add("is-out");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
      window.setTimeout(() => toast.remove(), 800);
    };

    if (until && typeof until.then === "function") {
      until.finally(exitToast);
      return;
    }

    window.setTimeout(exitToast, prefersReducedMotion ? 1200 : 2600);
  };

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-player-unlock]");
    if (!button) return;
    event.preventDefault();

    const wasEnabled = isGlobalPlayerEnabled();
    setGlobalPlayerEnabled(true);
    setSitePlayerVisible(true);

    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    button.textContent = "Lecteur musical d\u00e9bloqu\u00e9";

    if (!wasEnabled) {
      const fireworksDone = showPlayerUnlockFireworks({ text: "Let Play Music" });
      showPlayerUnlockToast({ until: fireworksDone });
    }
  });

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
