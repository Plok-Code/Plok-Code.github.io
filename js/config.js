const reducedMotionQuery =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

export let prefersReducedMotion = Boolean(reducedMotionQuery?.matches);

const handleReducedMotionChange = (event) => {
    prefersReducedMotion = Boolean(event?.matches);
};

if (reducedMotionQuery) {
    if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    } else if (typeof reducedMotionQuery.addListener === "function") {
        reducedMotionQuery.addListener(handleReducedMotionChange);
    }
}

export const sparkColors = [
    "#7DD3FC",
    "#38BDF8",
    "#22D3EE",
    "#A5F3FC",
    "#F8FAFC",
];
