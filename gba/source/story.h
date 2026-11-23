/* story.h — compiled story format + VN state. Data comes from gba/tools/compile_story.js. */
#pragma once
typedef unsigned char u8; typedef signed char s8; typedef unsigned short u16; typedef signed short s16;
typedef unsigned int u32; typedef signed int s32;
#include "story_ids.h"

#define NONE 0xFFFF
enum { OP_SAY = 1, OP_SAYF, OP_N, OP_NF, OP_BG, OP_MUSIC, OP_WEATHER, OP_CHAPTER, OP_CARD, OP_SHAKE, OP_FLASH, OP_PULSE, OP_WAIT,
       OP_ADD = 15, OP_SET, OP_KILL, OP_FN, OP_JUMP, OP_BRANCH, OP_ROUTE, OP_END, OP_MENU, OP_ADDF };
enum { ST_URA, ST_FRI, ST_FAL, ST_MAKI, ST_LIGHT, ST_ALOOF };

typedef struct { u16 label, title, kind, part, bg, mood, wx, hint, nlines; const u16 *lines; } EndDef;

extern const u16 story_code[]; extern const u32 story_label_off[]; extern const u32 story_str_off[];
extern const char story_pool[]; extern const u16 story_nlabels, story_nstr; extern const u32 story_ncode;
extern const EndDef story_ends[]; extern const u8 story_nends;

/* Everything a save needs (also the rollback snapshot). */
typedef struct {
    u8 part; s8 aloof; s8 stats[5];
    u8 flags[N_FLAGS];
    u16 dead;                 /* bit per CH_ id */
    u8 hist[4];               /* ending index reached per part (0xFF none) */
    u16 label, idx;
    u8 bg, mood, wx, nstage; u8 stage[4];
    u16 chapter_t, chapter_s; /* string ids of the current chapter banner */
    u16 lines;
} VNState;

static inline const char *story_str(u16 id) { return story_pool + story_str_off[id]; }

/* story_fn.c — hand-ported JS callbacks (conditions, routes, dynamic text) */
int fn_cond(u16 id, const VNState *s);
u16 fn_route(u16 id, VNState *s);
const char *fn_text(u16 id, VNState *s, char *buf);   /* buf >= 512 bytes */
const char *story_cast_line(const VNState *s, int idx, int *ok);
int story_dead_count(const VNState *s);
