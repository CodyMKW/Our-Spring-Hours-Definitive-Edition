# Our Spring Hours — Definitive Edition

A three-part, choice-driven visual novel that runs in any modern browser — no build step, no server, no dependencies.

1. **Our Spring Hours** — a school festival, a cherry tree, and the people you meet under it.
2. **Ashfall** — two years later, in a broken world. Your Part I relationships carry over.
3. **Last Light** — the final stand. Real stakes: people can be lost.

20 endings (5 / 5 / 7, plus 3 in the bonus story). Everything you chose in one part shapes the next.
4. **The Hundredth Petal** *(Bonus Story, Definitive Edition only)* — unlocks once you've finished all three parts. One spring after Last Light, the gang bets they can catch 100 falling petals in a day. It uses your full Part III state: who survived, what happened to Light and Shigaraki, who you're closest to, your lanterns and wishes. Play it from the title screen (★ Bonus Story) or from the Part III ending screen.

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
js/story/bonus.js     Bonus story (Part IV) + its 3 endings
js/story/endings.js   shared ending resolver helper
js/card.js            VN_CARD: draws the collectible keepsake card PNG (ending screen → "Keepsake card")
js/engine.js          Game: interpreter, typewriter, sprites, rollback, autosave
js/ui.js              VN_UI: title, menus, saves, settings, backlog, bonds, gallery, endings
js/main.js            boot + input
assets/characters/    transparent .webp sprites
assets/backgrounds/   1280×720 .jpg backgrounds (27)
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

## Bonus story notes

- Label `p4_start`; state is your finished Part III state (stats at full value, `dead`, all flags). `carryOver(prev, 4)` handles this.
- Petal counter: `flags.petals` (added with `fn`), plus 30 + 8 per surviving friend → 100+ = *The Hundredth Petal* (true), 70+ = *Almost a Hundred*, else *A Quiet Spring*.
- Closing scene is picked by `route()`: Uraraka, Falcon, the group, or a quiet one for players who kept their distance.
- Unlock check: `bonusUnlocked()` in `js/ui.js` (any ending found in each of Parts I–III).
- New backgrounds: `home_morning`, `courtyard_bloom`, `courtyard_lanterns`, `rooftop_dawn` (generated by `tools/make_backgrounds.py`).

## Carry file & keepsake card

- **Save carry file** (ending screen, Parts I–II): downloads a small JSON of your finished state, already converted for the next part. Import it from *Load → Import* on another browser/device (or later) to start Part II/III from that exact history without replaying.
- **Keepsake card** (every ending): a collectible trading-card PNG — ending art, your cast, bond bars, closest bond, endings found. Rarity follows the ending: True = holographic gold, Good = silver, Neutral = bronze, Bad = ashen. Part III greys out anyone you lost. From the title screen, **✦ Cards** lists the cards for every chapter you've finished on this device, and can also build a card from a carry file, an exported bundle, or an original Gemini save (older files only hold next-part-scaled stats, so those are scaled back up approximately). PNG download needs the game hosted (browsers block canvas export on `file://`); locally it still displays.

## Nintendo 3DS homebrew port

The visual novel (all parts + bonus) and single-player Blossom Drop also run on a modded 3DS as a `.3dsx`. Download it from the
[3ds-latest release](../../releases/tag/3ds-latest) and see [`3ds/README.md`](3ds/README.md) for install, controls, build steps and file layout.

## Nintendo DS port (experimental)

A `.nds` of the VN + Blossom Drop is on the [nds-latest release](../../releases/tag/nds-latest); see [`nds/README.md`](nds/README.md). Emulator-tested only, no sound yet.

## Game Boy Advance port (experimental)

VN + solo Blossom Drop as a `.gba` on the [gba-latest release](../../releases/tag/gba-latest); see [`gba/README.md`](gba/README.md). Emulator-tested only, no sound yet.

## Blossom Drop (minigame)

Open from the title screen (**✿ Blossom Drop**) or directly at `blossom/index.html`. A Suika-style merge game: drop orbs into the planter, match two of the same tier to grow them through 10 tiers (Petal → Bud → Blossom → Dango → Onigiri → Tomato → Lantern → Wish Charm → Moon → Cherry Tree). Chain merges within ~1.15s for a combo multiplier. If an orb stays above the dashed line too long, the jar overflows.

Each VN character is a playable piece with a unique ability, charged by merging (meter starts at 40/100):

| Character | Ability | Unlock |
|---|---|---|
| Cody | Rally — merge best matching pair | Start |
| Uraraka | Zero Gravity | Start |
| Joseph | Shake It Up | Start |
| Falcon | Falcon Punch | Finish Part I + score 2,500 |
| Cementoss | Stone Shelf | Finish Part I + grow a Tomato |
| Maki | Cleansing Fire | Finish Part II + score 6,000 |
| Light | Decree (see next 4, pick) | Finish Part III + grow a Moon |
| Shigaraki | Decay | Spare Shigaraki in Part II + 4-chain combo |
| All For One | Absorb | Finish the Bonus story + grow a Cherry Tree |

**Controls:** mouse/touch to aim and release; `←/→` or `A/D` move, `Space/↓/Enter` drop, `Q/E/↑/W` ability, `Esc/P` pause, `R` restart, `1–5` in the Decree picker.

**Files:** `blossom/{index.html, multiplayer.html, style.css, multiplayer.css, vendor/matter.min.js + peerjs.min.js (MIT, see *.LICENSE), js/data.js, art.js, sfx.js, game.js, ui.js, net.js, versus.js}`. All art is drawn procedurally on canvas and all sound is synthesized — no image/audio files. Physics: Matter.js 0.19.

**Saves:** `localStorage["osh-de:blossom"]` = `{games, best, maxTier, bestCombo, merges, perChar, lastChar, seenUnlocked}`. VN progress is read from `osh-de:global`, so the VN and `blossom/` must be served from the same origin/folder for unlocks to track. `blossom/index.html?unlock=all` unlocks everyone for testing.

### Versus (beta) — `blossom/multiplayer.html`

Two-player, peer-to-peer. Open it from the single-player menu (**Versus · Beta**) or directly.

1. Pick a **name** (up to 14 characters, saved on this device; both players see each other's) and a character (only ones you've unlocked).
2. **Host a room** → share the 5-letter code or **Copy invite link** (`multiplayer.html?join=ABCDE`). The friend picks **Join a room**, types the code, presses Join.
3. The host presses **Start match**. 3-2-1, then 2:30 on the clock.

Rules: both jars use the **same random seed** (same pieces, same order); you see your rival's jar live in the small mirror. Merging builds **attacks** that drop grey **stones** (never merge, crumble after 12 s) into the rival's jar: combo xN → N-1 stones (max 4); Tomato+ merges → 1 (Tomato) … 5 (Cherry Tree); Full Bloom +6 (max 8 per merge). At most 12 stones can be pending at once. Incoming stones show a warning and land after ~2.6 s — your own attack during the warning **cancels** them first. Lose when your jar overflows; at time-up the higher score wins; leaving/disconnecting forfeits. Rematch needs both players to press it. Win/loss record is kept in `localStorage["osh-de:blossom-vs"]` (`{name, wins, losses, draws}`).

How it's wired (`js/net.js`, `js/versus.js`): each client simulates only its own jar; ~10×/s it sends a snapshot `{t:"snap", o:[[id,tier,x,y,angle],…], sc, mt, h, px, w}`; other messages are `hello {name,char}`, `start {seed,dur}`, `atk {n}`, `over {score}`, `fin {score}`, `rematch`, `leave`. Transport is **PeerJS** (vendored `vendor/peerjs.min.js`, MIT) — a WebRTC data channel brokered by the free public PeerJS cloud server (ids are `bdrop-CODE`). No server of ours. Most home networks connect directly; very strict NATs/some school or corporate networks can fail because no TURN relay is configured.

Testing without a network: add `?net=local` to the URL (e.g. `multiplayer.html?net=local&unlock=all`) and the two players can be two tabs of the same browser (BroadcastChannel). `node tools/mptest.js` runs two headless pages through lobby → match → attack/cancel → overflow → rematch → forfeit (set `MOBILE=1` to use a phone-size viewport for player A).

Tests: `node tools/bltest.js` (smoke), `bltest2.js` (all abilities), `bltest3.js` (game over + mobile).

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
