import { prefersReducedMotion } from './config.js';

/**
 * Recalcule les couleurs des sparks selon le theme courant.
 * - Classic : --accent = vert mint, sparks teintes mint + variations
 * - Hollywood : --accent = rouge cinabre, sparks teintes rouges + variations
 * Recompute a chaque click pour suivre le theme switch en live.
 */
const getThemeSparkColors = () => {
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim() || "#22D3A0";
    const soft = styles.getPropertyValue("--accent-soft").trim() || accent;
    const deep = styles.getPropertyValue("--accent-deep").trim() || accent;
    return [accent, soft, deep, accent, "#FFFFFF"];
};

export const createSpark = (x, y) => {
    if (prefersReducedMotion) return;
    const colors = getThemeSparkColors();
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
        spark.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        document.body.appendChild(spark);
        spark.addEventListener("animationend", () => spark.remove());
    }
};

export const initSparks = () => {
    document.addEventListener("click", (e) => createSpark(e.clientX, e.clientY));
};
