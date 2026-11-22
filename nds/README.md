# Nintendo DS port (.nds)

Visual novel trilogy + Blossom Drop (no web Versus). Same game code as the 3DS port
(`3ds/source/*`, symlinked into `nds/source/`), with a DS-specific platform layer.

## Status
- Tested headlessly in DeSmuME: title, menus, VN dialogue, Blossom Drop character select + dropping orbs. ~15-17 fps.
- NOT yet tested: NDSWeb/EmulatorJS, real hardware.
- No audio yet (plat_sfx/plat_music are stubs).
- Saves: stored in cartridge backup memory if the emulator exposes a save chip, otherwise RAM only (lost on exit).

## Build (CI does this: .github/workflows/build-nds.yml -> release `nds-latest`)
1. `node 3ds/tools/bundle_story.js` -> story.js
2. `python3 3ds/tools/build_assets.py 3ds/build/gfx`
3. `python3 nds/tools/build_assets_ds.py GFX_DIR OUT_DIR FONT.ttf` -> RGB555 `.img` files + `font.bin` (DejaVu Sans)
4. copy OUT_DIR into `nds/nitrofs/`, then `make -C nds` (BlocksDS, image `skylyrac/blocksds:slim-latest`)
5. `python3 nds/tools/patch_nds.py nds/OurSpringHours.nds` (clears DSi header fields, fixes header CRC)

## Files
- `source/plat_ds.c`: software renderer into two 256x192 RGB555 buffers (DMA to VRAM each frame), fixed-point shapes, text from font.bin, input, saves.
- `source/main.c`: boot, runs QuickJS (story) on a 320 KB heap stack.
- `source/nds_compat.h`: force-included libm constants.
- `tools/`: asset conversion and ROM patching.

## .img format
u8 fmt (0 = RGB555 opaque, 1 = RGB555 + A8 plane), u8 pad, u16 logical w,h, u16 stored w,h, pixels (bit15 set), optional alpha plane.

## Controls
D-pad/A/B/X/Y/L/R/Start as on 3DS; touch screen coordinates are scaled 0.8x to the 3DS layout.
