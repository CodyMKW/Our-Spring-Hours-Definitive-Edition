/* plat_3ds.c — the real Nintendo 3DS backend: libctru + citro2d/citro3d + ndsp. Built only by devkitARM. */
#include "plat.h"
#include "synth.h"
#include <3ds.h>
#include <citro2d.h>
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

static C3D_RenderTarget *tgt[2]; static int cur;
static Input in; static C2D_TextBuf tbuf, mbuf;
static bool audio_ok; static float vol_music = 0.7f, vol_sfx = 0.8f;
static const char *SAVE_DIR = "sdmc:/3ds/OurSpringHours";

static void flush_dead(void);
struct Img { C2D_SpriteSheet sheet; C2D_Image img; int w, h; };

void plat_log(const char *f, ...) { va_list a; va_start(a, f); char b[256]; vsnprintf(b, sizeof b, f, a); va_end(a); svcOutputDebugString(b, strlen(b)); fprintf(stderr, "%s\n", b); }
uint64_t plat_time_ms(void) { return osGetTime(); }

bool plat_init(int argc, char **argv) {
    (void)argc; (void)argv;
    romfsInit(); gfxInitDefault(); C3D_Init(C3D_DEFAULT_CMDBUF_SIZE); C2D_Init(C2D_DEFAULT_MAX_OBJECTS * 2); C2D_Prepare();
    tgt[0] = C2D_CreateScreenTarget(GFX_TOP, GFX_LEFT); tgt[1] = C2D_CreateScreenTarget(GFX_BOTTOM, GFX_LEFT);
    tbuf = C2D_TextBufNew(9000); mbuf = C2D_TextBufNew(64);
    mkdir("sdmc:/3ds", 0777); mkdir(SAVE_DIR, 0777);
    osSetSpeedupEnable(true);
    if (R_SUCCEEDED(ndspInit())) { audio_ok = true; ndspSetOutputMode(NDSP_OUTPUT_STEREO); }   /* needs dspfirm.cdc on the SD card; fine if absent */
    return true;
}
void plat_exit(void) {
    if (audio_ok) ndspExit();
    C2D_TextBufDelete(tbuf); C2D_TextBufDelete(mbuf); C2D_Fini(); C3D_Fini(); gfxExit(); romfsExit();
}

bool plat_frame_begin(void) {
    if (!aptMainLoop()) return false;
    hidScanInput();
    uint32_t d = hidKeysDown(), h = hidKeysHeld(), u = hidKeysUp();
    static const struct { uint32_t k, b; } MAP[] = { {KEY_A,K_A},{KEY_B,K_B},{KEY_X,K_X},{KEY_Y,K_Y},{KEY_L,K_L},{KEY_R,K_R},{KEY_START,K_START},{KEY_SELECT,K_SELECT},
        {KEY_DUP,K_UP},{KEY_DDOWN,K_DOWN},{KEY_DLEFT,K_LEFT},{KEY_DRIGHT,K_RIGHT},{KEY_ZL,K_ZL},{KEY_ZR,K_ZR},{KEY_CPAD_UP,K_UP},{KEY_CPAD_DOWN,K_DOWN},{KEY_CPAD_LEFT,K_LEFT},{KEY_CPAD_RIGHT,K_RIGHT} };
    in.down = in.held = in.up = 0;
    for (unsigned i = 0; i < sizeof MAP / sizeof *MAP; i++) { if (d & MAP[i].k) in.down |= MAP[i].b; if (h & MAP[i].k) in.held |= MAP[i].b; if (u & MAP[i].k) in.up |= MAP[i].b; }
    touchPosition t; hidTouchRead(&t);
    in.touch_down = (d & KEY_TOUCH) != 0; in.touch_up = (u & KEY_TOUCH) != 0; in.touch_held = (h & KEY_TOUCH) != 0;
    if (in.touch_held) { in.dx = in.touch_down ? 0 : t.px - in.tx; in.dy = in.touch_down ? 0 : t.py - in.ty; in.tx = t.px; in.ty = t.py; } else in.dx = in.dy = 0;
    C3D_FrameBegin(C3D_FRAME_SYNCDRAW); flush_dead(); C2D_TextBufClear(tbuf);
    C2D_TargetClear(tgt[0], C2D_Color32(0, 0, 0, 255)); C2D_TargetClear(tgt[1], C2D_Color32(0, 0, 0, 255));
    cur = 0; C2D_SceneBegin(tgt[0]);
    return true;
}
void plat_frame_end(void) { C3D_FrameEnd(0); }
void plat_target(int s) { cur = s; C2D_SceneBegin(tgt[s]); }
const Input *plat_input(void) { return &in; }

static inline u32 C(uint32_t c) { return C2D_Color32(c >> 24, (c >> 16) & 255, (c >> 8) & 255, c & 255); }

/* ---- images */
Img *plat_img_load(const char *name) {
    char p[160]; snprintf(p, sizeof p, "romfs:/gfx/%s.t3x", name);
    C2D_SpriteSheet s = C2D_SpriteSheetLoad(p); if (!s) return NULL;
    Img *im = calloc(1, sizeof *im); im->sheet = s; im->img = C2D_SpriteSheetGetImage(s, 0); im->w = im->img.subtex->width; im->h = im->img.subtex->height; return im;
}
/* A sheet can still be referenced by draw calls queued this frame, so freeing is deferred to the next frame start. */
static Img *dead[32]; static int ndead;
static void flush_dead(void) { for (int i = 0; i < ndead; i++) { C2D_SpriteSheetFree(dead[i]->sheet); free(dead[i]); } ndead = 0; }
void plat_img_free(Img *im) { if (!im) return; if (ndead >= 32) { C3D_FrameSync(); flush_dead(); } dead[ndead++] = im; }
int plat_img_w(const Img *im) { return im->w; }
int plat_img_h(const Img *im) { return im->h; }
static void tint_of(C2D_ImageTint *t, uint32_t c) {      /* RGB modulates by darkening toward black, alpha = opacity */
    float dim = 1.0f - (float)(((c >> 24) & 255) + ((c >> 16) & 255) + ((c >> 8) & 255)) / (3 * 255.0f);
    u32 col = C2D_Color32(0, 0, 0, c & 255);
    for (int i = 0; i < 4; i++) C2D_SetImageTint(t, (C2D_Corner)i, col, dim);
}
void plat_img_draw(const Img *im, float x, float y, float sx, float sy, float rot, uint32_t tint) {
    if (!im) return; C2D_ImageTint t; tint_of(&t, tint);
    if (rot == 0) C2D_DrawImageAt(im->img, x, y, 0.5f, &t, sx, sy);
    else C2D_DrawImageAtRotated(im->img, x + im->w * sx / 2, y + im->h * sy / 2, 0.5f, rot, &t, sx, sy);
}
void plat_img_draw_part(const Img *im, int srcx, int srcy, int srcw, int srch, float x, float y, float w, float h, uint32_t tint) {
    if (!im) return; Tex3DS_SubTexture st = *im->img.subtex;
    float du = st.right - st.left, dv = st.bottom - st.top, W = (float)im->w, H = (float)im->h, l = st.left, tp = st.top;
    st.left = l + du * srcx / W; st.right = l + du * (srcx + srcw) / W; st.top = tp + dv * srcy / H; st.bottom = tp + dv * (srcy + srch) / H; st.width = srcw; st.height = srch;
    C2D_Image part = { im->img.tex, &st }; C2D_ImageTint t; tint_of(&t, tint);
    C2D_DrawImageAt(part, x, y, 0.5f, &t, w / srcw, h / srch);
}

/* ---- shapes */
void plat_rect(float x, float y, float w, float h, uint32_t c) { C2D_DrawRectSolid(x, y, 0.5f, w, h, C(c)); }
void plat_rect_grad(float x, float y, float w, float h, uint32_t t, uint32_t b) { C2D_DrawRectangle(x, y, 0.5f, w, h, C(t), C(t), C(b), C(b)); }
void plat_circle(float x, float y, float r, uint32_t c) { C2D_DrawCircleSolid(x, y, 0.5f, r, C(c)); }
void plat_ring(float x, float y, float r, float th, uint32_t c) {
    int n = r < 12 ? 12 : (r < 40 ? 24 : 40); float pa = r, pb = 0; u32 col = C(c);
    for (int i = 1; i <= n; i++) { float a = i * 6.2831853f / n, nx = x + cosf(a) * r, ny = y + sinf(a) * r; if (i == 1) { pa = x + r; pb = y; } C2D_DrawLine(pa, pb, col, nx, ny, col, th < 1 ? 1 : th, 0.5f); pa = nx; pb = ny; }
}
void plat_line(float x0, float y0, float x1, float y1, float th, uint32_t c) { C2D_DrawLine(x0, y0, C(c), x1, y1, C(c), th < 1 ? 1 : th, 0.5f); }
void plat_rrect(float x, float y, float w, float h, float r, uint32_t c) {
    if (r > h / 2) r = h / 2; if (r > w / 2) r = w / 2; u32 col = C(c); int n = (int)ceilf(r);
    for (int i = 0; i < n; i++) { float dy = r - i - 0.5f, inset = r - sqrtf(fmaxf(0, r * r - dy * dy)); C2D_DrawRectSolid(x + inset, y + i, 0.5f, w - inset * 2, 1, col); C2D_DrawRectSolid(x + inset, y + h - 1 - i, 0.5f, w - inset * 2, 1, col); }
    if (h - 2 * n > 0) C2D_DrawRectSolid(x, y + n, 0.5f, w, h - 2 * n, col);
}
void plat_rrect_line(float x, float y, float w, float h, float r, uint32_t c) {
    plat_rect(x + r, y, w - 2 * r, 1, c); plat_rect(x + r, y + h - 1, w - 2 * r, 1, c); plat_rect(x, y + r, 1, h - 2 * r, c); plat_rect(x + w - 1, y + r, 1, h - 2 * r, c);
    plat_line(x + 1, y + r, x + r, y + 1, 1, c); plat_line(x + w - 1, y + r, x + w - r, y + 1, 1, c); plat_line(x + 1, y + h - r, x + r, y + h - 1, 1, c); plat_line(x + w - 1, y + h - r, x + w - r, y + h - 1, 1, c);
}

/* ---- text: advance widths cached per code point (scale 1) so wrapping never touches the glyph buffer */
static float *adv; 
static float cp_adv(uint32_t cp) {
    if (cp >= 0x10000) return 0; if (!adv) adv = calloc(0x10000, sizeof(float));
    if (adv[cp] == 0) {
        char s[8]; int n = 0;
        if (cp < 0x80) s[n++] = (char)cp; else if (cp < 0x800) { s[n++] = 0xC0 | (cp >> 6); s[n++] = 0x80 | (cp & 63); } else { s[n++] = 0xE0 | (cp >> 12); s[n++] = 0x80 | ((cp >> 6) & 63); s[n++] = 0x80 | (cp & 63); }
        s[n] = 0; C2D_TextBufClear(mbuf); C2D_Text t; C2D_TextParse(&t, mbuf, s); float w = 0, h = 0; C2D_TextGetDimensions(&t, 1, 1, &w, &h); adv[cp] = w > 0 ? w : 0.001f;
    }
    return adv[cp];
}
static uint32_t next_cp(const char **p) {
    const unsigned char *s = (const unsigned char *)*p; uint32_t c = *s;
    if (c < 0x80) { *p += 1; return c; } if ((c & 0xE0) == 0xC0) { *p += 2; return ((c & 31) << 6) | (s[1] & 63); }
    if ((c & 0xF0) == 0xE0) { *p += 3; return ((c & 15) << 12) | ((s[1] & 63) << 6) | (s[2] & 63); } *p += 4; return '?';
}
#define SC(size) ((size) / 30.0f)
float plat_text_w(float size, const char *s) { float w = 0; while (*s) { uint32_t c = next_cp(&s); w += cp_adv(c); } return w * SC(size); }
void plat_text(float x, float y, float size, uint32_t c, int fl, const char *s) {
    if (!*s) return; C2D_Text t; C2D_TextParse(&t, tbuf, s); C2D_TextOptimize(&t); float sc = SC(size), w = plat_text_w(size, s);
    if ((fl & 3) == T_CENTER) x -= w / 2; else if ((fl & 3) == T_RIGHT) x -= w;
    if (fl & T_SHADOW) C2D_DrawText(&t, C2D_WithColor, x + 1, y + 1, 0.5f, sc, sc, C2D_Color32(0, 0, 0, ((c & 255) * 3) / 5));
    C2D_DrawText(&t, C2D_WithColor, x, y, 0.5f, sc, sc, C(c));
}

/* ---- storage / assets */
bool plat_store_read(const char *n, char **d, size_t *len) {
    char p[256]; snprintf(p, sizeof p, "%s/%s", SAVE_DIR, n); FILE *f = fopen(p, "rb"); if (!f) return false;
    fseek(f, 0, SEEK_END); long L = ftell(f); fseek(f, 0, SEEK_SET); *d = malloc(L + 1); size_t r = fread(*d, 1, L, f); (void)r; (*d)[L] = 0; *len = L; fclose(f); return true;
}
bool plat_store_write(const char *n, const char *d, size_t len) {
    char p[256]; snprintf(p, sizeof p, "%s/%s", SAVE_DIR, n); FILE *f = fopen(p, "wb"); if (!f) return false; fwrite(d, 1, len, f); fclose(f); return true;
}
void plat_store_remove(const char *n) { char p[256]; snprintf(p, sizeof p, "%s/%s", SAVE_DIR, n); remove(p); }
bool plat_asset_read(const char *n, char **d, size_t *len) {
    char p[256]; snprintf(p, sizeof p, "romfs:/%s", n); FILE *f = fopen(p, "rb"); if (!f) return false;
    fseek(f, 0, SEEK_END); long L = ftell(f); fseek(f, 0, SEEK_SET); *d = malloc(L + 1); size_t r = fread(*d, 1, L, f); (void)r; (*d)[L] = 0; *len = L; fclose(f); return true;
}

/* ---- audio: ndsp channel 0 = music loop, channels 1-6 = sound effects (round robin) */
#define NSFX 14
static struct { const char *name; int16_t *pcm; size_t n; } sfxc[NSFX]; static int nsfxc;
static ndspWaveBuf mwb, swb[6]; static int16_t *mpcm; static char mname[16]; static int nextch;
/* ndsp's DSP reads sample data straight from memory, so it MUST live in linear (physically contiguous) memory — plain malloc'd buffers play silence. */
static int16_t *to_linear(int16_t *src, size_t n) {
    int16_t *d = linearAlloc(n * sizeof(int16_t)); if (d) memcpy(d, src, n * sizeof(int16_t)); free(src); return d;
}
static void play_buf(int ch, ndspWaveBuf *wb, int16_t *pcm, size_t n, bool loop, float vol) {
    ndspChnReset(ch); ndspChnSetInterp(ch, NDSP_INTERP_LINEAR); ndspChnSetRate(ch, SYN_RATE); ndspChnSetFormat(ch, NDSP_FORMAT_MONO_PCM16);
    float mix[12] = { vol, vol }; ndspChnSetMix(ch, mix);
    memset(wb, 0, sizeof *wb); wb->data_vaddr = pcm; wb->nsamples = n; wb->looping = loop; DSP_FlushDataCache(pcm, n * 2); ndspChnWaveBufAdd(ch, wb);
}
void plat_set_volume(float m, float s) { vol_music = m; vol_sfx = s; if (audio_ok && mpcm) { float mix[12] = { vol_music * 0.8f, vol_music * 0.8f }; ndspChnSetMix(0, mix); } }
void plat_sfx(const char *name) {
    if (!audio_ok || vol_sfx <= 0) return;
    int16_t *pcm = NULL; size_t n = 0;
    for (int i = 0; i < nsfxc; i++) if (!strcmp(sfxc[i].name, name)) { pcm = sfxc[i].pcm; n = sfxc[i].n; }
    if (!pcm) { size_t k; pcm = synth_sfx(name, &k); if (!pcm || nsfxc >= NSFX) { free(pcm); return; } pcm = to_linear(pcm, k); if (!pcm) return; sfxc[nsfxc].name = strdup(name); sfxc[nsfxc].pcm = pcm; sfxc[nsfxc].n = k; nsfxc++; n = k; }
    int ch = 1 + (nextch++ % 6); play_buf(ch, &swb[ch - 1], pcm, n, false, vol_sfx * 0.9f);
}
void plat_music(const char *mood) {
    if (!audio_ok) return;
    if (!mood) { ndspChnWaveBufClear(0); ndspChnReset(0); if (mpcm) linearFree(mpcm); mpcm = NULL; mname[0] = 0; return; }
    if (!strcmp(mname, mood)) return;
    size_t n; int16_t *pcm = synth_music(mood, &n); if (!pcm) return; pcm = to_linear(pcm, n); if (!pcm) return;
    ndspChnWaveBufClear(0); ndspChnReset(0); svcSleepThread(20 * 1000 * 1000LL); if (mpcm) linearFree(mpcm); mpcm = pcm; snprintf(mname, 16, "%s", mood);
    play_buf(0, &mwb, mpcm, n, true, vol_music * 0.8f);
}
