/* plat_sdl.c — desktop harness (SDL2 + SDL2_ttf + stb_image). Same drawing model as the 3DS build: a 400x240 top
 * screen and a 320x240 bottom screen, shown stacked in one window. A scriptable input mode (--script) lets the
 * game be driven and screenshotted without a display (SDL_VIDEODRIVER=dummy).
 *   --script "a,a,w5,t160:200,shot:out.png,quit"   keys: a b x y l r start select up down left right
 *   --font PATH   TTF to use (default: first found)   --romfs DIR   --gfx DIR   --save DIR */
#include "plat.h"
#include <SDL.h>
#include <SDL_ttf.h>
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

static SDL_Window *win; static SDL_Renderer *ren; static SDL_Texture *scr[2]; static int cur = 0;
static Input in; static char romfs[512] = "3ds/romfs", gfxdir[512] = "3ds/build/gfx", savedir[512] = "save_test";
static char **script; static int nscript, spos, waitf, pendkey_hold; static uint32_t scriptkeys; static bool quit_req;
static const char *shotpath;
struct Img { SDL_Texture *t; int w, h; };
static TTF_Font *fonts[200]; static const char *fontpath;

void plat_log(const char *f, ...) { va_list a; va_start(a, f); vfprintf(stderr, f, a); fputc('\n', stderr); va_end(a); }
static TTF_Font *font(float size) {
    int s = (int)(size * 0.92f + 0.5f); if (s < 6) s = 6; if (s > 199) s = 199;
    if (!fonts[s]) fonts[s] = TTF_OpenFont(fontpath, s);
    return fonts[s];
}
static const char *CANDS[] = { "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/google-fonts/ofl/opensans/OpenSans[wdth,wght].ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", NULL };
static uint32_t gettime(void) { return SDL_GetTicks(); }
uint64_t plat_time_ms(void) { return gettime(); }

bool plat_init(int argc, char **argv) {
    const char *script_s = NULL;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--script") && i + 1 < argc) script_s = argv[++i];
        else if (!strcmp(argv[i], "--font") && i + 1 < argc) fontpath = argv[++i];
        else if (!strcmp(argv[i], "--romfs") && i + 1 < argc) strncpy(romfs, argv[++i], 500);
        else if (!strcmp(argv[i], "--gfx") && i + 1 < argc) strncpy(gfxdir, argv[++i], 500);
        else if (!strcmp(argv[i], "--save") && i + 1 < argc) strncpy(savedir, argv[++i], 500);
    }
    if (SDL_Init(SDL_INIT_VIDEO) != 0) { plat_log("SDL: %s", SDL_GetError()); return false; }
    TTF_Init();
    for (int i = 0; !fontpath && CANDS[i]; i++) { FILE *f = fopen(CANDS[i], "rb"); if (f) { fclose(f); fontpath = CANDS[i]; } }
    win = SDL_CreateWindow("Our Spring Hours (desktop harness)", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, 400 * (script_s ? 1 : 2), 480 * (script_s ? 1 : 2), 0);
    ren = SDL_CreateRenderer(win, -1, SDL_RENDERER_SOFTWARE);
    if (!ren) { plat_log("renderer: %s", SDL_GetError()); return false; }
    SDL_RenderSetLogicalSize(ren, 400, 480);
    SDL_SetRenderDrawBlendMode(ren, SDL_BLENDMODE_BLEND);
    scr[0] = SDL_CreateTexture(ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_TARGET, 400, 240);
    scr[1] = SDL_CreateTexture(ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_TARGET, 320, 240);
    mkdir(savedir, 0777);
    if (script_s) {
        char *d = strdup(script_s); script = calloc(8192, sizeof(char *));
        for (char *t = strtok(d, ","); t && nscript < 8192; t = strtok(NULL, ",")) script[nscript++] = t;
    }
    return true;
}
void plat_exit(void) { SDL_Quit(); }

static uint32_t keybit(const char *n) {
    static const struct { const char *n; uint32_t b; } T[] = { {"a",K_A},{"b",K_B},{"x",K_X},{"y",K_Y},{"l",K_L},{"r",K_R},{"start",K_START},{"select",K_SELECT},{"up",K_UP},{"down",K_DOWN},{"left",K_LEFT},{"right",K_RIGHT},{"zl",K_ZL},{"zr",K_ZR} };
    for (unsigned i = 0; i < sizeof T / sizeof *T; i++) if (!strcmp(n, T[i].n)) return T[i].b;
    return 0;
}
static void save_shot(const char *path) {
    SDL_Surface *s = SDL_CreateRGBSurfaceWithFormat(0, 400, 480, 32, SDL_PIXELFORMAT_RGBA32);
    SDL_RenderReadPixels(ren, NULL, SDL_PIXELFORMAT_RGBA32, s->pixels, s->pitch);
    stbi_write_png(path, 400, 480, 4, s->pixels, s->pitch); SDL_FreeSurface(s);
}
static bool shot_pending; static char shot_name[256];

bool plat_frame_begin(void) {
    uint32_t prevh = in.held; bool pth = in.touch_held;
    SDL_Event e; while (SDL_PollEvent(&e)) if (e.type == SDL_QUIT) quit_req = true;
    uint32_t held = 0; bool th = false; int tx = in.tx, ty = in.ty;
    if (script) {
        if (waitf > 0) waitf--;
        else if (pendkey_hold > 0) { pendkey_hold--; if (pendkey_hold == 0) waitf = 1; held = scriptkeys; th = in.touch_held && pendkey_hold > 0 && (scriptkeys == 0); }
        else {
            scriptkeys = 0;
            if (spos >= nscript) quit_req = true;
            else {
                char *t = script[spos++];
                if (t[0] == 'w') waitf = atoi(t + 1);
                else if (!strncmp(t, "shot:", 5)) { shot_pending = true; strncpy(shot_name, t + 5, 255); waitf = 1; }
                else if (!strcmp(t, "quit")) quit_req = true;
                else if (t[0] == 't' && strchr(t, ':')) { tx = atoi(t + 1); ty = atoi(strchr(t, ':') + 1); th = true; pendkey_hold = 2; scriptkeys = 0; }
                else if (t[0] == 'd' && strchr(t, ':')) { /* drag: dX:Y start (held until next token) */ tx = atoi(t + 1); ty = atoi(strchr(t, ':') + 1); th = true; pendkey_hold = 1; }
                else { scriptkeys = keybit(t); held = scriptkeys; pendkey_hold = 2; }
            }
        }
    }
    in.down = held & ~prevh; in.up = prevh & ~held; in.held = held;
    in.touch_down = th && !pth; in.touch_up = !th && pth; in.touch_held = th;
    if (th) { in.dx = tx - in.tx; in.dy = ty - in.ty; in.tx = tx; in.ty = ty; if (!pth) in.dx = in.dy = 0; } else in.dx = in.dy = 0;
    SDL_SetRenderTarget(ren, scr[0]); SDL_SetRenderDrawColor(ren, 0, 0, 0, 255); SDL_RenderClear(ren);
    SDL_SetRenderTarget(ren, scr[1]); SDL_RenderClear(ren);
    cur = 0; SDL_SetRenderTarget(ren, scr[0]);
    return !quit_req;
}
void plat_frame_end(void) {
    SDL_SetRenderTarget(ren, NULL); SDL_SetRenderDrawColor(ren, 20, 20, 24, 255); SDL_RenderClear(ren);
    SDL_Rect a = { 0, 0, 400, 240 }, b = { 40, 240, 320, 240 };
    SDL_RenderCopy(ren, scr[0], NULL, &a); SDL_RenderCopy(ren, scr[1], NULL, &b);
    if (shot_pending) { save_shot(shot_name); shot_pending = false; plat_log("shot %s", shot_name); }
    SDL_RenderPresent(ren);
    if (!script) SDL_Delay(16);
}
void plat_target(int s) { cur = s; SDL_SetRenderTarget(ren, scr[s]); }
const Input *plat_input(void) { return &in; }

/* ---- images */
Img *plat_img_load(const char *name) {
    char p[1024]; snprintf(p, sizeof p, "%s/%s.png", gfxdir, name);
    int w, h, n; unsigned char *px = stbi_load(p, &w, &h, &n, 4); if (!px) return NULL;
    Img *im = calloc(1, sizeof *im); im->w = w; im->h = h;
    im->t = SDL_CreateTexture(ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC, w, h);
    SDL_UpdateTexture(im->t, NULL, px, w * 4); SDL_SetTextureBlendMode(im->t, SDL_BLENDMODE_BLEND);
    stbi_image_free(px); return im;
}
void plat_img_free(Img *im) { if (im) { SDL_DestroyTexture(im->t); free(im); } }
int plat_img_w(const Img *im) { return im->w; }
int plat_img_h(const Img *im) { return im->h; }
static void tint_set(SDL_Texture *t, uint32_t c) { SDL_SetTextureColorMod(t, c >> 24, (c >> 16) & 255, (c >> 8) & 255); SDL_SetTextureAlphaMod(t, c & 255); }
void plat_img_draw(const Img *im, float x, float y, float sx, float sy, float rot, uint32_t tint) {
    if (!im) return; tint_set(im->t, tint);
    SDL_FRect d = { x, y, im->w * fabsf(sx), im->h * fabsf(sy) };
    SDL_RendererFlip fl = (sx < 0 ? SDL_FLIP_HORIZONTAL : 0) | (sy < 0 ? SDL_FLIP_VERTICAL : 0);
    SDL_RenderCopyExF(ren, im->t, NULL, &d, rot * 180.0 / M_PI, NULL, fl);
}
void plat_img_draw_part(const Img *im, int sx, int sy, int sw, int sh, float x, float y, float w, float h, uint32_t tint) {
    if (!im) return; tint_set(im->t, tint);
    SDL_Rect s = { sx, sy, sw, sh }; SDL_FRect d = { x, y, w, h };
    SDL_RenderCopyF(ren, im->t, &s, &d);
}

/* ---- shapes */
static void setc(uint32_t c) { SDL_SetRenderDrawColor(ren, c >> 24, (c >> 16) & 255, (c >> 8) & 255, c & 255); }
void plat_rect(float x, float y, float w, float h, uint32_t c) { setc(c); SDL_FRect r = { x, y, w, h }; SDL_RenderFillRectF(ren, &r); }
void plat_rect_grad(float x, float y, float w, float h, uint32_t t, uint32_t b) {
    int n = (int)h; if (n < 1) return;
    for (int i = 0; i < n; i++) {
        float f = n > 1 ? (float)i / (n - 1) : 0; int ch[4];
        for (int k = 0; k < 4; k++) { int sh = 24 - k * 8; int a = (t >> sh) & 255, bb = (b >> sh) & 255; ch[k] = (int)(a + (bb - a) * f); }
        plat_rect(x, y + i, w, 1, RGBA(ch[0], ch[1], ch[2], ch[3]));
    }
}
void plat_circle(float cx, float cy, float r, uint32_t c) {
    setc(c);
    for (float y = -r; y <= r; y += 1) { float hw = sqrtf(fmaxf(0, r * r - y * y)); SDL_FRect q = { cx - hw, cy + y, hw * 2, 1 }; SDL_RenderFillRectF(ren, &q); }
}
void plat_ring(float cx, float cy, float r, float th, uint32_t c) {
    setc(c); int n = (int)(r * 6) + 12;
    for (int i = 0; i < n; i++) { float a = i * 6.2831853f / n; SDL_FRect q = { cx + cosf(a) * (r - th / 2) - th / 2 + th / 2, cy + sinf(a) * (r - th / 2), th, th }; q.x -= th / 2; q.y -= th / 2; SDL_RenderFillRectF(ren, &q); }
}
void plat_line(float x0, float y0, float x1, float y1, float th, uint32_t c) {
    setc(c); float dx = x1 - x0, dy = y1 - y0, L = sqrtf(dx * dx + dy * dy); int n = (int)L + 1;
    for (int i = 0; i <= n; i++) { float f = (float)i / n; SDL_FRect q = { x0 + dx * f - th / 2, y0 + dy * f - th / 2, th, th }; SDL_RenderFillRectF(ren, &q); }
}
void plat_rrect(float x, float y, float w, float h, float r, uint32_t c) {
    if (r > h / 2) r = h / 2; if (r > w / 2) r = w / 2; setc(c);
    for (int i = 0; i < (int)ceilf(r); i++) {
        float dy = r - i - 0.5f, inset = r - sqrtf(fmaxf(0, r * r - dy * dy));
        SDL_FRect a = { x + inset, y + i, w - inset * 2, 1 }, b = { x + inset, y + h - 1 - i, w - inset * 2, 1 };
        SDL_RenderFillRectF(ren, &a); SDL_RenderFillRectF(ren, &b);
    }
    SDL_FRect m = { x, y + ceilf(r), w, h - 2 * ceilf(r) }; if (m.h > 0) SDL_RenderFillRectF(ren, &m);
}
void plat_rrect_line(float x, float y, float w, float h, float r, uint32_t c) {
    plat_rect(x + r, y, w - 2 * r, 1, c); plat_rect(x + r, y + h - 1, w - 2 * r, 1, c);
    plat_rect(x, y + r, 1, h - 2 * r, c); plat_rect(x + w - 1, y + r, 1, h - 2 * r, c);
    plat_line(x + 1, y + r, x + r, y + 1, 1, c); plat_line(x + w - 1, y + r, x + w - r, y + 1, 1, c);
    plat_line(x + 1, y + h - r, x + r, y + h - 1, 1, c); plat_line(x + w - 1, y + h - r, x + w - r, y + h - 1, 1, c);
}

/* ---- text (cached white renders, tinted at draw) */
#define TC 256
static struct { char *s; int size; SDL_Texture *t; int w, h; } tc[TC]; static int tcn;
static int tc_get(float size, const char *s) {
    int sz = (int)(size * 10);
    for (int i = 0; i < TC; i++) if (tc[i].s && tc[i].size == sz && !strcmp(tc[i].s, s)) return i;
    int i = tcn++ % TC; if (tc[i].s) { free(tc[i].s); SDL_DestroyTexture(tc[i].t); }
    TTF_Font *f = font(size); SDL_Color w = { 255, 255, 255, 255 };
    SDL_Surface *sf = TTF_RenderUTF8_Blended(f, *s ? s : " ", w);
    tc[i].s = strdup(s); tc[i].size = sz; tc[i].t = SDL_CreateTextureFromSurface(ren, sf); tc[i].w = sf->w; tc[i].h = sf->h; SDL_FreeSurface(sf);
    return i;
}
float plat_text_w(float size, const char *s) { if (!*s) return 0; int w, h; TTF_SizeUTF8(font(size), s, &w, &h); return (float)w; }
void plat_text(float x, float y, float size, uint32_t c, int fl, const char *s) {
    if (!*s) return; int i = tc_get(size, s); float w = (float)tc[i].w;
    if ((fl & 3) == T_CENTER) x -= w / 2; else if ((fl & 3) == T_RIGHT) x -= w;
    SDL_FRect d = { x, y, w, (float)tc[i].h };
    if (fl & T_SHADOW) { SDL_SetTextureColorMod(tc[i].t, 0, 0, 0); SDL_SetTextureAlphaMod(tc[i].t, (c & 255) * 3 / 5); SDL_FRect s2 = { x + 1, y + 1, w, d.h }; SDL_RenderCopyF(ren, tc[i].t, NULL, &s2); }
    tint_set(tc[i].t, c); SDL_RenderCopyF(ren, tc[i].t, NULL, &d);
}

/* ---- storage / assets */
bool plat_store_read(const char *n, char **d, size_t *len) {
    char p[1024]; snprintf(p, sizeof p, "%s/%s", savedir, n); FILE *f = fopen(p, "rb"); if (!f) return false;
    fseek(f, 0, SEEK_END); long L = ftell(f); fseek(f, 0, SEEK_SET); *d = malloc(L + 1); fread(*d, 1, L, f); (*d)[L] = 0; *len = L; fclose(f); return true;
}
bool plat_store_write(const char *n, const char *d, size_t len) {
    char p[1024]; snprintf(p, sizeof p, "%s/%s", savedir, n); FILE *f = fopen(p, "wb"); if (!f) return false; fwrite(d, 1, len, f); fclose(f); return true;
}
void plat_store_remove(const char *n) { char p[1024]; snprintf(p, sizeof p, "%s/%s", savedir, n); remove(p); }
bool plat_asset_read(const char *n, char **d, size_t *len) {
    char p[1024]; snprintf(p, sizeof p, "%s/%s", romfs, n); FILE *f = fopen(p, "rb"); if (!f) return false;
    fseek(f, 0, SEEK_END); long L = ftell(f); fseek(f, 0, SEEK_SET); *d = malloc(L + 1); fread(*d, 1, L, f); (*d)[L] = 0; *len = L; fclose(f); return true;
}
void plat_sfx(const char *n) { (void)n; }
void plat_music(const char *m) { (void)m; }
void plat_set_volume(float m, float s) { (void)m; (void)s; }
