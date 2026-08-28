// JC steering normalizer — restores physical left/right direction without touching
// the natural-motion, flight, combat, or animation systems.
(() => {
  if (window.__JC_STEERING_NORMALIZER_V1__) return;
  window.__JC_STEERING_NORMALIZER_V1__ = { installed: true, mode: "natural" };

  const rawWindowAdd = window.addEventListener.bind(window);
  const rawDocumentAdd = document.addEventListener.bind(document);

  const isCar = () => {
    const value = document.getElementById("gear")?.textContent?.trim();
    return value !== "FLY" && value !== "F";
  };

  const shouldNormalizeKeyboardHandler = (listener) => {
    const source = typeof listener === "function" ? Function.prototype.toString.call(listener) : "";
    return source.includes("remappedHeld") && source.includes("KeyA") && source.includes("KeyD");
  };

  const shouldNormalizePointerHandler = (listener) => {
    const source = typeof listener === "function" ? Function.prototype.toString.call(listener) : "";
    return source.includes("isSteerButton") || (source.includes("touchHeld") && source.includes("physical"));
  };

  window.addEventListener = function(type, listener, options) {
    if ((type === "keydown" || type === "keyup") && shouldNormalizeKeyboardHandler(listener)) {
      const wrapped = function(event) {
        // The legacy natural-motion runtime intentionally swapped A and D while
        // driving. Skip only that inversion path so the game's original raw
        // KeyA/KeyD handler receives the physical direction unchanged.
        if (isCar() && (event.code === "KeyA" || event.code === "KeyD")) return;
        return listener.call(this, event);
      };
      return rawWindowAdd(type, wrapped, options);
    }
    return rawWindowAdd(type, listener, options);
  };

  document.addEventListener = function(type, listener, options) {
    if ((type === "pointerdown" || type === "pointerup" || type === "pointercancel") && shouldNormalizePointerHandler(listener)) {
      const wrapped = function(event) {
        const steer = event.target?.closest?.(".pad .left,.pad .right");
        // Let the game's original mobile pad receive left as left and right as
        // right. Only bypass the later inversion shim for these two buttons.
        if (isCar() && steer) return;
        return listener.call(this, event);
      };
      return rawDocumentAdd(type, wrapped, options);
    }
    return rawDocumentAdd(type, listener, options);
  };

  window.JC_STEERING = {
    keyboard: { KeyA: "left", KeyD: "right" },
    mobile: { left: "left", right: "right" },
    inversion: false,
  };
})();
