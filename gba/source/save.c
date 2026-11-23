#include "save.h"
Global G EWRAM; Slot slots[13] EWRAM;
#define MAGIC 0x3248534F   /* "OSH2" */
static void sw(u32 off, const void *p, u32 n) { const u8 *s = p; for (u32 i = 0; i < n; i++) SRAM[off + i] = s[i]; }
static void sr(u32 off, void *p, u32 n) { u8 *d = p; for (u32 i = 0; i < n; i++) d[i] = SRAM[off + i]; }
#define OFF_G 0
#define OFF_S (((sizeof(Global) + 15) & ~15u))
void save_init(void) {
    REG_WAITCNT |= 3;                        /* SRAM wait states */
    sr(OFF_G, &G, sizeof G);
    if (G.magic != MAGIC) {
        memset(&G, 0, sizeof G); memset(slots, 0, sizeof slots);
        G.magic = MAGIC; G.textspeed = 2; G.skipunread = 0; G.music = 1;
        sw(OFF_G, &G, sizeof G); sw(OFF_S, slots, sizeof slots);
    } else sr(OFF_S, slots, sizeof slots);
}
void save_global(void) { sw(OFF_G, &G, sizeof G); }
void save_slot(int i) { sw(OFF_S + i * sizeof(Slot), &slots[i], sizeof(Slot)); }
int seen_get(u32 w) { return (G.seen[w >> 3] >> (w & 7)) & 1; }
void seen_set(u32 w) { G.seen[w >> 3] |= 1 << (w & 7); }
