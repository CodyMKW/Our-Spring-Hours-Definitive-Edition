/* ============================================================================
   data.js — static registries: characters, backgrounds, music moods.
   To add a background: drop a 1280x720 jpg in assets/backgrounds/ and add an
   entry to BACKGROUNDS below. To add a character: drop a transparent webp in
   assets/characters/ and add an entry to CHARACTERS (+ a CSS colour var if you
   want a custom nameplate; the `color` here is used automatically).
   ========================================================================== */
window.VN_DATA = (function () {
  "use strict";

  const CHARACTERS = {
    // h = sprite height in vh (tuned so every head ends up a similar size)
    cody:      { name: "Cody",             color: "#8b7fc0", img: "assets/characters/cody.webp",      h: 60 },
    joseph:    { name: "Joseph",           color: "#5b93c7", img: "assets/characters/joseph.webp",    h: 56 },
    falcon:    { name: "Falcon",           color: "#7fa25c", img: "assets/characters/falcon.webp",    h: 58 },
    cementoss: { name: "Cementoss",        color: "#b0713f", img: "assets/characters/cementoss.webp", h: 56 },
    uraraka:   { name: "Uraraka",          color: "#ff6f8f", img: "assets/characters/uraraka.webp",   h: 62 },
    light:     { name: "Light Yagami",     color: "#c9a56a", img: "assets/characters/light.webp",     h: 82 },
    maki:      { name: "Maki Oze",         color: "#d0642f", img: "assets/characters/maki.webp",      h: 84 },
    shigaraki: { name: "Tomura Shigaraki", color: "#8fb7cf", img: "assets/characters/shigaraki.webp", h: 70 },
    allforone: { name: "All For One",      color: "#b3363b", img: "assets/characters/allforone.webp", h: 68 },
  };

  // `name` is shown in the Memories gallery. Backgrounds unlock when first seen.
  const BACKGROUNDS = {
    hallway:            { file: "hallway.jpg",            name: "School Hallway" },
    courtyard_day:      { file: "courtyard_day.jpg",      name: "Courtyard — Cherry Tree" },
    courtyard_sunset:   { file: "courtyard_sunset.jpg",   name: "Courtyard — Golden Hour" },
    courtyard_night:    { file: "courtyard_night.jpg",    name: "Courtyard — Festival Night" },
    courtyard_ruined:   { file: "courtyard_ruined.jpg",   name: "Courtyard — Overgrown" },
    home_day:           { file: "home_day.jpg",           name: "Cody's Room" },
    home_night:         { file: "home_night.jpg",         name: "Cody's Room — Night" },
    home_ruined:        { file: "home_ruined.jpg",        name: "Cody's Room — Abandoned" },
    rooftop_sunset:     { file: "rooftop_sunset.jpg",     name: "Rooftop — Sunset" },
    rooftop_night:      { file: "rooftop_night.jpg",      name: "Rooftop — Night" },
    rooftop_garden:     { file: "rooftop_garden.jpg",     name: "Rooftop Garden" },
    hallway_ruined:     { file: "hallway_ruined.jpg",     name: "School Hallway — Abandoned" },
    gas_station:        { file: "gas_station.jpg",        name: "Gas Station" },
    forest:             { file: "forest.jpg",             name: "The Green Mile" },
    forest_dusk:        { file: "forest_dusk.jpg",        name: "The Green Mile — Dusk" },
    hideout:            { file: "hideout.jpg",            name: "The Hideout" },
    hideout_alert:      { file: "hideout_alert.jpg",      name: "The Hideout — Alert" },
    ruined_city:        { file: "ruined_city.jpg",        name: "The Ruins" },
    ruined_dawn:        { file: "ruined_dawn.jpg",        name: "The Ruins — Dawn" },
    battlegrounds:      { file: "battlegrounds.jpg",      name: "The Battlegrounds" },
    battlegrounds_dusk: { file: "battlegrounds_dusk.jpg", name: "The Battlegrounds — Smoke" },
    battlegrounds_dawn: { file: "battlegrounds_dawn.jpg", name: "The Battlegrounds — Dawn" },
    home_morning:       { file: "home_morning.jpg",       name: "Cody's Room — Morning" },
    courtyard_bloom:    { file: "courtyard_bloom.jpg",    name: "Courtyard — Full Bloom" },
    courtyard_lanterns: { file: "courtyard_lanterns.jpg", name: "Courtyard — Lanterns" },
    rooftop_dawn:       { file: "rooftop_dawn.jpg",       name: "Rooftop — Dawn" },
    night_sky:          { file: "night_sky.jpg",          name: "Starlight" },
  };

  const BG_DIR = "assets/backgrounds/";

  /* Music moods used by the procedural score (js/audio.js). */
  const MOODS = ["spring", "night", "festival", "tense", "ruin", "sorrow", "hope", "battle", "quiet"];

  return { CHARACTERS, BACKGROUNDS, BG_DIR, MOODS, VERSION: "1.3.0" };
})();
