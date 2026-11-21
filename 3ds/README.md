# Our Spring Hours — Nintendo 3DS homebrew (`.3dsx`)

The whole visual novel (Parts I–III + the bonus chapter *The Hundredth Petal*) and single-player **Blossom Drop**, in one
`OurSpringHours.3dsx`. Versus mode, keepsake cards and the picture gallery stay web-only for now.

> **Status:** playable end to end on a real Old 3DS (story, saves, Blossom Drop and audio all confirmed working). Also exercised on a desktop test build.

## Install

1. Download `OurSpringHours.3dsx` from the **[3ds-latest release](../../releases/tag/3ds-latest)**
   (rebuilt automatically on every push that touches `3ds/`, `assets/` or `js/`). The same file is also an artifact on each run of the
   *Build 3DS homebrew* workflow (Actions tab).
2. Copy it to `SD:/3ds/OurSpringHours.3dsx` (any folder under `3ds/` works).
3. Open the Homebrew Launcher and start **Our Spring Hours**. Needs custom firmware + the Homebrew Launcher, nothing else.
4. Optional: sound needs `SD:/3ds/dspfirm.cdc` (dump it once with *DSP1*). Without it the game is silent but works.

Saves and settings live in `SD:/3ds/OurSpringHours/` (see *Files*). Delete that folder to reset everything.

## Controls

| | Visual novel | Blossom Drop | Menus |
|---|---|---|---|
| **A** | next line / finish typing | drop the piece | select |
| **B** | – | cancel Decay/Decree | back |
| **D-pad / Circle Pad** | choose answer | aim the dropper | move |
| **L** | go back one line | – | page up |
| **R (hold)** | skip | – | page down |
| **X** | backlog | use ability | – |
| **Y** | toggle Auto | use ability | – |
| **START** | pause menu | pause menu | – |
| **SELECT** | hide the text box | – | – |
| **Touch** | tap text = next, tap a choice, bottom buttons **Auto / Skip / Log / Save / Menu** | drag in the jar to aim, **lift to drop**, tap the ability card | tap a row, drag to scroll |

Screen layout: **top** = background + character sprites (speaker lit, others dimmed), chapter banners, toasts.
**Bottom** = name tag, dialogue, choices, touch buttons. In Blossom Drop the **bottom** screen is the jar + controls and the **top** screen
shows your character, score, quips and the merge chain.

Skip only stops at text you've already read unless you set *Options → Skip: everything*.
Autosave happens at every choice, chapter start and every ~14 lines; manual saves use 12 slots (Pause → Save).

## What's the same as the web version

The story is **not re-written for the 3DS** — `js/data.js`, `core.js`, `dsl.js` and `js/story/*.js` are bundled unmodified and run inside an embedded
JavaScript engine ([QuickJS](https://bellard.org/quickjs/)), so every branch, stat, flag and ending behaves identically.
Blossom Drop's rules (10 tiers, weights, combo scoring, danger line, 9 abilities, unlock conditions) are ported 1:1 to C;
only the physics engine differs (a small custom circle solver replaces Matter.js).
Music and sound effects are generated live, ported from `js/audio.js`.

## Building it yourself

CI does everything; to reproduce locally you need [devkitPro](https://devkitpro.org/wiki/Getting_Started) with the `3ds-dev` group
(`dkp-pacman -S 3ds-dev`: devkitARM, libctru, citro2d, citro3d, tex3ds) plus Node 18+ and Python 3 with Pillow.

```sh
node   3ds/tools/bundle_story.js                 # -> 3ds/romfs/story.js   (story + runtime, ~160 KB)
python3 3ds/tools/build_assets.py 3ds/build/gfx  # -> bg_*.png (400x240) + ch_*.png (<=224 px tall)
mkdir -p 3ds/romfs/gfx
for f in 3ds/build/gfx/*.png; do n=$(basename $f .png)
  case $n in bg_*) fmt=rgb565;; *) fmt=rgba8888;; esac
  tex3ds -f $fmt -z auto -o 3ds/romfs/gfx/$n.t3x $f; done
make -C 3ds                                      # -> 3ds/OurSpringHours.3dsx (+ .smdh)
```

### Desktop test harness (no 3DS needed)

`tools/build_sdl.sh` builds the same game logic against SDL2 (`libsdl2-dev libsdl2-ttf-dev`) into `3ds/build/osh_sdl`.
It draws the two screens stacked in one 400x480 window.

```
3ds/build/osh_sdl [--script "TOKENS"] [--font FILE.ttf] [--romfs DIR] [--gfx DIR] [--save DIR]
  --script   comma-separated input script, one token per step:
             a b x y l r start select up down left right   press that button
             wN        wait N frames           tX:Y   tap the bottom screen at X,Y
             shot:FILE.png   save a screenshot   quit
  --romfs    where story.js is        (default 3ds/romfs)
  --gfx      where the PNGs are       (default 3ds/build/gfx)
  --save     save directory           (default ./save_test)
```
Example (headless screenshot of the title): `SDL_VIDEODRIVER=dummy 3ds/build/osh_sdl --script "w3,shot:/tmp/title.png,quit"`.
Env hooks (desktop only): `OSH_UNLOCK_ALL=1` unlocks every Blossom character, `OSH_FULLMETER=1` starts with a full ability meter.

`node 3ds/tools/rt_playtest.js 40` plays 40 random runs of the story runtime in Node and checks saves/rollback/endings.

## Files

```
3ds/
  Makefile                 devkitARM build (CFLAGS carry the QuickJS switches: -DEMSCRIPTEN -DOSH_NO_TZ)
  icon.png                 48x48 launcher icon
  js/shim.js               tiny "browser": window, localStorage -> files, console
  js/rt.js                 headless story runtime (same interpreter as js/engine.js, synchronous, event queue)
  js/flat.js               string facade over rt.js so C never parses JSON (records \x1e, fields \x1f, lists \x1d)
  tools/bundle_story.js    concatenates shim + story + rt + flat -> romfs/story.js
  tools/build_assets.py    backgrounds/sprites -> 3DS-sized PNGs
  tools/build_sdl.sh       desktop harness build        tools/rt_playtest.js   node playtest
  source/                  plat.h (platform API), plat_3ds.c, js.c (QuickJS host), ui.c, vn.c, title.c, blossom.c, synth.c, main.c
  source_sdl/plat_sdl.c    desktop backend
  third_party/quickjs/     QuickJS 2024-01-13 (MIT), 2 small patches: no tm_gmtoff on newlib; libbf compiled with CONFIG_BIGNUM
  third_party/stb/         stb_image / stb_image_write (public domain / MIT)
.github/workflows/build-3ds.yml   assets job (Node+Pillow) -> build job (devkitpro/devkitarm container) -> release
```

SD card layout at runtime (`SD:/3ds/OurSpringHours/`):

| file | contents |
|---|---|
| `osh-de_global.json` | endings found, backgrounds seen, carry-over state between parts (same JSON as the web `osh-de:global`) |
| `osh-de_auto.json`, `osh-de_slot_1..12.json` | saves |
| `osh3ds_cfg.txt` | `music sfx textspeed autospeed skipunread` (five integers) |
| `osh3ds_blossom.txt` | Blossom stats: `games best maxTier bestCombo merges lastChar` + best score per character |

Web saves are not shared with the 3DS (different device), but the file format is the same.

## Known limits / ideas

- Possible things to tune: load time (the story compiles at boot, shown as "Loading the story…"), frame rate in a full Blossom jar on an Old 3DS.
- Italics/bold are dropped (system font has none); text is the 3DS system font.
- Not ported: Versus mode, keepsake cards, gallery pictures, weather variety beyond petals/dust/rain/ash/embers/fireflies.
- Third-party: QuickJS © Fabrice Bellard & Charlie Gordon (MIT), stb by Sean Barrett, built on devkitPro / libctru / citro2d.
