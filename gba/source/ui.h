#pragma once
#include "render.h"
#include "save.h"
/* blocking helpers; each loops with vsync until the user answers */
int ui_list(const char *title, const char *const *items, int n, int sel, int allow_back);   /* returns index or -1 */
void ui_frame_end(void);                  /* vsync + input poll + per-frame sprites/fx */
void ui_message(const char *a, const char *b);
void ui_fade(int out);                    /* quick fade to/from black */
extern int ui_bg_current;
void ui_show_bg(int bg);                  /* load bg into fb (with a short fade if changing) */

/* vn.c */
void vn_new_game(int part, int preset);    /* preset: -1 carry, 0 none, 1.. preset index */
int vn_load_slot(int slot);
void vn_play(void);                        /* runs until the player returns to the title */
int vn_bonus_unlocked(void);
int vn_part_unlocked(int part);
int vn_latest_slot(void);
const char *vn_preset_title(int part, int idx);
int vn_preset_count(int part);
void vn_snippet(char *buf, int slot);
void vn_chapter_text(char *buf, const VNState *s);
