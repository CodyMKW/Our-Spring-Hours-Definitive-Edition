#!/bin/sh
# Desktop test harness build (needs SDL2 + SDL2_ttf dev packages). Output: 3ds/build/osh_sdl
set -e
cd "$(dirname "$0")/.."
mkdir -p build/sdl
Q=third_party/quickjs
FL="-O1 -w -DEMSCRIPTEN -D_GNU_SOURCE"
[ build/sdl/quickjs.o -nt $Q/quickjs.c ] || cc $FL -DOSH_NO_TZ -DCONFIG_VERSION=\"2024-01-13\" -I$Q -c $Q/quickjs.c -o build/sdl/quickjs.o
for f in libregexp libunicode cutils libbf; do [ build/sdl/$f.o -nt $Q/$f.c ] || cc $FL -I$Q -c $Q/$f.c -o build/sdl/$f.o; done
cc -O1 -g -Wall -Wno-unused -Wno-misleading-indentation -D_GNU_SOURCE -I$Q -Ithird_party/stb -Isource -Isource_sdl $(sdl2-config --cflags) \
  source/synth.c source/main.c source/js.c source/common.c source/ui.c source/vn.c source/title.c source/blossom.c source_sdl/plat_sdl.c \
  build/sdl/*.o -o build/osh_sdl $(sdl2-config --libs) -lSDL2_ttf -lm
echo built build/osh_sdl
