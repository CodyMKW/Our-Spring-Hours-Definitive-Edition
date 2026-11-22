# Our Spring Hours — Nintendo DS port (BlocksDS). Build: `make` inside the blocksds container (see ../.github/workflows/build-nds.yml)
BLOCKSDS	?= /opt/blocksds/core
BLOCKSDSEXT	?= /opt/blocksds/external

NAME		:= OurSpringHours
GAME_TITLE	:= Our Spring Hours
GAME_SUBTITLE	:= Definitive Edition + Blossom Drop
GAME_AUTHOR	:= CodyMKW
SOURCEDIRS	:= source
INCLUDEDIRS	:= source
NITROFSDIR	:= nitrofs

DEFINES		:= -DEMSCRIPTEN -DOSH_NO_TZ -D_GNU_SOURCE '-DCONFIG_VERSION="2024-01-13"' -DOSH_DS -include nds_compat.h \
		   -Wno-unused-function -Wno-unused-variable -Wno-misleading-indentation -Wno-implicit-fallthrough -Wno-sign-compare \
		   -Wno-unused-but-set-variable -Wno-array-bounds -Wno-incompatible-pointer-types -Wno-int-conversion \
		   -Wno-format-truncation -Wno-stringop-truncation -Wno-unused-parameter -Wno-missing-field-initializers

include $(BLOCKSDS)/sys/default_makefiles/rom_arm9/Makefile
