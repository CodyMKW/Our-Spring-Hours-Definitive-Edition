/* plat.h — the thin platform layer. Two implementations:
 *   plat_3ds.c  (libctru + citro2d + ndsp)   — the real thing, built with devkitARM
 *   plat_sdl.c  (SDL2 + SDL2_ttf)            — a desktop harness used to test the game logic and take screenshots
 * Everything else (VN screens, Blossom Drop, menus) only talks to this header. */
#ifndef PLAT_H
#define PLAT_H
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#define TOP_W 400
#define BOT_W 320
#define SCR_H 240

/* colours are 0xRRGGBBAA */
#define RGBA(r, g, b, a) (((uint32_t)(r) << 24) | ((uint32_t)(g) << 16) | ((uint32_t)(b) << 8) | (uint32_t)(a))
#define RGB(r, g, b) RGBA(r, g, b, 255)
#define COL_A(c) ((c) & 255)
static inline uint32_t col_alpha(uint32_t c, float a) { float v = (float)(c & 255) * a; if (v < 0) v = 0; if (v > 255) v = 255; return (c & 0xFFFFFF00u) | (uint32_t)(v + 0.5f); }
uint32_t col_hex(const char *s);            /* "#rrggbb" -> colour */

/* buttons (bit mask, same on both backends) */
enum { K_A = 1, K_B = 2, K_X = 4, K_Y = 8, K_L = 16, K_R = 32, K_START = 64, K_SELECT = 128, K_UP = 256, K_DOWN = 512, K_LEFT = 1024, K_RIGHT = 2048, K_ZL = 4096, K_ZR = 8192 };

typedef struct {
    uint32_t down, held, up;      /* buttons: pressed this frame / held / released this frame */
    bool touch_down, touch_held, touch_up;
    int tx, ty;                   /* touch position on the bottom screen (last known) */
    int dx, dy;                   /* touch movement since last frame while held */
} Input;

typedef struct Img Img;           /* an image (background / sprite / sheet), owned by the platform layer */

bool plat_init(int argc, char **argv);
void plat_exit(void);
bool plat_frame_begin(void);      /* false => the app should quit (HOME / window closed) */
void plat_frame_end(void);
void plat_target(int screen);     /* 0 = top (400x240), 1 = bottom (320x240) — all drawing goes to the current target */
const Input *plat_input(void);
uint64_t plat_time_ms(void);

/* images: name is e.g. "bg_hallway" or "ch_cody" — loaded from romfs:/gfx/NAME.t3x (3DS) or gfx/NAME.png (desktop) */
Img *plat_img_load(const char *name);            /* NULL if missing */
void plat_img_free(Img *im);
int plat_img_w(const Img *im);
int plat_img_h(const Img *im);
size_t plat_img_bytes(const Img *im);             /* memory the picture occupies (used for the DS image-cache budget) */
/* draw with top-left at (x,y), scaled, rotated about its centre (radians), modulated by colour (alpha = opacity) */
void plat_img_draw(const Img *im, float x, float y, float sx, float sy, float rot, uint32_t tint);
/* draw only the sub-rectangle (srcx,srcy,srcw,srch) of the image into a w x h box */
void plat_img_draw_part(const Img *im, int srcx, int srcy, int srcw, int srch, float x, float y, float w, float h, uint32_t tint);

void plat_rect(float x, float y, float w, float h, uint32_t col);
void plat_rect_grad(float x, float y, float w, float h, uint32_t top, uint32_t bottom);   /* vertical gradient */
void plat_rrect(float x, float y, float w, float h, float r, uint32_t col);               /* rounded rectangle */
void plat_rrect_line(float x, float y, float w, float h, float r, uint32_t col);
void plat_circle(float x, float y, float r, uint32_t col);
void plat_ring(float x, float y, float r, float thick, uint32_t col);
void plat_line(float x0, float y0, float x1, float y1, float thick, uint32_t col);

/* text: `size` is the line height in pixels (the 3DS system font is ~30px at scale 1). UTF-8. */
enum { T_LEFT = 0, T_CENTER = 1, T_RIGHT = 2, T_SHADOW = 4 };
void plat_text(float x, float y, float size, uint32_t col, int flags, const char *utf8);
float plat_text_w(float size, const char *utf8);
/* word-wrap helper (works on any backend): fills line break byte offsets, returns number of lines */
int text_wrap(float size, float maxw, const char *s, int *starts, int *ends, int maxlines);

/* persistence (SD card on 3DS, ./save_test on desktop). name e.g. "osh-de_global.json" */
bool plat_store_read(const char *name, char **data, size_t *len);   /* caller frees *data */
bool plat_store_write(const char *name, const char *data, size_t len);
void plat_store_remove(const char *name);

/* assets shipped with the app (story.js): romfs:/NAME or ./romfs/NAME */
bool plat_asset_read(const char *name, char **data, size_t *len);

/* audio (procedural, no files) */
void plat_sfx(const char *name);
void plat_music(const char *mood);   /* NULL = stop */
void plat_set_volume(float music, float sfx);
void plat_log(const char *fmt, ...);
#endif
