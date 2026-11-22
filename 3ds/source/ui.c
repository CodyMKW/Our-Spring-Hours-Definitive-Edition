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
#ifdef OSH_DS
#define NIMG 40
#define IMG_BUDGET (1100u * 1024u)      /* DS: pictures live in the ~4 MB main RAM, so cap the cache by bytes */
#else
#define NIMG 44
#define IMG_BUDGET 0xFFFFFFFFu
#endif
static struct { char name[40]; Img *im; uint32_t used; } cache[NIMG]; static uint32_t tick;
Img *img_get(const char *name) {
    int free_i = -1, lru = 0;
    for (int i = 0; i < NIMG; i++) {
        if (cache[i].im && !strcmp(cache[i].name, name)) { cache[i].used = ++tick; return cache[i].im; }
        if (!cache[i].im && free_i < 0) free_i = i;
        if (cache[i].im && cache[i].used < cache[lru].used) lru = i;
    }
    /* make room first (DS: by bytes) */
    for (;;) {
        size_t tot = 0; int victim = -1;
        for (int i = 0; i < NIMG; i++) if (cache[i].im) { tot += plat_img_bytes(cache[i].im); if (victim < 0 || cache[i].used < cache[victim].used) victim = i; }
        if (tot < IMG_BUDGET || victim < 0) break;
        plat_img_free(cache[victim].im); cache[victim].im = NULL; free_i = victim;
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


/* ---- spring theme helpers */
void ui_petal(float x, float y, float r, float rot, uint32_t col) {
    for (int i = 0; i < 5; i++) { float a = rot + i * 1.2566f; plat_circle(x + cosf(a) * r * 0.55f, y + sinf(a) * r * 0.55f, r * 0.5f, col); }
    plat_circle(x, y, r * 0.28f, RGB(255, 214, 120));
}
void ui_card(float x, float y, float w, float h, float r, uint32_t col) {
    plat_rrect(x + 1, y + 3, w, h, r, RGBA(0, 0, 0, 60));          /* soft shadow */
    plat_rrect(x, y, w, h, r, col);
    plat_rect(x + r, y + 1, w - 2 * r, 1, RGBA(255, 255, 255, 70)); /* top sheen */
}
void ui_bg_bottom(float t) {
    plat_rect_grad(0, 0, 320, 240, RGB(78, 42, 92), RGB(34, 18, 52));
    for (int i = 0; i < 7; i++) { float x = fmodf(i * 61 + t * (6 + i), 360) - 20, y = 30 + i * 31 + sinf(t * 0.6f + i) * 8; plat_circle(x, y, 18 + (i % 3) * 9, RGBA(255, 150, 190, 14)); }
    for (int i = 0; i < 9; i++) {
        float sp = 10 + (i % 4) * 4, x = fmodf(i * 47 + t * sp * 0.6f + sinf(t * 0.8f + i) * 16, 340) - 10, y = fmodf(i * 29 + t * sp, 260) - 10;
        ui_petal(x, y, 3.2f + (i % 3) * 0.7f, t * 0.7f + i, RGBA(255, 184, 206, 190));
    }
    plat_rect(0, 0, 320, 1, RGBA(255, 255, 255, 40));
}
void ui_fade_edges(void) {   /* soft vignette over a top-screen picture */
    plat_rect_grad(0, 0, 400, 38, RGBA(14, 6, 24, 150), RGBA(14, 6, 24, 0));
    plat_rect_grad(0, 190, 400, 50, RGBA(14, 6, 24, 0), RGBA(14, 6, 24, 150));
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

        plat_target(0); if (!ui_art) ui_backdrop_draw(ui_time);
        if (ui_art) plat_img_draw(ui_art, 0, 0, 1, 1, 0, RGB(255, 255, 255));
        for (int i = 0; i < 16; i++) { float sp = 12 + (i % 4) * 5, x = fmodf(i * 53 + ui_time * sp * 0.7f + sinf(ui_time + i) * 20, 440) - 20, y = fmodf(i * 37 + ui_time * sp, 270) - 15; ui_petal(x, y, 4 + (i % 3), ui_time + i, RGBA(255, 200, 218, 215)); }
        ui_fade_edges();
        plat_rect_grad(0, 60, 400, 100, RGBA(20, 8, 32, 0), RGBA(20, 8, 32, 0));
        plat_text(200, 14, 30, RGB(255, 255, 255), T_CENTER | T_SHADOW, title);
        if (sub) { float w = plat_text_w(14, sub) + 28; plat_rrect(200 - w / 2, 52, w, 22, 11, RGBA(255, 120, 165, 210)); plat_text(200, 55, 14, RGB(255, 255, 255), T_CENTER, sub); }
        if (details && details[sel] && *details[sel]) { ui_card(20, 148, 360, 80, 10, RGBA(24, 10, 38, 205)); ui_text_box(34, 156, 332, 14, RGB(255, 245, 250), details[sel], 4); }
        plat_target(1);
        ui_bg_bottom(ui_time);
        plat_rect(0, 0, 320, 30, RGBA(255, 255, 255, 18)); plat_text(14, 6, 17, RGB(255, 214, 228), T_SHADOW, title);
        plat_rrect(266, 5, 46, 21, 10, RGBA(255, 255, 255, 46)); plat_text(289, 8, 14, RGB(255, 235, 245), T_CENTER, "Back");
        for (int r = 0; r < VIS; r++) {
            int idx = scroll + r; if (idx >= n) break;
            float y = Y0 + r * RH; bool f = idx == sel; float bob = f ? sinf(ui_time * 5) * 1.0f : 0;
            if (f) { plat_rrect(9, y - 1, 302, RH - 2, 9, RGB(255, 143, 180)); plat_rrect(10, y, 300, RH - 4, 8, RGB(255, 240, 246)); ui_petal(24 + bob, y + (RH - 4) / 2, 6, ui_time * 1.5f, RGB(255, 143, 180)); }
            else { ui_card(10, y, 300, RH - 4, 8, RGBA(255, 255, 255, 30)); }
            char b[200]; strncpy(b, items[idx], 199); b[199] = 0;
            while (plat_text_w(16, b) > 262 && strlen(b) > 4) b[strlen(b) - 1] = 0;
            plat_text(f ? 38 : 22, y + 4, 16, f ? RGB(92, 44, 78) : RGB(255, 238, 246), 0, b);
        }
        if (n > VIS) { plat_rrect(314, Y0, 3, VIS * RH - 4, 1, RGBA(255, 255, 255, 40)); float hh = (VIS * RH - 4) * (float)VIS / n; plat_rrect(314, Y0 + (VIS * RH - 4 - hh) * scroll / (float)(n - VIS), 3, hh, 1, RGBA(255, 160, 190, 230)); }
        plat_text(160, 222, 12, RGBA(255, 255, 255, 150), T_CENTER, "A: select   B: back   touch to pick");
    }
    return -1;
}
