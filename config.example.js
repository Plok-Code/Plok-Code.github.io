// Copie ce fichier en `config.js` (non versionné) et remplace les valeurs.
// Important : sur un site statique (GitHub Pages), tout ce qui est dans le navigateur est PUBLIC.
// Ce fichier sert uniquement à centraliser la configuration ; il ne "cache" pas les clés.
window.INA_SITE_CONFIG = {
  contact: {
    emailjs: {
      publicKey: "YOUR_PUBLIC_KEY",
      serviceId: "YOUR_SERVICE_ID",
      templateId: "YOUR_TEMPLATE_ID",
      // Optionnel : utilisé uniquement pour un lien mailto de secours (si tu décides d'afficher un email).
      toEmail: "YOUR_TO_EMAIL",
      toName: "YOUR_TO_NAME",
    },
  },
};
