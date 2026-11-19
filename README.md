# Our Spring Hours — Definitive Edition

A three-part, choice-driven visual novel that runs in any modern browser — no build step, no server, no dependencies.

1. **Our Spring Hours** — a school festival, a cherry tree, and the people you meet under it.
2. **Ashfall** — two years later, in a broken world. Your Part I relationships carry over.
3. **Last Light** — the final stand. Real stakes: people can be lost.

17 endings (5 / 5 / 7). Everything you chose in one part shapes the next.

## Play

- **Locally:** open `index.html` (works from `file://`). All scripts are classic `<script>` tags with relative paths.
- **Hosting:** upload the folder anywhere static (GitHub Pages: *Settings → Pages → Deploy from branch → main / (root)*; Nekoweb; itch.io html5 zip).

## Controls

| Key / input | Action |
|---|---|
| Space, Enter, →, ↓, click, wheel-down | Advance |
| ←, Backspace, PageUp, wheel-up | Go back one line (rollback) |
| A | Auto-advance |
| S (or hold Ctrl) | Skip already-read text |
| L | Backlog |
| H | Hide interface |
| F | Fullscreen |
| M | Mute |
| 1–9 | Pick a choice |
| Esc | Menu / close dialog |

## URL flags

| Flag | Effect |
|---|---|
| `?debug` | Validates the story on load and logs problems to the console |
| `?test=1` | Instant text, no effects, muted (used by `tools/playtest.js`) |

## File structure

```
index.html            page shell (element ids the JS relies on)
css/style.css         all styling; part-themed via [data-part]
js/data.js            VN_DATA: characters, backgrounds, music moods, version
js/core.js            VN_CORE: settings, saves, global progress, carry-over, presets, legacy import
js/audio.js           VN_AUDIO: procedural WebAudio music + sfx (no audio files!)
js/fx.js              VN_FX: canvas weather (petals, rain, ash, snow, embers, fireflies, dust)
js/dsl.js             VN: story DSL + compiler + validator
js/story/part1.js     Part I story + endings
js/story/part2.js     Part II story + endings
js/story/part3.js     Part III story + endings
js/story/endings.js   shared ending resolver helper
js/engine.js          Game: interpreter, typewriter, sprites, rollback, autosave
js/ui.js              VN_UI: title, menus, saves, settings, backlog, bonds, gallery, endings
js/main.js            boot + input
assets/characters/    transparent .webp sprites
assets/backgrounds/   1280×720 .jpg backgrounds (23)
tools/                make_backgrounds.py, validate.js, playtest.js, shot.js
```

## Story DSL (js/dsl.js)

Labels are lists of instructions. Strings can be functions `(state) => string` for dynamic text.

| Helper | Meaning |
|---|---|
| `L(name, ...ins)` | define a label |
| `say(who, ...texts)` / `n(...texts)` | dialogue / narration |
| `bg(name,{keep,fast})`, `music(mood)`, `weather(kind)` | scene |
| `enter(who)`, `exit(who)`, `stage(...who)`, `clear()` | sprites (max 4) |
| `chapter(title, sub)`, `card(...lines)` / `card({part,title,sub})` | banners / title cards |
| `shake()`, `flash(color)`, `pulse(color)`, `wait(ms)`, `sfx(name)` | effects |
| `add(stat, n)`, `aloof(n)`, `set(flag, val)`, `kill(who)` | state |
| `jump(label)`, `route(state => label)`, `end(id)` | flow |
| `iff(cond, then, else)` | conditional block |
| `menu(opt(label, props, ...body), ...)` | choices; props `{fx:{ura:1}, set:{flag:v}, aloof:n, req:s=>bool}` |
| `ending(id, {part,kind,bg,music,weather,title,hint,summary,lines})` | define an ending |

Stats: `ura` (Uraraka), `fri` (friendship), `fal` (Falcon), `maki`, `light`, plus `aloof`.
Part II starts with Part I stats × 0.5, Part III with × 0.6 (all flags carry; `aloof` resets).

### Adding things
- **Background:** drop a 1280×720 jpg in `assets/backgrounds/`, add an entry to `BACKGROUNDS` in `js/data.js`. `tools/make_backgrounds.py [name…]` regenerates the derived ones from the originals (needs numpy, Pillow).
- **Character:** transparent webp in `assets/characters/`, add to `CHARACTERS` (`h` = sprite height in vh).
- **Scene/story:** add labels in a `js/story/*.js` file and `jump` to them. Run `node tools/validate.js`.

## Saves

localStorage prefix `osh-de:`. A save is `{label, idx}` + JSON state (stats, flags, deaths, history, scene). 12 manual slots + autosave. Export/import bundles are JSON; legacy Gemini-version saves can be imported from the Load screen.

## Tools

```
node tools/validate.js         # compile + check every label, bg, character, mood, ending
node tools/playtest.js 8       # N random full playthroughs in headless Chromium (needs playwright)
node tools/shot.js <label> <lineSteps> <out.png> [w h]   # screenshot a story position
```

## Notes on changes from the original

- **Falcon is male** (he/him) everywhere; the original text had him as female.
- Assets moved from embedded data URIs to real files; 14 new backgrounds added; rooftop watermark removed.
- Fixed typos ("Fuel Go" → "Fuel Stop"), headcount errors, and choice effects that applied to the wrong node.
- Part III deaths are deterministic: your stats and choices decide, never a hidden roll.
- New content: study-group chapter, branching festival night, forest night watch, water-depot dilemma, rooftop and notebook scenes.

## Credits

Original concept and art assets by CodyMKW. Original script drafted with Google Gemini; rewritten and extended for this edition. Characters from *My Hero Academia*, *Fire Force*, and *Death Note* are used as fan references; no affiliation.
