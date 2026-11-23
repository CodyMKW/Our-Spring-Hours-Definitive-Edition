# GBA build. Needs: arm-none-eabi-gcc, node, python3 (+ pillow, numpy), gbafix (built from devkitPro/gba-tools in CI).
# make [GBAFIX=/path/to/gbafix]  ->  OurSpringHours.gba
CC      := arm-none-eabi-gcc
OBJCOPY := arm-none-eabi-objcopy
GBAFIX  ?= gbafix
FONT    ?= /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
ROOT    := ..
GEN     := build/gen
ARCH    := -mcpu=arm7tdmi -mthumb -mthumb-interwork
CFLAGS  := $(ARCH) -O2 -ffreestanding -fno-exceptions -fno-strict-aliasing -Wall -Wno-unused -Isource -I$(GEN) -Ibuild/assets -fomit-frame-pointer -ffunction-sections -fdata-sections
SRC     := $(wildcard source/*.c)
OBJ     := $(patsubst source/%.c,build/%.o,$(SRC)) build/story_data.o build/crt0.o build/assets.o
.PHONY: all clean
all: OurSpringHours.gba
$(GEN)/story_data.c: $(wildcard $(ROOT)/js/*.js $(ROOT)/js/story/*.js) tools/compile_story.js tools/fn_hash.txt
	mkdir -p $(GEN) && node tools/compile_story.js $(GEN)
build/assets/assets.bin: $(GEN)/story_data.c tools/build_assets_gba.py $(wildcard $(ROOT)/assets/*/*)
	python3 tools/build_assets_gba.py $(GEN) $(ROOT) $(FONT) build/assets
build/%.o: source/%.c $(GEN)/story_data.c build/assets/assets.bin $(wildcard source/*.h)
	@mkdir -p build && $(CC) $(CFLAGS) -c $< -o $@
build/story_data.o: $(GEN)/story_data.c
	@mkdir -p build && $(CC) $(CFLAGS) -c $< -o $@
build/crt0.o: source/crt0.s
	@mkdir -p build && $(CC) -mcpu=arm7tdmi -c $< -o $@
build/assets.o: source/assets.S build/assets/assets.bin
	$(CC) -mcpu=arm7tdmi -Ibuild/assets -Wa,-Ibuild/assets -c $< -o $@
build/OurSpringHours.elf: $(OBJ) gba.ld
	$(CC) $(ARCH) -nostdlib -T gba.ld -Wl,--gc-sections -Wl,-Map=build/OurSpringHours.map $(OBJ) -lgcc -o $@
OurSpringHours.gba: build/OurSpringHours.elf
	$(OBJCOPY) -O binary $< $@
	$(GBAFIX) $@ -t SPRING -cOSHA -mCM >/dev/null
	@ls -l $@
clean:
	rm -rf build OurSpringHours.gba
