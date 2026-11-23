# Game Boy Advance port (.gba)

Visual novel trilogy + bonus story + Blossom Drop (solo; Versus stays web-only). Download `OurSpringHours.gba` from the
[gba-latest release](../../releases/tag/gba-latest).

## Status
- Tested in mGBA (headless harness): title, Part I playthrough, choices, endings, saves menu, all 9 Blossom Drop characters and abilities. Blossom Drop runs ~50+ fps.
- NOT tested on real hardware or in EmulatorJS. Saves use 32 KB SRAM (`SRAM_V113` tag in the ROM).
- No sound yet. Not ported: keepsake cards, Memories gallery, backlog, Versus.

## Controls
VN: A advance/confirm, hold B skip read text, L rewind, R auto-play, Start pause menu (save/load/settings).
Blossom Drop: D-pad aim (hold R = fast), A drop, B ability when the meter is full, Start pause. Decree: Left/Right choose, A confirm. Decay: D-pad pick orb, A crumble.

## How it works
QuickJS can't fit in 256 KB of RAM, so the story is compiled at build time:
1. `tools/compile_story.js` runs the web story files (`js/story/*.js`, unmodified) in node and writes `build/gen/story_data.c` (bytecode, strings, endings),
   `story_ids.h` (flag/value/character/background ids), `bd_data.c` (Blossom Drop tiers/characters).
2. JS callbacks (conditions, routes, dynamic text: 72 of them) cannot be compiled, so they are hand-ported in `source/story_fn.c`,
   indexed in the order listed in `build/gen/story_fn.txt`. `tools/fn_hash.txt` holds a hash of all callback sources: if you change story logic, the build fails until you port the change and update the hash.
3. `tools/build_assets_gba.py GEN ROOT FONT OUT` converts art: backgrounds 240x135 8-bit (192 colours + UI palette), characters 64x96 4-bit OBJ sprites, orb sprites (drawn in the script), 9 px DejaVu Sans font (2-bit AA, glyph table).
4. `make -C gba GBAFIX=/path/to/gbafix` (needs `arm-none-eabi-gcc`, node, python3 with pillow+numpy). No libgba/devkitPro needed; `gbafix` comes from devkitPro/gba-tools.

## Files (`source/`)
`crt0.s` startup + header, `render.c` mode-4 framebuffer/text/sprites/weather, `vn.c` interpreter + screens, `story_fn.c` ported callbacks, `bd.c` Blossom Drop (PBD circle physics in IWRAM), `save.c` SRAM, `ui.c` menus, `main.c` title.

## Test builds
`make EXTRA="-DBD_TEST -DBD_START_METER=1000 -DBD_TEST_CHAR=3"` unlocks all characters, fills the ability meter and jumps into character 3.
