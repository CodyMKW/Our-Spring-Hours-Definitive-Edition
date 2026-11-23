#pragma once
#include "gba.h"
typedef struct { u8 used; u8 pad; u16 snip; u32 stamp; VNState st; } Slot;      /* 0 = autosave, 1..12 manual */
typedef struct {
    u32 magic, stamp, endings;           /* endings: bit per story_ends index */
    u8 carry_valid;                      /* bit n-1: part n finished at least once */
    u8 textspeed, skipunread, music;
    VNState carry[3];
    u8 seen[(3900 + 7) / 8];
    u16 bd_best[12]; u32 bd_flags;       /* Blossom Drop records / unlocks */
} Global;
extern Global G; extern Slot slots[13];
void save_init(void);                    /* load from SRAM (or format it) */
void save_global(void);
void save_slot(int i);
int seen_get(u32 wordoff); void seen_set(u32 wordoff);
