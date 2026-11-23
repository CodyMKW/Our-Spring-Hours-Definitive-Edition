#pragma once
#include "gba.h"
/* Palette layout (BG): 0..191 artwork, 192.. UI. text ramps: RAMP(k)+0..3 = alpha 0..3 over the ramp's fill colour. */
enum { RAMP_WHITE, RAMP_DIM, RAMP_GOLD, RAMP_SEL, RAMP_DARK_WHITE, RAMP_DARK_GOLD, RAMP_NAME0, N_RAMPS = RAMP_NAME0 + N_CH };
#define RAMP(k) (193 + 4 * (k))
#define COL_BOX 192
#define COL_BLACK 253
#define COL_ACCENT 254
#define COL_WHITE 255
#define BOX_Y 108
#define ART_H 135

extern u8 fb[W * H];
void gfx_init(void);
void fb_flush(int y0, int y1);            /* copy rows [y0,y1) to VRAM (call right after vsync for no tearing) */
void fb_fill(int x, int y, int w, int h, u8 c);
void fb_rect_frame(int x, int y, int w, int h, u8 c);
void bg_load(int bgid);                   /* palette + pixels into fb rows 0..134, rest black; UI palette entries restored */
void ui_palette(void);
int text_w(const char *s);                /* width of one line (stops at '\n') */
int text_draw(int x, int y, const char *s, int ramp, int maxx);   /* returns end x. skips '*' */
int text_draw_n(int x, int y, const char *s, int n, int ramp);    /* first n glyph-cells */
void text_center(int cx, int y, const char *s, int ramp);
void text_draw2x(int cx, int y, const char *s, int ramp);          /* pixel-doubled, centred */
int text_wrap(const char *s, int maxw, const char **start, u8 *len, int maxlines);    /* returns line count; lines are s-relative ranges */
void tbox_draw(void);                     /* text box background */

/* sprites */
void spr_init(void);
void spr_hide_all(void);
void stage_set(const u8 *chars, int n, int speaker);   /* chars: CH_ ids (max 3 shown), speaker CH_ or -1 */
void weather_set(int wx);                 /* WX_ id or 0xFFFF */
void weather_step(void);
void fx_flash(u16 colorUnused);
void fx_shake(int strength);
void fx_step(void);
void obj_enable(int on);
extern int gfx_faded;
