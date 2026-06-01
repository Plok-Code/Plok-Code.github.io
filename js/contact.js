export const initContactForms = () => {
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
            const baseSubject = rawSubject || "Message depuis le site";
            const subject = `${baseSubject}${fromName ? ` — ${fromName}` : ""}${replyTo ? ` (${replyTo})` : ""}`;
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
