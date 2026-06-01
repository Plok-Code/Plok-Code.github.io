/**
 * Profile detail panel : remplace l'ancienne modal deck.
 * Click sur une .profile__card[data-profile-card] = clone du
 * <template data-card-template="<key>"> dans le panel a droite.
 *
 * Pre-charge la premiere carte visible au boot. Ecoute aussi le filtre
 * de tabs (evenement profile:filter-applied) pour reset l'active card
 * quand l'utilisateur change de categorie.
 *
 * Idempotent (safe sur pjax / view-transitions).
 */

export const initProfileDetail = () => {
    const detail = document.querySelector("[data-profile-detail]");
    if (!detail) return;
    if (detail.dataset.detailInit === "1") return;
    detail.dataset.detailInit = "1";

    const cards = document.querySelectorAll(".profile__card[data-profile-card]");
    if (!cards.length) return;

    const titleEl = detail.querySelector("[data-profile-detail-title]");
    const contentEl = detail.querySelector("[data-profile-detail-content]");

    const setEmpty = () => {
        detail.classList.add("profile__detail--empty");
        if (titleEl) titleEl.textContent = "";
        if (contentEl) contentEl.replaceChildren();
        for (const c of cards) {
            c.classList.remove("is-active");
            c.setAttribute("aria-pressed", "false");
        }
    };

    const renderCard = (card, { scroll = false } = {}) => {
        if (!card) return;
        const key = card.dataset.cardKey;
        const titleHtml = card.dataset.cardTitle || "";
        const template = document.querySelector(`template[data-card-template="${key}"]`);

        // Active state sur la carte cliquee
        for (const c of cards) {
            const isActive = c === card;
            c.classList.toggle("is-active", isActive);
            c.setAttribute("aria-pressed", isActive ? "true" : "false");
        }

        detail.classList.remove("profile__detail--empty");

        // Title : on accepte les entites HTML deja presentes dans data-card-title
        if (titleEl) {
            titleEl.innerHTML = titleHtml;
            // restart anim
            titleEl.style.animation = "none";
            void titleEl.offsetWidth;
            titleEl.style.animation = "";
        }

        // Content : clone le template
        if (contentEl) {
            contentEl.replaceChildren();
            if (template?.content && template.content.childNodes.length) {
                contentEl.appendChild(template.content.cloneNode(true));
            } else {
                const fallback = document.createElement("p");
                fallback.className = "muted";
                fallback.textContent =
                    "Contenu indisponible. Ajouter un <template data-card-template=\"" +
                    (key || "") +
                    "\">...</template>.";
                contentEl.appendChild(fallback);
            }
            contentEl.style.animation = "none";
            void contentEl.offsetWidth;
            contentEl.style.animation = "";
        }

        // Reset scroll du panel a chaque switch
        detail.scrollTop = 0;

        // En stack vertical (sous 1024px), on scroll vers le panel pour le
        // rendre visible immediatement apres click. Sinon le clic semble
        // ne rien faire (le panel est sous les cartes, hors viewport).
        if (scroll && window.matchMedia("(max-width: 1024px)").matches) {
            detail.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // Binding click sur chaque carte
    for (const card of cards) {
        if (card.dataset.detailBound === "1") continue;
        card.dataset.detailBound = "1";
        card.addEventListener("click", () => renderCard(card, { scroll: true }));
    }

    // Pre-charge la premiere carte visible (celle qui n'est pas hidden)
    const firstVisible = Array.from(cards).find((c) => !c.hidden) || cards[0];
    renderCard(firstVisible);

    // Synchro avec le filtre de tabs : quand on change de categorie, si la
    // carte active devient hidden, on bascule sur la premiere visible.
    const onFilterApplied = () => {
        const active = Array.from(cards).find(
            (c) => c.getAttribute("aria-pressed") === "true",
        );
        if (active && !active.hidden) return; // active toujours visible, rien a faire
        const nextVisible = Array.from(cards).find((c) => !c.hidden);
        if (nextVisible) {
            renderCard(nextVisible);
        } else {
            setEmpty();
        }
    };

    // Listener idempotent : on stocke la ref sur le node pour ne pas
    // ajouter plusieurs handlers en cas de re-init.
    if (!detail.__profileFilterHandler) {
        detail.__profileFilterHandler = onFilterApplied;
        window.addEventListener("profile:filter-applied", onFilterApplied);
    }
};
