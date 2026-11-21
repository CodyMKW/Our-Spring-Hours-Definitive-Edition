#---------------------------------------------------------------------------------
# Our Spring Hours — Definitive Edition (3DS homebrew).  Build:  make   ->  OurSpringHours.3dsx
# Needs devkitARM + libctru + citro2d + citro3d + tex3ds (dkp-pacman -S 3ds-dev).
# romfs/ must contain story.js and gfx/*.t3x first — see 3ds/README.md (CI does this for you).
#---------------------------------------------------------------------------------
.SUFFIXES:
ifeq ($(strip $(DEVKITARM)),)
$(error "Please set DEVKITARM in your environment. export DEVKITARM=<path to>devkitARM")
endif
TOPDIR ?= $(CURDIR)
include $(DEVKITARM)/3ds_rules

TARGET      := OurSpringHours
BUILD       := build_3ds
SOURCES     := source third_party/quickjs
DATA        :=
INCLUDES    := source third_party/quickjs third_party/stb
ROMFS       := romfs

APP_TITLE       := Our Spring Hours
APP_DESCRIPTION := Definitive Edition + Blossom Drop
APP_AUTHOR      := CodyMKW
APP_ICON        := $(TOPDIR)/icon.png

ARCH    := -march=armv6k -mtune=mpcore -mfloat-abi=hard -mtp=soft
CFLAGS  := -g -O2 -ffunction-sections -fno-strict-aliasing -mword-relocations $(ARCH) \
           -D__3DS__ -DEMSCRIPTEN -DOSH_NO_TZ -D_GNU_SOURCE '-DCONFIG_VERSION="2024-01-13"' -Wall -Wno-unused-function -Wno-unused-variable -Wno-misleading-indentation \
           -Wno-implicit-fallthrough -Wno-sign-compare -Wno-unused-but-set-variable -Wno-array-bounds -Wno-incompatible-pointer-types -Wno-int-conversion -Wno-format-truncation -Wno-stringop-truncation -Wno-unused-parameter -Wno-missing-field-initializers
CFLAGS  += $(INCLUDE)
CXXFLAGS := $(CFLAGS) -fno-rtti -fno-exceptions -std=gnu++11
ASFLAGS := -g $(ARCH)
LDFLAGS  = -specs=3dsx.specs -g $(ARCH) -Wl,-Map,$(notdir $*.map)
LIBS    := -lcitro2d -lcitro3d -lctru -lm
LIBDIRS := $(PORTLIBS) $(CTRULIB)

ifneq ($(BUILD),$(notdir $(CURDIR)))
export OUTPUT := $(CURDIR)/$(TARGET)
export TOPDIR := $(CURDIR)
export VPATH  := $(foreach dir,$(SOURCES),$(CURDIR)/$(dir))
export DEPSDIR := $(CURDIR)/$(BUILD)
CFILES   := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.c)))
export OFILES := $(CFILES:.c=.o)
export LD := $(CC)
export INCLUDE := $(foreach dir,$(INCLUDES),-I$(CURDIR)/$(dir)) $(foreach dir,$(LIBDIRS),-I$(dir)/include) -I$(CURDIR)/$(BUILD)
export LIBPATHS := $(foreach dir,$(LIBDIRS),-L$(dir)/lib)
export _3DSXFLAGS += --smdh=$(CURDIR)/$(TARGET).smdh
ifneq ($(ROMFS),)
export _3DSXFLAGS += --romfs=$(CURDIR)/$(ROMFS)
endif
.PHONY: all clean
all:
	@mkdir -p $(BUILD)
	@$(MAKE) --no-print-directory -C $(BUILD) -f $(CURDIR)/Makefile
clean:
	@echo clean ...
	@rm -fr build_3ds $(TARGET).3dsx $(TARGET).smdh $(TARGET).elf
else
DEPENDS := $(OFILES:.o=.d)
$(OUTPUT).3dsx : $(OUTPUT).elf $(OUTPUT).smdh
$(OUTPUT).elf  : $(OFILES)
-include $(DEPENDS)
endif
