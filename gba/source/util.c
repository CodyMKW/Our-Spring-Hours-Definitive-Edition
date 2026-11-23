#include "gba.h"
u16 keys_held, keys_down, keys_up;
void *memcpy(void *d, const void *s, unsigned n) { u8 *a = d; const u8 *b = s; while (n--) *a++ = *b++; return d; }
void *memset(void *d, int c, unsigned n) { u8 *a = d; while (n--) *a++ = c; return d; }
int strlen(const char *s) { int n = 0; while (s[n]) n++; return n; }
void vram_copy(volatile void *dst, const void *src, unsigned bytes) {
    REG_DMA3SAD = (u32)src; REG_DMA3DAD = (u32)dst; REG_DMA3CNT = (bytes >> 1) | 0x80000000u;   /* 16-bit, immediate */
    __asm__ volatile("nop\n nop");
}
void vsync(void) { while (REG_VCOUNT >= 160) {} while (REG_VCOUNT < 160) {} }
void input_poll(void) { u16 k = ~REG_KEYINPUT & 0x3FF; keys_down = k & ~keys_held; keys_up = keys_held & ~k; keys_held = k; }
char *scat(char *d, const char *t) { while (*t) *d++ = *t++; *d = 0; return d; }
char *snum(char *d, int v) { char t[12]; int n = 0; if (v < 0) { *d++ = '-'; v = -v; } do { t[n++] = '0' + v % 10; v /= 10; } while (v); while (n) *d++ = t[--n]; *d = 0; return d; }
