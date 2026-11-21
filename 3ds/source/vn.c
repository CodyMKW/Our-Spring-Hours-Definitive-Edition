/* vn.c — the visual novel player: top screen = background + character sprites, bottom screen = dialogue,
 * choices and touch buttons. The story itself runs in QuickJS (story.js); this file only draws events. */
#include "game.h"
#include "js.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const struct { const char *id; int h; } SPR[] = { {"cody",60},{"joseph",56},{"falcon",58},{"cementoss",56},{"uraraka",62},{"light",82},{"maki",84},{"shigaraki",70},{"allforone",68} };
static int spr_h(const char *id) { for (unsigned i = 0; i < sizeof SPR / sizeof *SPR; i++) if (!strcmp(SPR[i].id, id)) return SPR[i].h; return 60; }

#define MAXOPT 8
#define MAXENDL 48
static struct {
    char bg[40], prevbg[40]; float bgfade;
    char stage[4][24]; int nstage; char speaker[24];
    char weather[16];
    char name[40], text[1500]; uint32_t color; bool say, has_line; float reveal;
    char opts[MAXOPT][240]; int nopts, msel;
    bool card; char c_eyebrow[48], c_title[96], c_sub[200], c_lines[1500];
    bool waiting; float waitt;
    char b_title[96], b_sub[160]; float b_t;
    float shake, flash_t, pulse_t; uint32_t flash_col, pulse_col;
    char toast[120]; float toast_t;
    bool auto_, skip, hide_ui; float auto_t;
    bool ending; char errmsg[200];
    /* ending data */
    char e_id[48], e_title[120], e_kind[16], e_partname[48], e_hint[200], e_next[12], e_bg[40]; int e_part, e_got, e_total; bool e_fresh;
    char e_lines[MAXENDL][420]; int e_nlines; char e_cast[8][160]; int e_ncast;
} V;

static void cpy(char *d, size_t n, const char *s) { snprintf(d, n, "%s", s ? s : ""); }

static void clear_blockers(void) { V.has_line = false; V.nopts = 0; V.card = false; V.waiting = false; }

/* ---- pull events from the story runtime and apply them */
static void vn_events(void) {
    char *all = js_str("Flat.events()"); if (!*all) { free(all); return; }
    char *recs[128]; int nr = split(all, '\x1e', recs, 128);
    for (int r = 0; r < nr; r++) {
        char *f[24]; int nf = split(recs[r], '\x1f', f, 24); for (int k = nf; k < 24; k++) f[k] = (char *)"";
        const char *t = f[0];
        if (!strcmp(t, "scene")) {
            cpy(V.prevbg, 40, f[1]); cpy(V.bg, 40, f[1]); V.bgfade = 1;
            char *st[8]; char tmp[200]; cpy(tmp, 200, f[2]); int n = split(tmp, '\x1d', st, 8);
            V.nstage = 0; for (int i = 0; i < n && i < 4; i++) cpy(V.stage[V.nstage++], 24, st[i]);
            V.speaker[0] = 0; cpy(V.weather, 16, f[4]); plat_music(*f[3] ? f[3] : NULL);
            clear_blockers(); V.ending = false;
        } else if (!strcmp(t, "bg")) { cpy(V.prevbg, 40, V.bg); cpy(V.bg, 40, f[1]); V.bgfade = (f[2][0] == '1') ? 0.6f : 0; }
        else if (!strcmp(t, "stage")) {
            char *st[8]; char tmp[200]; cpy(tmp, 200, f[1]); int n = split(tmp, '\x1d', st, 8);
            V.nstage = 0; for (int i = 0; i < n && i < 4; i++) cpy(V.stage[V.nstage++], 24, st[i]);
            cpy(V.speaker, 24, f[2]);
        }
        else if (!strcmp(t, "music")) plat_music(*f[1] ? f[1] : NULL);
        else if (!strcmp(t, "weather")) cpy(V.weather, 16, f[1]);
        else if (!strcmp(t, "sfx")) plat_sfx(f[1]);
        else if (!strcmp(t, "banner")) { cpy(V.b_title, 96, f[1]); cpy(V.b_sub, 160, f[2]); V.b_t = 3.2f; }
        else if (!strcmp(t, "line")) {
            cpy(V.name, 40, f[2]); V.color = *f[3] ? col_hex(f[3]) : RGB(255, 255, 255); cpy(V.text, 1500, f[4]); V.say = f[5][0] == '1';
            V.has_line = true; V.reveal = 0; V.auto_t = 0; V.nopts = 0; V.card = false; V.waiting = false;
        }
        else if (!strcmp(t, "menu")) {
            char *o[MAXOPT]; int n = split(f[1], '\x1d', o, MAXOPT); V.nopts = n; V.msel = 0; for (int i = 0; i < n; i++) cpy(V.opts[i], 240, o[i]);
            V.has_line = false; V.skip = false; V.card = false; V.waiting = false;
        }
        else if (!strcmp(t, "card")) {
            cpy(V.c_eyebrow, 48, f[2]); cpy(V.c_title, 96, f[3]); cpy(V.c_sub, 200, f[4]);
            char *l[16]; int n = split(f[5], '\x1d', l, 16); V.c_lines[0] = 0;
            for (int i = 0; i < n; i++) { if (i) strncat(V.c_lines, "\n", sizeof V.c_lines - strlen(V.c_lines) - 1); strncat(V.c_lines, l[i], sizeof V.c_lines - strlen(V.c_lines) - 1); }
            V.card = true; V.has_line = false; V.skip = false;
        }
        else if (!strcmp(t, "wait")) { V.waiting = true; V.card = false; V.waitt = atoi(f[1]) / 1000.0f; }
        else if (!strcmp(t, "shake")) V.shake = 0.5f;
        else if (!strcmp(t, "flash")) { V.flash_t = 0.6f; V.flash_col = col_hex(f[1]); }
        else if (!strcmp(t, "pulse")) { V.pulse_t = 0.9f; V.pulse_col = col_hex(f[1]); }
        else if (!strcmp(t, "toast")) { cpy(V.toast, 120, f[1]); V.toast_t = 2.6f; }
        else if (!strcmp(t, "error")) { cpy(V.errmsg, 200, f[1]); V.toast_t = 8; cpy(V.toast, 120, f[1]); }
        else if (!strcmp(t, "ending")) {
            V.ending = true; V.has_line = false;
            cpy(V.e_id, 48, f[1]); cpy(V.e_title, 120, f[2]); cpy(V.e_kind, 16, f[3]); V.e_part = atoi(f[4]); cpy(V.e_partname, 48, f[5]); cpy(V.e_hint, 200, f[6]);
            V.e_fresh = f[7][0] == '1'; V.e_got = atoi(f[8]); V.e_total = atoi(f[9]);
            char *l[MAXENDL]; int n = split(f[10], '\x1d', l, MAXENDL); V.e_nlines = n; for (int i = 0; i < n; i++) cpy(V.e_lines[i], 420, l[i]);
            char *c[8]; int nc = split(f[11], '\x1d', c, 8); V.e_ncast = nc;
            for (int i = 0; i < nc; i++) { char *p[3]; int k = split(c[i], '\x1c', p, 3); if (k < 3) p[2] = (char *)""; snprintf(V.e_cast[i], 160, "%s %s: %s", p[1][0] == '1' ? "+" : "x", p[0], p[2]); }
            cpy(V.e_bg, 40, f[12]); cpy(V.e_next, 12, f[15]);
        }
    }
    free(all);
}

/* ---- drawing: top screen */
static float shx, shy;
static void draw_bg(void) {
    char nm[64]; Img *p = V.prevbg[0] ? (snprintf(nm, 64, "bg_%s", V.prevbg), img_get(nm)) : NULL;
    snprintf(nm, 64, "bg_%s", V.bg); Img *c = V.bg[0] ? img_get(nm) : NULL;
    plat_rect(0, 0, 400, 240, RGB(18, 12, 24));
    if (p && V.bgfade < 1) plat_img_draw(p, shx, shy, 1, 1, 0, RGB(255, 255, 255));
    if (c) plat_img_draw(c, shx, shy, 1, 1, 0, RGBA(255, 255, 255, (int)(255 * (V.bgfade > 1 ? 1 : V.bgfade))));
}
static void draw_weather(float t) {
    const char *w = V.weather; if (!*w) return;
    for (int i = 0; i < 28; i++) {
        float ph = i * 2.399f, x, y;
        if (!strcmp(w, "rain")) { x = fmodf(i * 31 + t * 90, 420) - 10; y = fmodf(i * 47 + t * 420, 260) - 10; plat_line(x, y, x - 3, y + 10, 1, RGBA(190, 210, 240, 150)); }
        else if (!strcmp(w, "petals")) { x = fmodf(i * 41 + t * 24 + sinf(t * 1.3f + ph) * 18, 420) - 10; y = fmodf(i * 29 + t * 32, 260) - 10; plat_circle(x, y, 2.5f, RGBA(255, 190, 210, 210)); }
        else if (!strcmp(w, "ash")) { x = fmodf(i * 37 + t * 8 + sinf(t + ph) * 10, 420); y = fmodf(i * 23 + t * 20, 250); plat_circle(x, y, 1.6f, RGBA(190, 190, 195, 170)); }
        else if (!strcmp(w, "embers")) { x = fmodf(i * 43 + sinf(t + ph) * 12, 420); y = 250 - fmodf(i * 19 + t * 34, 260); plat_circle(x, y, 1.6f, RGBA(255, 150, 60, 220)); }
        else if (!strcmp(w, "fireflies")) { x = 200 + sinf(t * 0.3f + ph) * 190; y = 130 + cosf(t * 0.4f + ph * 1.3f) * 100; plat_circle(x, y, 2, RGBA(255, 240, 140, (int)(120 + 120 * sinf(t * 2 + ph)))); }
        else { x = fmodf(i * 53 + t * 5, 420); y = fmodf(i * 31 + t * 7 + sinf(t * 0.5f + ph) * 8, 250); plat_circle(x, y, 1.2f, RGBA(255, 255, 255, 110)); }   /* dust */
    }
}
static void draw_stage(float t) {
    int n = V.nstage; static const float X[5][4] = { {0}, {200}, {135, 265}, {90, 200, 310}, {62, 152, 248, 338} };
    for (int i = 0; i < n; i++) {
        char nm[64]; snprintf(nm, 64, "ch_%s", V.stage[i]); Img *im = img_get(nm); if (!im) continue;
        float hh = spr_h(V.stage[i]) / 100.0f * 240.0f * 1.0f, sc = hh / plat_img_h(im);
        bool sp = V.speaker[0] && !strcmp(V.speaker, V.stage[i]);
        float lift = sp ? -3 + sinf(t * 3) * 1.2f : 0;
        uint32_t tint = (V.speaker[0] && !sp) ? RGB(150, 150, 165) : RGB(255, 255, 255);
        float w = plat_img_w(im) * sc;
        plat_img_draw(im, X[n][i] - w / 2 + shx, 242 - hh + lift + shy, sc, sc, 0, tint);
    }
}
static void draw_top(float t) {
    plat_target(0);
    if (V.shake > 0) { shx = sinf(t * 90) * 6 * V.shake * 2; shy = cosf(t * 77) * 4 * V.shake * 2; } else shx = shy = 0;
    draw_bg(); draw_weather(t);
    if (!V.card && !V.ending) draw_stage(t);
    if (V.pulse_t > 0) { uint32_t c = V.pulse_col; float a = V.pulse_t / 0.9f; for (int i = 0; i < 6; i++) plat_rect(0, i * 5, 400, 5, col_alpha(c, a * (1 - i / 6.0f) * 0.7f)), plat_rect(0, 240 - (i + 1) * 5, 400, 5, col_alpha(c, a * (1 - i / 6.0f) * 0.7f)); }
    if (V.flash_t > 0) plat_rect(0, 0, 400, 240, col_alpha(V.flash_col, V.flash_t / 0.6f));
    if (V.b_t > 0) {
        float a = V.b_t > 0.6f ? 1 : V.b_t / 0.6f; if (V.b_t > 2.8f) a = (3.2f - V.b_t) / 0.4f;
        plat_rect(0, 80, 400, 76, RGBA(20, 8, 28, (int)(170 * a)));
        plat_text(200, 90, 26, col_alpha(RGB(255, 255, 255), a), T_CENTER | T_SHADOW, V.b_title);
        plat_text(200, 124, 14, col_alpha(RGB(255, 220, 232), a), T_CENTER | T_SHADOW, V.b_sub);
    }
    if (V.card) {
        plat_rect_grad(0, 0, 400, 240, RGB(30, 14, 40), RGB(70, 30, 70));
        plat_text(200, 58, 14, RGB(255, 176, 200), T_CENTER, V.c_eyebrow);
        plat_text(200, 82, 30, RGB(255, 255, 255), T_CENTER | T_SHADOW, V.c_title);
        ui_text_box(40, 130, 320, 15, RGB(255, 230, 240), V.c_sub, 4);
    }
    if (V.toast_t > 0) { float w = plat_text_w(14, V.toast) + 24; plat_rrect(200 - w / 2, 8, w, 26, 8, RGBA(20, 8, 28, 200)); plat_text(200, 12, 14, RGB(255, 235, 245), T_CENTER, V.toast); }
}

/* ---- drawing: bottom screen */
static void draw_buttons(int focus) {
    static const char *L[5] = { "Auto", "Skip", "Log", "Save", "Menu" };
    for (int i = 0; i < 5; i++) {
        bool on = (i == 0 && V.auto_) || (i == 1 && V.skip);
        plat_rrect(8 + i * 61, 206, 58, 26, 6, on ? RGB(255, 143, 180) : RGBA(255, 255, 255, 46));
        plat_text(8 + i * 61 + 29, 210, 15, on ? RGB(60, 20, 40) : RGB(255, 235, 245), T_CENTER, L[i]);
        (void)focus;
    }
}
static void draw_bottom(float t) {
    plat_target(1);
    plat_rect_grad(0, 0, 320, 240, RGB(62, 34, 74), RGB(34, 18, 48));
    if (V.hide_ui) return;
    if (V.nopts) {
        plat_text(160, 4, 13, RGB(255, 200, 220), T_CENTER, "What do you do?");
        float y = 22; float size = 14;
        for (int i = 0; i < V.nopts; i++) {
            int st[8], en[8]; int nl = text_wrap(size, 284, V.opts[i], st, en, 4); float h = nl * (size + 2) + 10;
            bool f = i == V.msel;
            plat_rrect(8, y, 304, h, 7, f ? RGB(255, 236, 242) : RGB(255, 247, 250));
            if (f) plat_rrect_line(8, y, 304, h, 7, RGB(255, 120, 165));
            char b[260];
            for (int k = 0; k < nl; k++) { int l = en[k] - st[k]; memcpy(b, V.opts[i] + st[k], l); b[l] = 0; plat_text(18, y + 5 + k * (size + 2), size, RGB(80, 40, 64), 0, b); }
            y += h + 6;
        }
        return;
    }
    if (V.card) {
        ui_text_box(16, 20, 288, 15, RGB(255, 240, 246), V.c_lines, 9);
        if (fmodf(t, 1.0f) < 0.6f) plat_text(300, 180, 16, RGB(255, 190, 210), T_RIGHT, "A / tap");
        return;
    }
    if (V.has_line) {
        if (V.say) { float w = plat_text_w(16, V.name) + 22; plat_rrect(10, 4, w, 22, 8, V.color); plat_text(21, 5, 16, RGB(255, 255, 255), T_SHADOW, V.name); }
        ui_panel(8, 28, 304, 170, RGBA(14, 6, 22, 175));
        float size = 15; int st[16], en[16]; int nl = text_wrap(size, 284, V.text, st, en, 16);
        if (nl > 8) { size = 13; nl = text_wrap(size, 284, V.text, st, en, 16); }
        int shown = (int)V.reveal, len = (int)strlen(V.text);
        char b[512];
        for (int k = 0; k < nl; k++) {
            if (st[k] >= shown) break;
            int e = en[k] < shown ? en[k] : shown; int l = e - st[k]; if (l > 500) l = 500; memcpy(b, V.text + st[k], l); b[l] = 0;
            plat_text(16, 34 + k * (size + 3), size, RGB(255, 250, 252), T_SHADOW, b);
        }
        if (shown >= len && fmodf(t, 0.9f) < 0.55f) { plat_rect(296, 186, 10, 3, RGB(255, 170, 200)); plat_rect(299, 189, 4, 3, RGB(255, 170, 200)); }
    }
    draw_buttons(0);
}

/* ---- sub screens */
static void screen_log(void) {
    char *all = js_str("Flat.log()"); char *recs[80]; int nr = split(all, '\x1e', recs, 80);
    static char lines[600][200]; static uint32_t cols[600]; static bool isname[600]; int n = 0;
    for (int r = 0; r < nr && n < 560; r++) {
        char *f[3]; int nf = split(recs[r], '\x1f', f, 3); if (nf < 3) { f[2] = (char *)""; if (nf < 2) f[1] = (char *)""; }
        if (*f[0]) { cpy(lines[n], 200, f[0]); cols[n] = col_hex(f[1]); isname[n++] = true; }
        int st[16], en[16]; int k = text_wrap(13, 290, f[2], st, en, 16);
        for (int i = 0; i < k && n < 590; i++) { int l = en[i] - st[i]; if (l > 190) l = 190; memcpy(lines[n], f[2] + st[i], l); lines[n][l] = 0; cols[n] = RGB(255, 245, 250); isname[n++] = false; }
        if (n < 590) { lines[n][0] = 0; isname[n] = false; n++; }
    }
    int vis = 13; int top = n > vis ? n - vis : 0;
    while (ui_frame()) {
        const Input *in = plat_input();
        if (in->down & (K_B | K_X | K_START)) break;
        if (in->down & K_UP) top -= 3; if (in->down & K_DOWN) top += 3; if (in->held & K_L) top -= 1; if (in->held & K_R) top += 1;
        if (in->touch_held) top -= in->dy / 6;
        if (in->touch_up && in->ty < 26 && in->tx > 250) break;
        if (top < 0) top = 0; if (top > (n > vis ? n - vis : 0)) top = n > vis ? n - vis : 0;
        plat_target(0); draw_bg(); plat_rect(0, 0, 400, 240, RGBA(14, 6, 22, 190)); plat_text(200, 100, 28, RGB(255, 255, 255), T_CENTER | T_SHADOW, "Backlog"); plat_text(200, 138, 14, RGB(255, 220, 232), T_CENTER, "scroll with D-pad / drag   B: close");
        plat_target(1); plat_rect_grad(0, 0, 320, 240, RGB(40, 22, 56), RGB(26, 12, 38));
        for (int i = 0; i < vis && top + i < n; i++) { int k = top + i; plat_text(14, 6 + i * 17, 13, isname[k] ? cols[k] : RGB(255, 245, 250), isname[k] ? T_SHADOW : 0, lines[k]); }
        plat_rrect(262, 214, 50, 22, 6, RGBA(255, 255, 255, 50)); plat_text(287, 217, 14, RGB(255, 235, 245), T_CENTER, "Close");
        if (in->touch_up && in->tx > 262 && in->ty > 214) break;
    }
    free(all);
}

static void save_load_menu(bool saving) {
    char *all = js_str("Flat.slots()"); char *recs[16]; int nr = split(all, '\x1e', recs, 16);
    static char names[16][64], dets[16][260]; const char *it[16], *de[16]; int map[16], n = 0;
    for (int r = 0; r < nr; r++) {
        char *f[5]; int nf = split(recs[r], '\x1f', f, 5); for (int k = nf; k < 5; k++) f[k] = (char *)"";
        bool isauto = !strcmp(f[0], "auto"); if (saving && isauto) continue;
        bool empty = f[1][0] == '1';
        if (isauto) snprintf(names[n], 64, "Autosave  -  %s", empty ? "empty" : (*f[3] ? f[3] : "Saved"));
        else snprintf(names[n], 64, "Slot %s  -  %s", f[0], empty ? "empty" : (*f[3] ? f[3] : "Saved"));
        if (empty) snprintf(dets[n], 260, "No save here yet."); else snprintf(dets[n], 260, "Part %s  -  %s\n\"%s\"", f[2], f[3], f[4]);
        it[n] = names[n]; de[n] = dets[n]; map[n] = isauto ? 0 : atoi(f[0]); n++;
        if (isauto) map[n - 1] = -1;
    }
    char title[24]; snprintf(title, 24, "%s", saving ? "Save" : "Load");
    int pick = ui_menu(title, saving ? "Pick a slot to save to" : "Pick a save to load", it, de, n, 0);
    char expr[64];
    if (pick >= 0) {
        if (saving) { snprintf(expr, 64, "Rt.saveSlot(%d)", map[pick]); js_run(expr); snprintf(V.toast, 120, "Saved to slot %d", map[pick]); V.toast_t = 2; }
        else { if (map[pick] < 0) js_run("Rt.loadSlot('auto')"); else { snprintf(expr, 64, "Rt.loadSlot(%d)", map[pick]); js_run(expr); } vn_events(); }
    }
    free(all);
}

/* ---- endings */
static int ending_screen(void) {
    char nm[64]; snprintf(nm, 64, "bg_%s", V.e_bg); Img *bg = img_get(nm);
    int page = 0, total = V.e_nlines + (V.e_ncast ? 1 : 0); float t0 = 0;
    while (page < total) {
        if (!ui_frame()) return 0;
        const Input *in = plat_input(); t0 += 1.0f / 60;
        if ((in->down & K_A) || (in->touch_up && in->ty > 20)) page++;
        if (in->down & K_B && page > 0) page--;
        plat_target(0);
        if (bg) plat_img_draw(bg, 0, 0, 1, 1, 0, RGB(255, 255, 255)); else plat_rect(0, 0, 400, 240, RGB(30, 14, 40));
        plat_rect(0, 0, 400, 240, RGBA(14, 6, 22, 120));
        plat_text(200, 56, 14, RGB(255, 190, 210), T_CENTER | T_SHADOW, V.e_partname);
        plat_text(200, 80, 28, RGB(255, 255, 255), T_CENTER | T_SHADOW, V.e_title);
        if (V.e_fresh) plat_text(200, 124, 15, RGB(255, 230, 140), T_CENTER | T_SHADOW, "NEW ENDING");
        char b[80]; snprintf(b, 80, "Endings found: %d / %d", V.e_got, V.e_total); plat_text(200, 150, 14, RGB(255, 235, 245), T_CENTER | T_SHADOW, b);
        if (*V.e_hint) ui_text_box(40, 178, 320, 12, RGB(255, 225, 235), V.e_hint, 3);
        plat_target(1); plat_rect_grad(0, 0, 320, 240, RGB(62, 34, 74), RGB(34, 18, 48));
        ui_panel(8, 8, 304, 200, RGBA(14, 6, 22, 175));
        if (page < V.e_nlines) ui_text_box(16, 14, 288, 15, RGB(255, 250, 252), V.e_lines[page], 10);
        else { plat_text(16, 14, 16, RGB(255, 200, 220), 0, "Where everyone ended up"); for (int i = 0; i < V.e_ncast; i++) ui_text_box(16, 40 + i * 24, 290, 13, RGB(255, 245, 250), V.e_cast[i], 1); }
        if (fmodf(t0, 0.9f) < 0.55f) plat_text(300, 212, 16, RGB(255, 190, 210), T_RIGHT, "A / tap");
    }
    const char *items[4]; int act[4], n = 0; char nx[80];
    if (!strcmp(V.e_next, "part")) { snprintf(nx, 80, "Continue to Part %d", V.e_part + 1); items[n] = nx; act[n++] = 1; }
    else if (!strcmp(V.e_next, "bonus")) { items[n] = "Continue: The Hundredth Petal"; act[n++] = 2; }
    else { items[n] = "Roll credits"; act[n++] = 3; }
    items[n] = "Undo my last choice"; act[n++] = 4;
    items[n] = "Back to title"; act[n++] = 0;
    ui_art = bg; int p = ui_menu(V.e_title, "What now?", items, NULL, n, 0); ui_art = NULL;
    return p < 0 ? 0 : act[p];
}

/* ---- main player */
void vn_play(void) {
    memset(&V.nopts, 0, sizeof V.nopts); V.skip = V.auto_ = V.hide_ui = false; V.toast_t = 0;
    vn_events();
    float t = 0;
    while (ui_frame()) {
        const Input *in = plat_input(); float dt = 1.0f / 60; t += dt;
        /* timers */
        if (V.shake > 0) V.shake -= dt; if (V.flash_t > 0) V.flash_t -= dt; if (V.pulse_t > 0) V.pulse_t -= dt;
        if (V.b_t > 0) V.b_t -= dt; if (V.toast_t > 0) V.toast_t -= dt;
        if (V.bgfade < 1) V.bgfade += dt * 2.2f;
        int len = (int)strlen(V.text);
        if (V.has_line && V.reveal < len) { static const float SP[4] = { 0, 60, 110, 220 }; V.reveal += SP[cfg.textspeed] * dt * 1.0f; if (V.reveal > len) V.reveal = (float)len; }
        /* what did the player ask for this frame? */
        bool advance = false; int choice = -1; bool open_menu = false, open_log = false, do_save = false;
        if (in->down & K_SELECT) V.hide_ui = !V.hide_ui;
        if (V.hide_ui) { if (in->down || in->touch_up) V.hide_ui = false; goto draw; }
        if (in->down & K_START) open_menu = true;
        if (in->down & K_X) open_log = true;
        if (in->down & K_Y) V.auto_ = !V.auto_;
        if (in->down & K_L) { js_run("Rt.rollback()"); V.skip = false; vn_events(); }
        V.skip = V.skip ? true : false;
        if (in->held & K_R) V.skip = true; else if (in->up & K_R) V.skip = false;
        if (in->touch_down) {
            if (in->ty >= 206 && !V.nopts && !V.card) {
                int b = (in->tx - 8) / 61;
                if (b == 0) V.auto_ = !V.auto_; else if (b == 1) V.skip = !V.skip; else if (b == 2) open_log = true; else if (b == 3) do_save = true; else if (b == 4) open_menu = true;
            }
        }
        if (V.nopts) {
            if (in->down & K_UP) V.msel = (V.msel + V.nopts - 1) % V.nopts;
            if (in->down & K_DOWN) V.msel = (V.msel + 1) % V.nopts;
            if (in->down & K_A) choice = V.msel;
            if (in->touch_up) {
                float y = 22;
                for (int i = 0; i < V.nopts; i++) { int st[8], en[8]; int nl = text_wrap(14, 284, V.opts[i], st, en, 4); float h = nl * 16 + 10; if (in->ty >= y && in->ty < y + h) { V.msel = i; choice = i; } y += h + 6; }
            }
        } else if (V.waiting) { V.waitt -= dt; if (V.waitt <= 0 || (in->down & K_A)) advance = true; }
        else if (V.card || V.has_line) {
            bool press = (in->down & K_A) || (in->touch_up && in->ty > 28 && in->ty < 204 && !V.skip) || (in->touch_up && V.card);
            if (press) { if (V.has_line && V.reveal < len) V.reveal = (float)len; else { advance = true; } }
            else if (V.has_line && V.reveal >= len && V.auto_) { V.auto_t += dt; static const float AD[4] = { 0, 2.8f, 1.8f, 0.9f }; if (V.auto_t > AD[cfg.autospeed] + len * 0.02f) advance = true; }
            else if (V.has_line && V.skip) { if (V.reveal < len) V.reveal = (float)len; advance = true; }
        }
        if (V.skip && V.has_line && advance) {
            /* skipping: fast-forward several lines per frame, stop at unread text unless allowed */
            for (int k = 0; k < 4; k++) {
                if (!cfg.skipunread && js_int("Rt.nextUnread()?1:0")) { V.skip = false; break; }
                js_run("Rt.advance()"); vn_events(); if (!V.has_line || V.ending) break;
            }
            advance = false;
        }
        if (choice >= 0) { char e[40]; snprintf(e, 40, "Rt.choose(%d)", choice); js_run(e); V.nopts = 0; vn_events(); }
        else if (advance) { js_run("Rt.advance()"); vn_events(); }
        if (do_save) { if (js_int("Rt.canSave()?1:0")) save_load_menu(true); else { snprintf(V.toast, 120, "Can't save right now"); V.toast_t = 2; } }
        if (open_log) screen_log();
        if (open_menu) {
            const char *it[7] = { "Resume", "Save", "Load", "Backlog", "Options", "Go back one line", "Save progress and return to title" };
            int p = ui_menu("Paused", NULL, it, NULL, 7, 0); if (g_quit) break;
            if (p == 1) { if (js_int("Rt.canSave()?1:0")) save_load_menu(true); }
            else if (p == 2) save_load_menu(false);
            else if (p == 3) screen_log();
            else if (p == 4) vn_options();
            else if (p == 5) { js_run("Rt.rollback()"); vn_events(); }
            else if (p == 6) { js_run("Rt.toTitle()"); return; }
        }
        if (V.ending) {
            int a = ending_screen(); if (g_quit) break;
            if (a == 1) { js_run("Rt.ending('next')"); vn_events(); }
            else if (a == 2) { js_run("Rt.ending('bonus')"); vn_events(); }
            else if (a == 3) { credits_play(); js_run("Rt.toTitle()"); return; }
            else if (a == 4) { js_run("Rt.ending('undo')"); vn_events(); }
            else { js_run("Rt.toTitle()"); return; }
        }
        if (V.errmsg[0] && (in->down & K_A)) { V.errmsg[0] = 0; js_run("Rt.toTitle()"); return; }
    draw:
        draw_top(t); draw_bottom(t);
    }
    js_run("Rt.toTitle()");
}

/* ---- options */
void vn_options(void) {
    int sel = 0;
    while (1) {
        static char b[6][64]; const char *it[6];
        static const char *SPD[4] = { "", "Slow", "Normal", "Instant" }, *AS[4] = { "", "Slow", "Normal", "Fast" };
        snprintf(b[0], 64, "Music volume:  %d / 10", cfg.music); snprintf(b[1], 64, "Sound effects:  %d / 10", cfg.sfx);
        snprintf(b[2], 64, "Text speed:  %s", SPD[cfg.textspeed]); snprintf(b[3], 64, "Auto-advance:  %s", AS[cfg.autospeed]);
        snprintf(b[4], 64, "Skip:  %s", cfg.skipunread ? "everything" : "only text you've read"); snprintf(b[5], 64, "Done");
        for (int i = 0; i < 6; i++) it[i] = b[i];
        static const char *det[6] = { "Procedural music volume. Tap or press A to cycle.", "Sound effects volume.", "How fast dialogue types out.", "How long Auto waits before moving on.", "Whether Skip stops at lines you haven't read yet.", "" };
        int p = ui_menu("Options", NULL, it, det, 6, sel); if (p < 0 || p == 5) break; sel = p;
        if (p == 0) cfg.music = (cfg.music + 1) % 11; else if (p == 1) cfg.sfx = (cfg.sfx + 1) % 11;
        else if (p == 2) cfg.textspeed = cfg.textspeed % 3 + 1; else if (p == 3) cfg.autospeed = cfg.autospeed % 3 + 1; else if (p == 4) cfg.skipunread = !cfg.skipunread;
        plat_set_volume(cfg.music / 10.0f, cfg.sfx / 10.0f);
    }
    cfg_save();
}
void cfg_load(void) {
    char *d; size_t n; if (!plat_store_read("osh3ds_cfg.txt", &d, &n)) return;
    int m, s, t, a, u; if (sscanf(d, "%d %d %d %d %d", &m, &s, &t, &a, &u) == 5) { cfg.music = m; cfg.sfx = s; cfg.textspeed = t < 1 ? 1 : t > 3 ? 3 : t; cfg.autospeed = a < 1 ? 1 : a > 3 ? 3 : a; cfg.skipunread = u; }
    free(d);
}
void cfg_save(void) { char b[64]; int n = snprintf(b, 64, "%d %d %d %d %d\n", cfg.music, cfg.sfx, cfg.textspeed, cfg.autospeed, cfg.skipunread); plat_store_write("osh3ds_cfg.txt", b, n); }
