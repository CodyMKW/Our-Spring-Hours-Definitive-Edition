/* ============================================================================
   data.js — Blossom Drop: constants, merge chain, characters, unlock rules.
   Everything the other files need to know about *what* things are lives here.
   ========================================================================== */
window.BD = window.BD || {};
(function (BD) {
  "use strict";

  /* ---- geometry (all in "jar units", independent of screen size) ---------- */
  BD.JAR_W = 440;          // inner width of the planter
  BD.JAR_H = 600;          // inner height
  BD.LINE_Y = 70;          // danger line, measured from the jar's top edge
  BD.PAD_X = 44;           // canvas margin left/right of the jar
  BD.TOP = 128;            // space above the jar for the dropper
  BD.BOTTOM = 52;          // frame / soil below the jar
  BD.CW = BD.JAR_W + BD.PAD_X * 2;                 // logical canvas width
  BD.CH = BD.TOP + BD.JAR_H + BD.BOTTOM;           // logical canvas height

  /* ---- the merge chain ----------------------------------------------------- *
   * Two orbs of the same tier that touch become one orb of the next tier.
   * Two Cherry Trees together make a Full Bloom and vanish for a big bonus.   */
  BD.TIERS = [
    { name: "Petal",       r: 15,  pts: 1,   c: ["#ffe3ea", "#ffb3c6", "#e87c9c"] },
    { name: "Bud",         r: 21,  pts: 3,   c: ["#ffd0df", "#ff8fb4", "#d9547f"] },
    { name: "Blossom",     r: 28,  pts: 6,   c: ["#ffffff", "#ffd6e3", "#f09ab7"] },
    { name: "Dango",       r: 36,  pts: 10,  c: ["#fff7de", "#f8dca0", "#d6aa5c"] },
    { name: "Onigiri",     r: 45,  pts: 15,  c: ["#e6f3ff", "#a9d2f2", "#5f9ccc"] },
    { name: "Tomato",      r: 55,  pts: 21,  c: ["#ff9b8c", "#f0503f", "#b02a24"] },
    { name: "Lantern",     r: 66,  pts: 28,  c: ["#ffe0a0", "#ffac3f", "#cf6d17"] },
    { name: "Wish Charm",  r: 78,  pts: 36,  c: ["#d9c8ff", "#9a7be0", "#5f43a8"] },
    { name: "Moon",        r: 92,  pts: 45,  c: ["#fffbe2", "#ffe58f", "#d9b24a"] },
    { name: "Cherry Tree", r: 108, pts: 55,  c: ["#ffe6ef", "#ff9fc0", "#c9567f"] },
  ];
  BD.MAX_TIER = BD.TIERS.length;       // tiers are 1-based in game logic
  BD.JUNK_R = 26;                      // multiplayer "stone" orbs (tier 0, never merge)
  BD.JUNK_LIFE = 12;                   // seconds before a stone crumbles away
  BD.FULL_BLOOM = 120;                 // points for merging two Cherry Trees
  BD.SPAWN_WEIGHTS = [34, 28, 20, 12, 6];   // tiers 1..5 can be dropped

  /* ---- characters ----------------------------------------------------------- */
  const P1 = ["ending_romance", "ending_friends", "ending_falcon", "ending_true", "ending_lonely"];
  const P2 = ["end_inheritance", "end_ashfalldawn", "end_staticledger", "end_embers", "end_longdark"];
  const P3 = ["end_dawnunity", "end_redemption", "end_shadowalliance", "end_costlyvictory", "end_pyrrhic", "end_isolation", "end_quietlife"];
  const P4 = ["ending_hundredth", "ending_almost", "ending_quiet_spring"];
  const finished = (list) => () => { const e = BD.vnEndings(); return list.some(id => e[id]); };

  BD.CHARS = [
    {
      id: "cody", name: "Cody", color: "#8b7fc0", img: "../assets/characters/cody.webp", bg: "courtyard_bloom",
      tag: "The one who brings everyone together",
      ability: { name: "Rally", icon: "❦", desc: "Instantly merges the best matching pair in the jar." },
      quips: { start: ["Okay. Deep breath. Let's go.", "Nice and steady."], merge: ["That's the spirit!", "They fit together!"], big: ["Whoa, look at that one!"], combo: ["Everything's clicking!"], ability: ["Come on, everyone!"], over: ["...That went sideways. Again?"] },
      unlocks: [],
    },
    {
      id: "uraraka", name: "Uraraka", color: "#ff6f8f", img: "../assets/characters/uraraka.webp", bg: "courtyard_sunset",
      tag: "Gravity is a suggestion",
      ability: { name: "Zero Gravity", icon: "◌", desc: "Everything floats for a few seconds, drifting together to merge." },
      quips: { start: ["Let's make it float!", "Ready when you are!"], merge: ["Yes!", "So pretty!"], big: ["Look at it go!"], combo: ["Chain reaction!"], ability: ["Release!"], over: ["Oh no, it all came down..."] },
      unlocks: [],
    },
    {
      id: "joseph", name: "Joseph", color: "#5b93c7", img: "../assets/characters/joseph.webp", bg: "home_morning",
      tag: "If it jams, give it a shake",
      ability: { name: "Shake It Up", icon: "✵", desc: "Jostles every orb to repack the jar and free stuck pairs." },
      quips: { start: ["Eh, I'll wing it.", "Alright, alright."], merge: ["Nice.", "Easy."], big: ["Okay, that's actually cool."], combo: ["Called it."], ability: ["Hold on to your hat!"], over: ["Okay, that one's on the jar."] },
      unlocks: [],
    },
    {
      id: "falcon", name: "Falcon", color: "#7fa25c", img: "../assets/characters/falcon.webp", bg: "courtyard_day",
      tag: "Subtlety is overrated",
      ability: { name: "Falcon Punch", icon: "☄", desc: "A flaming fist smashes down, shattering small orbs (up to Tomato).", },
      quips: { start: ["I have a plan. You won't like it.", "Let's cause a scene."], merge: ["Boom!", "Called it!"], big: ["THAT'S what I'm talking about!"], combo: ["COMBO!"], ability: ["FALCON... PUNCH!"], over: ["Rematch. Immediately."] },
      unlocks: [
        { text: "Finish Part I of the visual novel", kind: "vn", check: finished(P1) },
        { text: "Score 2,500 in a single game", kind: "game", check: (s) => s.best >= 2500 },
      ],
    },
    {
      id: "cementoss", name: "Cementoss", color: "#b0713f", img: "../assets/characters/cementoss.webp", bg: "rooftop_sunset",
      tag: "Steady. Solid. Reliable.",
      ability: { name: "Stone Shelf", icon: "▬", desc: "Raises a stone shelf across the jar for a few seconds to catch the pile." },
      quips: { start: ["Patience.", "One piece at a time."], merge: ["Good.", "Solid."], big: ["A fine piece."], combo: ["Well done."], ability: ["Hold the line."], over: ["We rebuild."] },
      unlocks: [
        { text: "Finish Part I of the visual novel", kind: "vn", check: finished(P1) },
        { text: "Grow a Tomato in one game", kind: "game", check: (s) => s.maxTier >= 6 },
      ],
    },
    {
      id: "maki", name: "Maki", color: "#d0642f", img: "../assets/characters/maki.webp", bg: "rooftop_garden",
      tag: "Burn away what's in the way",
      ability: { name: "Cleansing Fire", icon: "♨", desc: "Burns away every orb of the smallest tier in the jar." },
      quips: { start: ["Secure the perimeter.", "Let's work."], merge: ["Clean.", "Good."], big: ["Impressive."], combo: ["That's efficiency."], ability: ["Stand clear!"], over: ["Regroup. Go again."] },
      unlocks: [
        { text: "Finish Part II (Ashfall)", kind: "vn", check: finished(P2) },
        { text: "Score 6,000 in a single game", kind: "game", check: (s) => s.best >= 6000 },
      ],
    },
    {
      id: "light", name: "Light Yagami", color: "#c9a56a", img: "../assets/characters/light.webp", bg: "hideout",
      tag: "Everything according to plan",
      ability: { name: "Decree", icon: "✒", desc: "Choose your next piece. Passive: you can see the next four." },
      quips: { start: ["I've already calculated this.", "Predictable."], merge: ["As expected.", "Efficient."], big: ["Better than projected."], combo: ["Exactly as planned."], ability: ["I decide."], over: ["...A miscalculation."] },
      unlocks: [
        { text: "Finish Part III (Last Light)", kind: "vn", check: finished(P3) },
        { text: "Grow a Moon in one game", kind: "game", check: (s) => s.maxTier >= 9 },
      ],
    },
    {
      id: "shigaraki", name: "Tomura Shigaraki", color: "#8fb7cf", img: "../assets/characters/shigaraki.webp", bg: "ruined_dawn",
      tag: "Break it. Then break the pieces",
      ability: { name: "Decay", icon: "☠", desc: "Tap an orb to crumble it; its neighbors shrink one tier." },
      quips: { start: ["...Fine.", "Don't get used to this."], merge: ["Tch.", "Whatever."], big: ["...Not bad."], combo: ["Huh."], ability: ["Crumble."], over: ["Pathetic. Again."] },
      unlocks: [
        { text: "Talk Shigaraki down in Part II (courtyard)", kind: "vn", check: () => { const c = BD.vnCarry(2); return !!(c && c.flags && c.flags.sparedShigaraki); } },
        { text: "Land a 4-chain combo", kind: "game", check: (s) => s.bestCombo >= 4 },
      ],
    },
    {
      id: "allforone", name: "All For One", color: "#b3363b", img: "../assets/characters/allforone.webp", bg: "battlegrounds_dusk",
      tag: "Everything is mine to take",
      ability: { name: "Absorb", icon: "☯", desc: "A vortex drags every orb to the middle of the jar." },
      quips: { start: ["Show me what you can do.", "Entertain me."], merge: ["Mine.", "Good."], big: ["Magnificent."], combo: ["Yes. More."], ability: ["Come to me."], over: ["Even I lose, sometimes."] },
      unlocks: [
        { text: "Finish the Bonus Story, The Hundredth Petal", kind: "vn", check: finished(P4) },
        { text: "Grow a Cherry Tree in one game", kind: "game", check: (s) => s.maxTier >= 10 },
      ],
    },
  ];
  BD.CHAR = Object.fromEntries(BD.CHARS.map(c => [c.id, c]));

  /* ---- reading the visual novel's save data (same origin localStorage) ----- */
  const PREFIX = "osh-de:";
  function vnGlobal() { try { return JSON.parse(localStorage.getItem(PREFIX + "global") || "{}"); } catch (e) { return {}; } }
  BD.vnEndings = () => vnGlobal().endings || {};
  BD.vnCarry = (part) => (vnGlobal().carry || {})[part] || null;

  /* ---- Blossom Drop's own save ---------------------------------------------- */
  const DEFAULT_STATS = { games: 0, best: 0, maxTier: 0, bestCombo: 0, merges: 0, perChar: {}, lastChar: "cody", seenUnlocked: ["cody", "uraraka", "joseph"] };
  BD.loadStats = () => {
    try { return Object.assign({}, DEFAULT_STATS, JSON.parse(localStorage.getItem(PREFIX + "blossom") || "{}")); }
    catch (e) { return Object.assign({}, DEFAULT_STATS); }
  };
  BD.saveStats = (s) => { try { localStorage.setItem(PREFIX + "blossom", JSON.stringify(s)); } catch (e) { /* ignore */ } };

  /* A character is unlocked when every condition is met (the ?unlock=all URL flag is a tester shortcut). */
  BD.isUnlocked = (ch, stats) => {
    if (/[?&]unlock=all/.test(location.search)) return true;
    return ch.unlocks.every(u => u.check(stats));
  };
})(window.BD);
