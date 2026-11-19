/* ============================================================================
   endings.js — shared ending helpers.
   Ending *definitions* live next to their story (part1/2/3.js via VN.ending).
   This file exposes a single resolver that the UI/tests can use to predict the
   ending for a state, and keeps the script load order stable.
   ========================================================================== */
(function () {
  "use strict";
  window.VN_ENDINGS = {
    resolve(part, state) {
      if (part === 1) return window.VN.resolveEnding1 && window.VN.resolveEnding1(state);
      if (part === 2) return window.VN.resolveEnding2 && window.VN.resolveEnding2(state);
      return window.VN.resolveFinalEnding && window.VN.resolveFinalEnding(state);
    },
    ids: () => Object.keys(window.VN.endingsDef),
  };
})();
