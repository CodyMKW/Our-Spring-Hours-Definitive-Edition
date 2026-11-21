#ifndef GAME_H
#define GAME_H
#include "plat.h"

/* ---- user settings (saved to osh3ds_cfg.json as simple key=value lines) */
typedef struct { int music, sfx, textspeed, autospeed, skipunread, sky; } Cfg;   /* volumes 0..10, speeds 1..3 */
extern Cfg cfg;
void cfg_load(void);
void cfg_save(void);

/* ---- shared UI (ui.c) */
bool ui_hit(int x, int y, int w, int h);                 /* touch started inside this rect (bottom screen) */
bool ui_touching(int x, int y, int w, int h);
void ui_backdrop_draw(float t);                          /* animated spring backdrop on the CURRENT target */
void ui_panel(float x, float y, float w, float h, uint32_t col);
bool ui_button(float x, float y, float w, float h, const char *label, bool focus, uint32_t col, float size);
void ui_text_box(float x, float y, float w, float size, uint32_t col, const char *s, int maxlines);   /* wrapped text */
/* blocking list menu. details[] (optional) is shown on the top screen for the selected row. Returns index, -1 = cancelled */
int ui_menu(const char *title, const char *sub, const char **items, const char **details, int n, int start);
void ui_petal(float x, float y, float r, float rot, uint32_t col);
void ui_card(float x, float y, float w, float h, float r, uint32_t col);
void ui_bg_bottom(float t);
void ui_fade_edges(void);
Img *img_get(const char *name);                          /* cached load: "bg_hallway", "ch_cody" */
void img_trim(void);
extern Img *ui_art;                                      /* optional picture for the top screen of ui_menu */
extern float ui_time;
bool ui_frame(void);                                     /* plat_frame_end()+plat_frame_begin() + time step; false => quit */

/* ---- screens */
void vn_play(void);                                      /* runs the story until the player returns to the title */
void vn_options(void);
void blossom_play(void);
void credits_play(void);
void gallery_play(void);
extern bool g_quit;
void story_progress(char *buf, size_t n);                /* "id,id,...|spared" */
#endif
