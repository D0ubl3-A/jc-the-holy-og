// JC steering mode — preserve the intentionally inverted/reversed car steering
// while leaving flight, combat, animation, and on-foot controls alone.
(() => {
  if (window.__JC_STEERING_NORMALIZER_V1__) return;
  window.__JC_STEERING_NORMALIZER_V1__ = { installed: true, mode: "inverted" };

  window.JC_STEERING = {
    keyboard: { KeyA: "right", KeyD: "left" },
    mobile: { left: "right", right: "left" },
    inversion: true,
  };
})();
