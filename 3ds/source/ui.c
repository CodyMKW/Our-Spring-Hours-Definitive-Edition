#include "game.h"
#include "js.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

float ui_time; Img *ui_art; bool g_quit;
Cfg cfg = { 7, 8, 2, 2, 0, 1 };

bool ui_frame(void) {
    plat_frame_end();
    if (!plat_frame_begin()) { g_quit = true; return false; }
    ui_time += 1.0f / 60; return true;
}
bool ui_hit(int x, int y, int w, int h) { const Input *i = plat_input(); return i->touch_down && i->tx >= x && i->tx < x + w && i->ty >= y && i->ty < y + h; }
bool ui_touching(int x, int y, int w, int h) { const Input *i = plat_input(); return i->touch_held && i->tx >= x && i->tx < x + w && i->ty >= y && i->ty < y + h; }

/* ---- image cache (textures are big on a 3DS — keep a few backgrounds, all sprites) */
#define NIMG 24
static struct { char name[40]; Img *im; uint32_t used; } cache[NIMG]; static uint32_t tick;
Img *img_get(const char *name) {
    int free_i = -1, lru = 0;
    for (int i = 0; i < NIMG; i++) {
        if (cache[i].im && !strcmp(cache[i].name, name)) { cache[i].used = ++tick; return cache[i].im; }
        if (!cache[i].im && free_i < 0) free_i = i;
        if (cache[i].im && cache[i].used < cache[lru].used) lru = i;
    }
    Img *im = plat_img_load(name); if (!im) return NULL;
    int slot = free_i >= 0 ? free_i : lru;
    if (cache[slot].im) plat_img_free(cache[slot].im);
    strncpy(cache[slot].name, name, 39); cache[slot].im = im; cache[slot].used = ++tick; return im;
}

/* ---- drawing helpers */
void ui_panel(float x, float y, float w, float h, uint32_t col) { plat_rrect(x, y, w, h, 6, col); }
bool ui_button(float x, float y, float w, float h, const char *label, bool focus, uint32_t col, float size) {
    bool down = ui_touching((int)x, (int)y, (int)w, (int)h);
    uint32_t c = down ? RGB(255, 214, 224) : (focus ? RGB(255, 236, 242) : col);
    plat_rrect(x - 1, y - 1, w + 2, h + 2, 7, focus ? RGB(255, 143, 180) : RGBA(255, 255, 255, 60));
    plat_rrect(x, y, w, h, 6, c);
    plat_text(x + w / 2, y + (h - size) / 2 - 1, size, RGB(70, 40, 60), T_CENTER, label);
    return ui_hit((int)x, (int)y, (int)w, (int)h);
}
void ui_text_box(float x, float y, float w, float size, uint32_t col, const char *s, int maxlines) {
    int st[32], en[32]; if (maxlines > 32) maxlines = 32;
    int n = text_wrap(size, w, s, st, en, maxlines);
    char buf[512];
    for (int i = 0; i < n; i++) {
        int l = en[i] - st[i]; if (l > 500) l = 500; memcpy(buf, s + st[i], l); buf[l] = 0;
        plat_text(x, y + i * (size + 3), size, col, T_SHADOW, buf);
    }
}
void ui_backdrop_draw(float t) {
    int top = 1; (void)top;
    plat_rect_grad(0, 0, 400, 240, RGB(255, 226, 236), RGB(255, 190, 210));
    for (int i = 0; i < 26; i++) {
        float ph = i * 1.7f, sp = 12 + (i % 5) * 5;
        float x = fmodf(i * 53.0f + t * sp * 0.6f + sinf(t * 0.7f + ph) * 14, 440) - 20;
        float y = fmodf(i * 37.0f + t * sp, 270) - 15;
        plat_circle(x, y, 2 + (i % 3), RGBA(255, 255, 255, 150));
    }
}

/* ---- blocking list menu */
int ui_menu(const char *title, const char *sub, const char **items, const char **details, int n, int sel) {
    const int RH = 30, VIS = 6, Y0 = 36;
    int scroll = 0; float drag = 0; bool dragging = false; int tstart_y = 0;
    if (sel < 0 || sel >= n) sel = 0;
    while (ui_frame()) {
        const Input *in = plat_input();
        if (in->down & K_UP) sel = (sel + n - 1) % n;
        if (in->down & K_DOWN) sel = (sel + 1) % n;
        if (in->down & K_LEFT) { sel -= VIS; if (sel < 0) sel = 0; }
        if (in->down & K_RIGHT) { sel += VIS; if (sel >= n) sel = n - 1; }
        if (in->down & K_B) return -1;
        if (in->down & K_A) { plat_sfx("choice"); return sel; }
        if (sel < scroll) scroll = sel; if (sel >= scroll + VIS) scroll = sel - VIS + 1;
        if (in->touch_down) { dragging = false; drag = 0; tstart_y = in->ty; }
        if (in->touch_held && in->ty > Y0) { drag += in->dy; if (fabsf((float)(in->ty - tstart_y)) > 8) dragging = true; }
        if (dragging && fabsf(drag) >= RH && n > VIS) { int d = drag > 0 ? -1 : 1; scroll += d; drag = 0; if (scroll < 0) scroll = 0; if (scroll > n - VIS) scroll = n - VIS; }
        if (in->touch_up && !dragging && in->ty >= Y0 && in->ty < Y0 + VIS * RH) { int idx = scroll + (in->ty - Y0) / RH; if (idx < n) { sel = idx; plat_sfx("choice"); return sel; } }
        if (in->touch_up && in->ty < 28 && in->tx > 270 && !dragging) return -1;

        plat_target(0); ui_backdrop_draw(ui_time);
        if (ui_art) { plat_img_draw(ui_art, 0, 0, 1, 1, 0, RGBA(255, 255, 255, 235)); plat_rect(0, 0, 400, 240, RGBA(30, 10, 30, 90)); }
        plat_text(200, 12, 26, RGB(255, 255, 255), T_CENTER | T_SHADOW, title);
        if (sub) plat_text(200, 42, 14, RGB(255, 240, 246), T_CENTER | T_SHADOW, sub);
        if (details && details[sel] && *details[sel]) { ui_panel(20, 150, 360, 76, RGBA(30, 16, 36, 190)); ui_text_box(32, 158, 336, 14, RGB(255, 245, 250), details[sel], 4); }
        plat_target(1);
        plat_rect_grad(0, 0, 320, 240, RGB(70, 40, 80), RGB(40, 22, 56));
        plat_text(14, 8, 17, RGB(255, 210, 225), T_SHADOW, title);
        plat_rrect(272, 6, 40, 22, 6, RGBA(255, 255, 255, 40)); plat_text(292, 9, 15, RGB(255, 235, 245), T_CENTER, "Back");
        for (int r = 0; r < VIS; r++) {
            int idx = scroll + r; if (idx >= n) break;
            float y = Y0 + r * RH; bool f = idx == sel;
            plat_rrect(10, y, 300, RH - 4, 6, f ? RGB(255, 236, 242) : RGBA(255, 255, 255, 36));
            char b[200]; strncpy(b, items[idx], 199); b[199] = 0;
            while (plat_text_w(16, b) > 280 && strlen(b) > 4) b[strlen(b) - 1] = 0;
            plat_text(20, y + 4, 16, f ? RGB(80, 40, 64) : RGB(255, 240, 246), 0, b);
        }
        if (n > VIS) { plat_rect(314, Y0, 3, VIS * RH - 4, RGBA(255, 255, 255, 40)); float hh = (VIS * RH - 4) * (float)VIS / n; plat_rect(314, Y0 + (VIS * RH - 4 - hh) * scroll / (float)(n - VIS), 3, hh, RGBA(255, 160, 190, 220)); }
        plat_text(160, 222, 12, RGBA(255, 255, 255, 150), T_CENTER, "A: select   B: back   touch to pick");
    }
    return -1;
}
