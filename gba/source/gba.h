/* gba.h — minimal GBA hardware definitions (no libgba/devkitPro needed). */
#pragma once
#include "story.h"
#define REG16(a) (*(volatile u16 *)(a))
#define REG32(a) (*(volatile u32 *)(a))
#define REG_DISPCNT  REG16(0x04000000)
#define REG_DISPSTAT REG16(0x04000004)
#define REG_VCOUNT   REG16(0x04000006)
#define REG_BG0CNT   REG16(0x04000008)
#define REG_BG1CNT   REG16(0x0400000A)
#define REG_BG2CNT   REG16(0x0400000C)
#define REG_BG0HOFS  REG16(0x04000010)
#define REG_BG0VOFS  REG16(0x04000012)
#define REG_BG1HOFS  REG16(0x04000014)
#define REG_BG1VOFS  REG16(0x04000016)
#define REG_BG2PA    REG16(0x04000020)
#define REG_BG2PB    REG16(0x04000022)
#define REG_BG2PC    REG16(0x04000024)
#define REG_BG2PD    REG16(0x04000026)
#define REG_BG2X     REG32(0x04000028)
#define REG_BG2Y     REG32(0x0400002C)
#define REG_BLDCNT   REG16(0x04000050)
#define REG_BLDALPHA REG16(0x04000052)
#define REG_BLDY     REG16(0x04000054)
#define REG_KEYINPUT REG16(0x04000130)
#define REG_IME      REG16(0x04000208)
#define REG_IE       REG16(0x04000200)
#define REG_IF       REG16(0x04000202)
#define REG_WAITCNT  REG16(0x04000204)
#define REG_DMA3SAD  REG32(0x040000D4)
#define REG_DMA3DAD  REG32(0x040000D8)
#define REG_DMA3CNT  REG32(0x040000DC)
#define REG_TM0CNT_L REG16(0x04000100)
#define REG_TM0CNT_H REG16(0x04000102)
#define REG_TM1CNT_L REG16(0x04000104)
#define REG_TM1CNT_H REG16(0x04000106)
#define PAL_BG  ((volatile u16 *)0x05000000)
#define PAL_OBJ ((volatile u16 *)0x05000200)
#define VRAM    ((volatile u16 *)0x06000000)
#define VRAM_OBJ_M4 ((volatile u16 *)0x06014000)
#define OAM     ((volatile u16 *)0x07000000)
#define SRAM    ((volatile u8 *)0x0E000000)

enum { KEY_A = 1, KEY_B = 2, KEY_SELECT = 4, KEY_START = 8, KEY_RIGHT = 16, KEY_LEFT = 32, KEY_UP = 64, KEY_DOWN = 128, KEY_R = 256, KEY_L = 512 };
#define W 240
#define H 160
#define IWRAM_CODE __attribute__((section(".iwram"), long_call, target("arm")))
#define EWRAM __attribute__((section(".ewram")))

/* assets.S */
extern const u8 assets_bin[];
#include "assets.h"

/* util.c */
void *memcpy(void *d, const void *s, unsigned n);
void *memset(void *d, int c, unsigned n);
int strlen(const char *s);
void vram_copy(volatile void *dst, const void *src, unsigned bytes);   /* DMA3, halfword */
void vsync(void);
static inline u32 rd16(const u8 *p) { return p[0] | (p[1] << 8); }
static inline u32 rd32(const u8 *p) { return p[0] | (p[1] << 8) | (p[2] << 16) | ((u32)p[3] << 24); }

/* input */
extern u16 keys_held, keys_down, keys_up;
void input_poll(void);
char *scat(char *d, const char *t);
char *snum(char *d, int v);
