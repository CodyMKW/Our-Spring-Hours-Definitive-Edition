/* plat_ds.c — Nintendo DS backend for plat.h (BlocksDS / libnds).
 * Everything is drawn by the CPU into two 256x192 RGB555 back buffers (one per screen) and copied to VRAM each frame.
 * The game code still thinks in 3DS coordinates (top 400x240, bottom 320x240): every call is scaled by the target's factor
 * (top 0.64, letterboxed; bottom 0.8). Pictures are pre-shrunk at build time (tools/build_assets_ds.py), text comes from a
 * pre-baked bitmap font (font.bin), saves live in the cartridge's backup memory (with an in-RAM fallback). */
#include "plat.h"
#include <nds.h>
#include <filesystem.h>
#include <nds/card.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <math.h>

#define W 256
#define H 192
#define MASK555 0x03E07C1Fu

/* ---------------------------------------------------------------- debugging aid (readable from an emulator's memory) */
volatile unsigned dbg[16]; char dbg_log[6000]; static int dbg_n;
void plat_log(const char *f, ...) {
    va_list a; va_start(a, f);
    if (dbg_n < 5800) dbg_n += vsnprintf(dbg_log + dbg_n, 5900 - dbg_n, f, a);
    va_end(a); if (dbg_n < 5900) dbg_log[dbg_n++] = '\n';
}

/* ---------------------------------------------------------------- targets */
typedef struct { u16 *px; float s, ox, oy; } Tgt;
static u16 bb0[W * H] __attribute__((aligned(4))), bb1[W * H] __attribute__((aligned(4)));
static Tgt TG[2] = { { bb0, 0.64f, 0, 19.0f }, { bb1, 0.8f, 0, 0 } };
static int cur; static Input in;
static u16 *vram_top, *vram_bot;
const Input *plat_input(void) { return &in; }
void plat_target(int s) { cur = s ? 1 : 0; }
uint64_t plat_time_ms(void) { u32 t = (u32)TIMER_DATA(0) | ((u32)TIMER_DATA(1) << 16); return (uint64_t)(((unsigned long long)t * 1000ULL) / 32728ULL); }

/* ---------------------------------------------------------------- pixel helpers */
static inline u16 rgb555(uint32_t c) { return (u16)((((c >> 27) & 31)) | (((c >> 19) & 31) << 5) | (((c >> 11) & 31) << 10) | 0x8000); }
static inline u32 a32of(uint32_t c) { u32 a = c & 255; return (a * 32 + 127) / 255; }
static inline u16 bl(u16 d, u16 s, u32 a) {     /* a: 0..32 */
    u32 dd = ((u32)d | ((u32)d << 16)) & MASK555, ss = ((u32)s | ((u32)s << 16)) & MASK555;
    u32 r = (dd + (((ss - dd) * a) >> 5)) & MASK555;
    return (u16)(r | (r >> 16) | 0x8000);
}
static inline void span(u16 *row, int x0, int x1, u16 c, u32 a) {   /* [x0,x1) */
    if (x0 < 0) x0 = 0; if (x1 > W) x1 = W; if (x0 >= x1 || a == 0) return;
    if (a >= 32) { for (int x = x0; x < x1; x++) row[x] = c; }
    else for (int x = x0; x < x1; x++) row[x] = bl(row[x], c, a);
}
static inline void pset(u16 *px, int x, int y, u16 c, u32 a) { if ((unsigned)x < W && (unsigned)y < H && a) px[y * W + x] = a >= 32 ? c : bl(px[y * W + x], c, a); }
/* span with fractional end coverage */
static void spanf(u16 *row, float xl, float xr, u16 c, u32 a) {
    if (xr <= xl) return;
    int il = (int)floorf(xl), ir = (int)floorf(xr);
    if (il == ir) { pset(row, il, 0, 0, 0); u32 aa = (u32)((xr - xl) * a + 0.5f); if ((unsigned)il < W && aa) row[il] = bl(row[il], c, aa > 32 ? 32 : aa); return; }
    if ((unsigned)il < W) { float cov = 1.0f - (xl - il); u32 aa = (u32)(cov * a + 0.5f); if (aa) row[il] = bl(row[il], c, aa > 32 ? 32 : aa); }
    span(row, il + 1, ir, c, a);
    if ((unsigned)ir < W) { float cov = xr - ir; u32 aa = (u32)(cov * a + 0.5f); if (aa) row[ir] = bl(row[ir], c, aa > 32 ? 32 : aa); }
}
#define TX(t, x) ((x) * (t)->s + (t)->ox)
#define TY(t, y) ((y) * (t)->s + (t)->oy)

/* ---------------------------------------------------------------- shapes */
static void rect_dev(Tgt *t, float x0, float y0, float x1, float y1, u16 c, u32 a) {
    if (a == 0 || x1 <= x0 || y1 <= y0) return;
    if (y0 < 0) y0 = 0; if (y1 > H) y1 = H;
    int iy0 = (int)floorf(y0), iy1 = (int)ceilf(y1);
    for (int y = iy0; y < iy1 && y < H; y++) {
        float cov = 1.0f; if (y < y0) cov -= (y0 - y); if (y + 1 > y1) cov -= (y + 1 - y1);
        u32 aa = (u32)(cov * a + 0.5f); if (aa == 0) continue; if (aa > 32) aa = 32;
        if (x0 == floorf(x0) && x1 == floorf(x1)) span(t->px + y * W, (int)x0, (int)x1, c, aa); else spanf(t->px + y * W, x0, x1, c, aa);
    }
}
void plat_rect(float x, float y, float w, float h, uint32_t col) {
    Tgt *t = &TG[cur]; rect_dev(t, TX(t, x), TY(t, y), TX(t, x + w), TY(t, y + h), rgb555(col), a32of(col));
}
void plat_rect_grad(float x, float y, float w, float h, uint32_t c0, uint32_t c1) {
    Tgt *t = &TG[cur]; float y0 = TY(t, y), y1 = TY(t, y + h), x0 = TX(t, x), x1 = TX(t, x + w);
    int iy0 = (int)floorf(y0), iy1 = (int)ceilf(y1); if (iy0 < 0) iy0 = 0; if (iy1 > H) iy1 = H; if (y1 <= y0) return;
    int r0 = c0 >> 24, g0 = (c0 >> 16) & 255, b0 = (c0 >> 8) & 255, a0 = c0 & 255, r1 = c1 >> 24, g1 = (c1 >> 16) & 255, b1 = (c1 >> 8) & 255, a1 = c1 & 255;
    for (int yy = iy0; yy < iy1; yy++) {
        int f = (int)(((yy + 0.5f - y0) / (y1 - y0)) * 256.0f); if (f < 0) f = 0; if (f > 256) f = 256;
        uint32_t c = RGBA(r0 + (((r1 - r0) * f) >> 8), g0 + (((g1 - g0) * f) >> 8), b0 + (((b1 - b0) * f) >> 8), a0 + (((a1 - a0) * f) >> 8));
        rect_dev(t, x0, (float)yy, x1, (float)yy + 1, rgb555(c), a32of(c));
    }
}
static void rrect_dev(Tgt *t, float x0, float y0, float x1, float y1, float r, u16 c, u32 a) {
    float w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0 || a == 0) return;
    if (r > w / 2) r = w / 2; if (r > h / 2) r = h / 2;
    if (r < 1.0f) { rect_dev(t, x0, y0, x1, y1, c, a); return; }
    int iy0 = (int)floorf(y0), iy1 = (int)ceilf(y1);
    for (int y = iy0; y < iy1; y++) {
        if ((unsigned)y >= H) continue;
        float yc = y + 0.5f, d = 0;
        if (yc < y0 + r) d = (y0 + r) - yc; else if (yc > y1 - r) d = yc - (y1 - r);
        float inset = d > 0 ? r - sqrtf(fmaxf(0.0f, r * r - d * d)) : 0.0f;
        float cov = 1.0f; if (y < y0) cov -= (y0 - y); if (y + 1 > y1) cov -= (y + 1 - y1);
        u32 aa = (u32)(cov * a + 0.5f); if (aa == 0) continue; if (aa > 32) aa = 32;
        spanf(t->px + y * W, x0 + inset, x1 - inset, c, aa);
    }
}
void plat_rrect(float x, float y, float w, float h, float r, uint32_t col) {
    Tgt *t = &TG[cur]; rrect_dev(t, TX(t, x), TY(t, y), TX(t, x + w), TY(t, y + h), r * t->s, rgb555(col), a32of(col));
}
void plat_rrect_line(float x, float y, float w, float h, float r, uint32_t col) {
    Tgt *t = &TG[cur]; float x0 = TX(t, x), y0 = TY(t, y), x1 = TX(t, x + w), y1 = TY(t, y + h), rr = r * t->s; u16 c = rgb555(col); u32 a = a32of(col);
    /* outline = rounded rect minus a 1px-inset rounded rect, drawn per row */
    float th = 1.0f; if (rr < 1) rr = 1; if (rr > (x1 - x0) / 2) rr = (x1 - x0) / 2; if (rr > (y1 - y0) / 2) rr = (y1 - y0) / 2;
    for (int y = (int)floorf(y0); y < (int)ceilf(y1); y++) {
        if ((unsigned)y >= H) continue;
        float yc = y + 0.5f, d = 0;
        if (yc < y0 + rr) d = (y0 + rr) - yc; else if (yc > y1 - rr) d = yc - (y1 - rr);
        float inset = d > 0 ? rr - sqrtf(fmaxf(0.0f, rr * rr - d * d)) : 0.0f;
        float xl = x0 + inset, xr = x1 - inset;
        if (yc < y0 + th || yc > y1 - th) { spanf(t->px + y * W, xl, xr, c, a); }
        else { float run = (d > 0) ? th + (inset > 0 ? 0.6f : 0) : th; spanf(t->px + y * W, xl, xl + run + 0.4f, c, a); spanf(t->px + y * W, xr - run - 0.4f, xr, c, a); }
    }
}
static void circle_dev(Tgt *t, float cx, float cy, float r, float ri, u16 c, u32 a) {
    if (r <= 0 || a == 0) return;
    for (int y = (int)floorf(cy - r); y <= (int)ceilf(cy + r); y++) {
        if ((unsigned)y >= H) continue;
        float dy = (y + 0.5f) - cy; float o2 = r * r - dy * dy; if (o2 <= 0) continue;
        float ho = sqrtf(o2);
        if (ri > 0 && fabsf(dy) < ri) { float hi = sqrtf(ri * ri - dy * dy); spanf(t->px + y * W, cx - ho, cx - hi, c, a); spanf(t->px + y * W, cx + hi, cx + ho, c, a); }
        else spanf(t->px + y * W, cx - ho, cx + ho, c, a);
    }
}
void plat_circle(float x, float y, float r, uint32_t col) { Tgt *t = &TG[cur]; circle_dev(t, TX(t, x), TY(t, y), r * t->s, 0, rgb555(col), a32of(col)); }
void plat_ring(float x, float y, float r, float th, uint32_t col) {
    Tgt *t = &TG[cur]; float R = (r + th / 2) * t->s, ri = (r - th / 2) * t->s; if (R - ri < 1.0f) { ri = R - 1.0f; } if (ri < 0) ri = 0;
    circle_dev(t, TX(t, x), TY(t, y), R, ri, rgb555(col), a32of(col));
}
void plat_line(float x0, float y0, float x1, float y1, float th, uint32_t col) {
    Tgt *t = &TG[cur]; float ax = TX(t, x0), ay = TY(t, y0), bx = TX(t, x1), by = TY(t, y1), r = th * t->s / 2; if (r < 0.5f) r = 0.5f;
    float dx = bx - ax, dy = by - ay, len = sqrtf(dx * dx + dy * dy); int n = (int)(len / (r < 1 ? 1 : r)) + 1; u16 c = rgb555(col); u32 a = a32of(col);
    if (r <= 0.6f) { for (int i = 0; i <= n; i++) { float f = (float)i / n; pset(t->px, (int)(ax + dx * f), (int)(ay + dy * f), c, a); } return; }
    for (int i = 0; i <= n; i++) { float f = (float)i / n; circle_dev(t, ax + dx * f, ay + dy * f, r, 0, c, a); }
}

/* ---------------------------------------------------------------- images */
struct Img { u8 fmt; u16 lw, lh, sw, sh; u16 *px; u8 *al; size_t bytes; };
static bool nitro_ok;
static bool read_file(const char *path, void **data, size_t *len) {
    FILE *f = fopen(path, "rb"); if (!f) return false;
    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
    void *d = malloc(n + 1); if (!d) { fclose(f); return false; }
    if (fread(d, 1, n, f) != (size_t)n) { free(d); fclose(f); return false; }
    ((char *)d)[n] = 0; fclose(f); *data = d; *len = n; return true;
}
Img *plat_img_load(const char *name) {
    char p[96]; snprintf(p, sizeof p, "nitro:/gfx/%s.img", name);
    FILE *f = fopen(p, "rb"); if (!f) return NULL;
    u8 hd[10]; if (fread(hd, 1, 10, f) != 10) { fclose(f); return NULL; }
    Img *im = malloc(sizeof *im); if (!im) { fclose(f); return NULL; }
    im->fmt = hd[0]; im->lw = hd[2] | hd[3] << 8; im->lh = hd[4] | hd[5] << 8; im->sw = hd[6] | hd[7] << 8; im->sh = hd[8] | hd[9] << 8;
    size_t n = (size_t)im->sw * im->sh; im->bytes = n * (im->fmt ? 3 : 2) + sizeof *im;
    im->px = malloc(n * 2); im->al = im->fmt ? malloc(n) : NULL;
    if (!im->px || (im->fmt && !im->al) || fread(im->px, 2, n, f) != n || (im->fmt && fread(im->al, 1, n, f) != n)) { free(im->px); free(im->al); free(im); fclose(f); return NULL; }
    fclose(f); return im;
}
void plat_img_free(Img *im) { if (!im) return; free(im->px); free(im->al); free(im); }
int plat_img_w(const Img *im) { return im->lw; }
int plat_img_h(const Img *im) { return im->lh; }
size_t plat_img_bytes(const Img *im) { return im->bytes; }

/* draw stored-pixel sub-rectangle [u0,u1)x[v0,v1) (in stored pixels) into device rect, optional rotation about its centre */
static void blit(Tgt *t, const Img *im, float su0, float sv0, float su1, float sv1, float dx, float dy, float dw, float dh, float rot, uint32_t tint) {
    if (dw < 0.5f || dh < 0.5f) return;
    u32 ta = tint & 255; if (ta == 0) return;
    int tr = (tint >> 24) & 255, tg = (tint >> 16) & 255, tb = (tint >> 8) & 255;
    bool plain = tr == 255 && tg == 255 && tb == 255 && ta == 255;
    float suw = su1 - su0, svh = sv1 - sv0;
    float cr = cosf(rot), sr = sinf(rot);
    float cx = dx + dw / 2, cy = dy + dh / 2;
    int bx0, by0, bx1, by1;
    if (rot == 0) { bx0 = (int)floorf(dx + 0.5f); by0 = (int)floorf(dy + 0.5f); bx1 = (int)floorf(dx + dw + 0.5f); by1 = (int)floorf(dy + dh + 0.5f); if (bx1 <= bx0) bx1 = bx0 + 1; if (by1 <= by0) by1 = by0 + 1; }
    else { float hw = (fabsf(cr) * dw + fabsf(sr) * dh) / 2, hh = (fabsf(sr) * dw + fabsf(cr) * dh) / 2; bx0 = (int)floorf(cx - hw); bx1 = (int)ceilf(cx + hw); by0 = (int)floorf(cy - hh); by1 = (int)ceilf(cy + hh); }
    int cx0 = bx0 < 0 ? 0 : bx0, cy0 = by0 < 0 ? 0 : by0, cx1 = bx1 > W ? W : bx1, cy1 = by1 > H ? H : by1;
    if (cx0 >= cx1 || cy0 >= cy1) return;
    /* source coords in 16.16 fixed point as a function of device pixel */
    const int sw = im->sw;
    for (int y = cy0; y < cy1; y++) {
        u16 *row = t->px + y * W;
        if (rot == 0) {
            int v = (int)(sv0 + ((y + 0.5f - dy) / dh) * svh); if (v < (int)sv0) v = (int)sv0; if (v >= (int)(sv0 + svh)) v = (int)(sv0 + svh) - 1; if (v >= im->sh) v = im->sh - 1; if (v < 0) v = 0;
            const u16 *srow = im->px + v * sw; const u8 *arow = im->al ? im->al + v * sw : NULL;
            int u_fix = (int)(((cx0 + 0.5f - dx) / dw * suw + su0) * 65536.0f), ustep = (int)(suw / dw * 65536.0f);
            for (int x = cx0; x < cx1; x++, u_fix += ustep) {
                int u = u_fix >> 16; if (u < 0) u = 0; if (u >= sw) u = sw - 1;
                u16 c = srow[u]; u32 a = 32;
                if (arow) { u32 ea = (arow[u] * ta) >> 8; a = ea >> 3; if (ea > 247) a = 32; if (!a) continue; } else if (ta < 255) a = (ta * 32 + 127) / 255;
                if (!plain) { u32 r = (c & 31) * tr >> 8, g = ((c >> 5) & 31) * tg >> 8, b = ((c >> 10) & 31) * tb >> 8; c = (u16)(r | g << 5 | b << 10 | 0x8000); }
                row[x] = a >= 32 ? c : bl(row[x], c, a);
            }
        } else {
            for (int x = cx0; x < cx1; x++) {
                float px = x + 0.5f - cx, py = y + 0.5f - cy;
                float ux = px * cr + py * sr + dw / 2, uy = -px * sr + py * cr + dh / 2;
                if (ux < 0 || uy < 0 || ux >= dw || uy >= dh) continue;
                int u = (int)(su0 + ux / dw * suw), v = (int)(sv0 + uy / dh * svh); if (u >= sw) u = sw - 1; if (v >= im->sh) v = im->sh - 1;
                u16 c = im->px[v * sw + u]; u32 a = 32;
                if (im->al) { u32 ea = (im->al[v * sw + u] * ta) >> 8; a = ea >> 3; if (ea > 247) a = 32; if (!a) continue; } else if (ta < 255) a = (ta * 32 + 127) / 255;
                if (!plain) { u32 r = (c & 31) * tr >> 8, g = ((c >> 5) & 31) * tg >> 8, b = ((c >> 10) & 31) * tb >> 8; c = (u16)(r | g << 5 | b << 10 | 0x8000); }
                row[x] = a >= 32 ? c : bl(row[x], c, a);
            }
        }
    }
}
void plat_img_draw(const Img *im, float x, float y, float sx, float sy, float rot, uint32_t tint) {
    Tgt *t = &TG[cur]; blit(t, im, 0, 0, im->sw, im->sh, TX(t, x), TY(t, y), im->lw * sx * t->s, im->lh * sy * t->s, rot, tint);
}
void plat_img_draw_part(const Img *im, int sx, int sy, int sw, int sh, float x, float y, float w, float h, uint32_t tint) {
    Tgt *t = &TG[cur]; float fx = (float)im->sw / im->lw, fy = (float)im->sh / im->lh;
    blit(t, im, sx * fx, sy * fy, (sx + sw) * fx, (sy + sh) * fy, TX(t, x), TY(t, y), w * t->s, h * t->s, 0, tint);
}

/* ---------------------------------------------------------------- text */
typedef struct { u32 cp; u8 adv; s8 bx, by; u8 w, h; u8 pad[3]; u32 off; } __attribute__((packed)) Glyph;
typedef struct { u8 px, asc, hh, pad; u32 tab, bmp; } __attribute__((packed)) SizeRec;
static u8 *fontdata; static int nsizes, nglyphs; static const SizeRec *srec;
static const SizeRec *pick_size(float px) {
    const SizeRec *best = srec; float bd = 1e9f;
    for (int i = 0; i < nsizes; i++) { float d = fabsf(srec[i].px - px); if (d < bd) { bd = d; best = &srec[i]; } }
    return best;
}
static const Glyph *find_glyph(const SizeRec *sz, u32 cp) {
    const Glyph *g = (const Glyph *)(fontdata + sz->tab); int lo = 0, hi = nglyphs - 1;
    while (lo <= hi) { int mid = (lo + hi) >> 1; u32 c = g[mid].cp; if (c == cp) return &g[mid]; if (c < cp) lo = mid + 1; else hi = mid - 1; }
    return NULL;
}
static u32 next_cp(const char **s) {
    const unsigned char *p = (const unsigned char *)*s; u32 c = *p++;
    if (c < 0x80) { } else if ((c & 0xE0) == 0xC0) { c = ((c & 31) << 6) | (*p++ & 63); } else if ((c & 0xF0) == 0xE0) { c = ((c & 15) << 12) | ((p[0] & 63) << 6) | (p[1] & 63); p += 2; } else { c = ((c & 7) << 18) | ((p[0] & 63) << 12) | ((p[1] & 63) << 6) | (p[2] & 63); p += 3; }
    *s = (const char *)p; return c;
}
static const SizeRec *size_for(float size) { return pick_size(size * TG[cur].s * 0.92f); }
float plat_text_w(float size, const char *s) {
    if (!fontdata) return (float)strlen(s) * size * 0.5f;
    const SizeRec *sz = size_for(size); float w = 0;
    while (*s) { u32 cp = next_cp(&s); const Glyph *g = find_glyph(sz, cp); if (!g) g = find_glyph(sz, '?'); if (g) w += g->adv; }
    return w / TG[cur].s;
}
static void draw_run(Tgt *t, const SizeRec *sz, float ox, float oy, uint32_t col, const char *s) {
    u16 c = rgb555(col); u32 ca = col & 255; int pen = (int)floorf(ox + 0.5f); int base = (int)floorf(oy + 0.5f) + sz->asc;
    while (*s) {
        u32 cp = next_cp(&s); const Glyph *g = find_glyph(sz, cp); if (!g) g = find_glyph(sz, '?'); if (!g) continue;
        if (g->w && g->h) {
            const u8 *bm = fontdata + sz->bmp + g->off; int gx = pen + g->bx, gy = base - g->by;
            for (int yy = 0; yy < g->h; yy++) {
                int py = gy + yy; if ((unsigned)py >= H) continue; u16 *row = t->px + py * W;
                for (int xx = 0; xx < g->w; xx++) {
                    int px = gx + xx; if ((unsigned)px >= W) continue;
                    u32 a = (bm[yy * g->w + xx] * ca) >> 11; if (!a) continue; if (a > 32) a = 32;
                    row[px] = a >= 31 ? c : bl(row[px], c, a);
                }
            }
        }
        pen += g->adv;
    }
}
void plat_text(float x, float y, float size, uint32_t col, int fl, const char *s) {
    if (!fontdata || !*s) return;
    Tgt *t = &TG[cur]; const SizeRec *sz = size_for(size);
    float w = plat_text_w(size, s) * t->s; float ox = TX(t, x), oy = TY(t, y);
    if (fl & T_CENTER) ox -= w / 2; else if (fl & T_RIGHT) ox -= w;
    if (fl & T_SHADOW) draw_run(t, sz, ox + 1, oy + 1, RGBA(0, 0, 0, (int)((col & 255) * 0.6f)), s);
    draw_run(t, sz, ox, oy, col, s);
}

/* ---------------------------------------------------------------- persistence: cartridge backup memory (+ RAM mirror) */
#define MAXKEYS 24
static struct { char name[44]; char *data; size_t len; } kv[MAXKEYS];
static int sav_type = -1; static u32 sav_size; static u8 *sav_img, *sav_disk;
#define SAV_USE 65536u
static void sav_flush(void) {
    if (sav_type < 2 || !sav_img) return;
    /* serialise */
    memset(sav_img, 0, sav_size); u8 *p = sav_img; memcpy(p, "OSH2", 4); p += 8; int cnt = 0;
    for (int i = 0; i < MAXKEYS; i++) if (kv[i].data) {
        size_t nl = strlen(kv[i].name); if ((size_t)(p - sav_img) + 8 + nl + kv[i].len > sav_size) break;
        *p++ = (u8)nl; memcpy(p, kv[i].name, nl); p += nl; *p++ = kv[i].len & 255; *p++ = (kv[i].len >> 8) & 255; *p++ = (kv[i].len >> 16) & 255; memcpy(p, kv[i].data, kv[i].len); p += kv[i].len; cnt++;
    }
    u32 used = (u32)(p - sav_img); memcpy(sav_img + 4, &used, 4); (void)cnt;
    if (sav_type == 3) { /* flash: erase the sectors we use, rewrite */
        for (u32 a = 0; a < sav_size; a += 0x10000) { cardEepromSectorErase(a); }
        for (u32 a = 0; a < sav_size; a += 256) cardWriteEeprom(a, sav_img + a, 256, sav_type);
    } else {
        for (u32 a = 0; a < sav_size; a += 128) if (memcmp(sav_img + a, sav_disk + a, 128)) cardWriteEeprom(a, sav_img + a, 128, sav_type);
    }
    memcpy(sav_disk, sav_img, sav_size);
}
static void sav_init(void) {
    sav_type = cardEepromGetType(); dbg[11] = sav_type;
    if (sav_type < 2) return;
    sav_size = cardEepromGetSize(); dbg[12] = sav_size; if (sav_size > SAV_USE) sav_size = SAV_USE;
    sav_img = malloc(sav_size); sav_disk = malloc(sav_size); if (!sav_img || !sav_disk) { sav_type = -1; return; }
    cardReadEeprom(0, sav_disk, sav_size, sav_type); memcpy(sav_img, sav_disk, sav_size);
    if (memcmp(sav_disk, "OSH2", 4)) return;
    u32 used; memcpy(&used, sav_disk + 4, 4); if (used > sav_size) return;
    const u8 *p = sav_disk + 8; int k = 0;
    while ((u32)(p - sav_disk) + 4 < used && k < MAXKEYS) {
        int nl = *p++; if (!nl) break; memcpy(kv[k].name, p, nl); kv[k].name[nl] = 0; p += nl; size_t len = p[0] | p[1] << 8 | p[2] << 16; p += 3;
        kv[k].data = malloc(len + 1); if (!kv[k].data) break; memcpy(kv[k].data, p, len); kv[k].data[len] = 0; kv[k].len = len; p += len; k++;
    }
}
bool plat_store_read(const char *name, char **data, size_t *len) {
    for (int i = 0; i < MAXKEYS; i++) if (kv[i].data && !strcmp(kv[i].name, name)) { *data = malloc(kv[i].len + 1); if (!*data) return false; memcpy(*data, kv[i].data, kv[i].len); (*data)[kv[i].len] = 0; *len = kv[i].len; return true; }
    return false;
}
bool plat_store_write(const char *name, const char *data, size_t len) {
    int slot = -1; for (int i = 0; i < MAXKEYS; i++) { if (kv[i].data && !strcmp(kv[i].name, name)) { slot = i; break; } if (!kv[i].data && slot < 0) slot = i; }
    if (slot < 0) return false;
    char *d = malloc(len + 1); if (!d) return false; memcpy(d, data, len); d[len] = 0;
    free(kv[slot].data); kv[slot].data = d; kv[slot].len = len; strncpy(kv[slot].name, name, 43); kv[slot].name[43] = 0;
    sav_flush(); return true;
}
void plat_store_remove(const char *name) {
    for (int i = 0; i < MAXKEYS; i++) if (kv[i].data && !strcmp(kv[i].name, name)) { free(kv[i].data); kv[i].data = NULL; kv[i].len = 0; }
    sav_flush();
}
bool plat_asset_read(const char *name, char **data, size_t *len) {
    char p[96]; snprintf(p, sizeof p, "nitro:/%s", name); void *d; size_t n; if (!read_file(p, &d, &n)) return false; *data = d; *len = n; return true;
}

/* ---------------------------------------------------------------- audio (stubs for now) */
void plat_sfx(const char *name) { (void)name; }
void plat_music(const char *mood) { (void)mood; }
void plat_set_volume(float m, float s) { (void)m; (void)s; }

/* ---------------------------------------------------------------- lifecycle */
bool plat_init(int argc, char **argv) {
    (void)argc; (void)argv;
    TIMER_DATA(0) = 0; TIMER_CR(0) = TIMER_ENABLE | TIMER_DIV_1024; TIMER_DATA(1) = 0; TIMER_CR(1) = TIMER_ENABLE | TIMER_CASCADE;
    powerOn(POWER_ALL_2D);
    videoSetMode(MODE_5_2D); videoSetModeSub(MODE_5_2D);
    vramSetBankA(VRAM_A_MAIN_BG); vramSetBankC(VRAM_C_SUB_BG);
    int a = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0), b = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    vram_top = bgGetGfxPtr(a); vram_bot = bgGetGfxPtr(b);
    lcdMainOnTop();
    for (int i = 0; i < W * H; i++) { bb0[i] = bb1[i] = RGB15(3, 2, 6) | 0x8000; }
    dmaCopy(bb0, vram_top, sizeof bb0); dmaCopy(bb1, vram_bot, sizeof bb1);
    nitro_ok = nitroFSInit(NULL); dbg[1] = 10 + nitro_ok;
    void *d; size_t n;
    if (nitro_ok && read_file("nitro:/font.bin", &d, &n)) {
        fontdata = d; nsizes = fontdata[4] | fontdata[5] << 8; nglyphs = fontdata[6] | fontdata[7] << 8; srec = (const SizeRec *)(fontdata + 8);
    }
    sav_init();
    return nitro_ok && fontdata;
}
void plat_exit(void) {}
bool plat_frame_begin(void) {
    scanKeys(); u32 d = keysDown(), h = keysHeld(), u = keysUp();
    in.down = in.held = in.up = 0;
#define MAPK(ds, k) do { if (d & ds) in.down |= k; if (h & ds) in.held |= k; if (u & ds) in.up |= k; } while (0)
    MAPK(KEY_A, K_A); MAPK(KEY_B, K_B); MAPK(KEY_X, K_X); MAPK(KEY_Y, K_Y); MAPK(KEY_L, K_L); MAPK(KEY_R, K_R); MAPK(KEY_START, K_START); MAPK(KEY_SELECT, K_SELECT);
    MAPK(KEY_UP, K_UP); MAPK(KEY_DOWN, K_DOWN); MAPK(KEY_LEFT, K_LEFT); MAPK(KEY_RIGHT, K_RIGHT);
    in.touch_down = (d & KEY_TOUCH) != 0; in.touch_held = (h & KEY_TOUCH) != 0; in.touch_up = (u & KEY_TOUCH) != 0; in.dx = in.dy = 0;
    if (in.touch_held) {
        touchPosition tp; touchRead(&tp); int nx = (int)(tp.px / 0.8f), ny = (int)(tp.py / 0.8f);
        if (!in.touch_down) { in.dx = nx - in.tx; in.dy = ny - in.ty; } in.tx = nx; in.ty = ny;
    }
    return true;
}
void plat_frame_end(void) { dbg[3]++; swiWaitForVBlank(); dmaCopy(bb0, vram_top, sizeof bb0); dmaCopy(bb1, vram_bot, sizeof bb1); }
