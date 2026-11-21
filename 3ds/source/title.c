/* title.c — title menu, chapter select, memories (endings list) and credits */
#include "game.h"
#include "js.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void start_game(const char *expr) { js_run(expr); vn_play(); }

static void chapter_select(char **parts, int np) {
    const char *it[4]; char nm[4][100]; int ids[4], n = 0;
    for (int i = 0; i < np; i++) {
        char *f[5]; char tmp[600]; snprintf(tmp, 600, "%s", parts[i]); int nf = split(tmp, '\x1f', f, 5); if (nf < 4) continue;
        snprintf(nm[n], 100, "Part %s: %s%s", f[0], f[1], f[2][0] == '1' ? "" : "  (locked)"); it[n] = nm[n]; ids[n] = i; n++;
    }
    it[n] = "Back"; int p = ui_menu("Chapter Select", "Jump to a part", it, NULL, n + 1, 0);
    if (p < 0 || p >= n) return;
    char *f[5]; char tmp[900]; snprintf(tmp, 900, "%s", parts[ids[p]]); split(tmp, '\x1f', f, 5);
    int part = atoi(f[0]);
    if (f[2][0] != '1') return;
    const char *v[10]; char vn[10][140]; char ex[10][96]; int m = 0;
    snprintf(vn[m], 140, "Start from the beginning"); snprintf(ex[m], 96, "Rt.newGame(%d)", part); v[m] = vn[m]; m++;
    if (part > 1 && f[3][0] == '1') { snprintf(vn[m], 140, "Carry over your Part %d ending", part - 1); snprintf(ex[m], 96, "Rt.newGame(%d,'carry')", part); v[m] = vn[m]; m++; }
    char *pr[8]; int npr = split(f[4], '\x1d', pr, 8);
    for (int i = 0; i < npr && m < 9; i++) { char *q[2]; int k = split(pr[i], '\x1c', q, 2); if (k < 2) continue; snprintf(vn[m], 140, "%s", q[1]); snprintf(ex[m], 96, "Rt.newGame(%d,'%s')", part, q[0]); v[m] = vn[m]; m++; }
    v[m] = "Back";
    char sub[60]; snprintf(sub, 60, "Part %d", part);
    int q = ui_menu("How should it begin?", sub, v, NULL, m + 1, 0);
    if (q >= 0 && q < m) start_game(ex[q]);
}

void gallery_play(void) {
    char *all = js_str("Flat.endings()"); char *recs[40]; int n = split(all, '\x1e', recs, 40);
    static char nm[40][130], det[40][260]; const char *it[40], *de[40]; int c = 0;
    for (int i = 0; i < n; i++) {
        char *f[6]; int k = split(recs[i], '\x1f', f, 6); if (k < 6) continue;
        bool got = f[5][0] == '1';
        snprintf(nm[c], 130, "Part %s  -  %s", f[2], got ? f[1] : "???");
        snprintf(det[c], 260, got ? "%s" : "Not found yet.", f[4]);
        it[c] = nm[c]; de[c] = det[c]; c++;
    }
    char sub[60]; ui_menu("Memories", "Endings you've found", it, de, c ? c : 1, 0); (void)sub;
    free(all);
}

void credits_play(void) {
    static const char *L[] = { "Our Spring Hours", "Definitive Edition", "", "A visual novel in three parts", "and a bonus chapter", "", "Story & world", "CodyMKW and friends", "", "Original draft", "Gemini", "", "Definitive Edition rebuild", "Claude", "", "Blossom Drop", "inspired by the Suika Game", "", "3DS homebrew port", "devkitPro / libctru / citro2d", "QuickJS by Fabrice Bellard", "stb_image by Sean Barrett", "", "Thank you for playing.", NULL };
    int n = 0; while (L[n]) n++;
    float y = 250; Img *bg = img_get("bg_night_sky");
    while (ui_frame()) {
        const Input *in = plat_input(); y -= (in->held & K_A) || in->touch_held ? 1.6f : 0.45f;
        if (in->down & (K_B | K_START)) break; if (y < -n * 24 - 20) break;
        plat_target(0); if (bg) plat_img_draw(bg, 0, 0, 1, 1, 0, RGB(255, 255, 255)); plat_rect(0, 0, 400, 240, RGBA(10, 4, 20, 120)); ui_backdrop_draw(0); 
        if (bg) plat_img_draw(bg, 0, 0, 1, 1, 0, RGB(255, 255, 255)); plat_rect(0, 0, 400, 240, RGBA(10, 4, 20, 140));
        for (int i = 0; i < n; i++) { float yy = y + i * 24; if (yy > -20 && yy < 240) plat_text(200, yy, (i == 0) ? 28 : 16, (L[i][0] && (i == 0 || i == 1)) ? RGB(255, 200, 220) : RGB(255, 245, 250), T_CENTER | T_SHADOW, L[i]); }
        plat_target(1); plat_rect_grad(0, 0, 320, 240, RGB(62, 34, 74), RGB(34, 18, 48));
        plat_text(160, 108, 16, RGB(255, 210, 225), T_CENTER, "Hold A to speed up   B: skip");
    }
}

void title_loop(void) {
    ui_art = img_get("bg_courtyard_bloom");
    while (!g_quit) {
        char *info = js_str("Flat.title()"); char *sep = strchr(info, '\x1b'); if (sep) *sep++ = 0; else sep = (char *)"";
        char *h[8]; int nh = split(info, '\x1f', h, 8); for (int k = nh; k < 8; k++) h[k] = (char *)"";
        char *parts[4]; int np = split(sep, '\x1e', parts, 4);
        bool hasLatest = h[0][0] != 0, bonus = h[4][0] == '1';
        const char *it[10]; int act[10], n = 0; char cont[200], prog[80];
        if (hasLatest) { snprintf(cont, 200, "Continue  -  Part %s, %s", h[1], h[2]); it[n] = cont; act[n++] = 0; }
        it[n] = "New Game"; act[n++] = 1; it[n] = "Chapter Select"; act[n++] = 2; it[n] = "Load Game"; act[n++] = 3;
        if (bonus) { it[n] = "Bonus: The Hundredth Petal"; act[n++] = 4; }
        it[n] = "Blossom Drop"; act[n++] = 5; it[n] = "Memories"; act[n++] = 6; it[n] = "Options"; act[n++] = 7; it[n] = "Credits"; act[n++] = 8;
        snprintf(prog, 80, "Endings found: %s / %s", h[5], h[6]);
        static char slotbuf[16]; snprintf(slotbuf, 16, "%s", h[0]);
        int p = ui_menu("Our Spring Hours", prog, it, NULL, n, 0); ui_art = img_get("bg_courtyard_bloom");
        if (g_quit) { free(info); break; }
        if (p < 0) { free(info); continue; }
        char ex[64];
        switch (act[p]) {
            case 0: snprintf(ex, 64, "Rt.loadSlot('%s')", slotbuf); start_game(ex); break;
            case 1: start_game("Rt.newGame(1)"); break;
            case 2: chapter_select(parts, np); break;
            case 3: { js_run("1"); /* reuse the in-game loader through a tiny helper below */
                extern int load_menu_start(void); if (load_menu_start()) vn_play(); } break;
            case 4: start_game("Rt.newGame(4,'carry')"); break;
            case 5: blossom_play(); break;
            case 6: gallery_play(); break;
            case 7: vn_options(); break;
            case 8: credits_play(); break;
        }
        ui_art = img_get("bg_courtyard_bloom");
        free(info);
    }
}

/* title-screen Load Game: pick a slot, load it, return true if something loaded */
int load_menu_start(void) {
    char *all = js_str("Flat.slots()"); char *recs[16]; int nr = split(all, '\x1e', recs, 16);
    static char names[16][64], dets[16][260]; const char *it[16], *de[16]; char key[16][8]; int n = 0;
    for (int r = 0; r < nr; r++) {
        char *f[5]; int nf = split(recs[r], '\x1f', f, 5); for (int k = nf; k < 5; k++) f[k] = (char *)"";
        bool empty = f[1][0] == '1', isauto = !strcmp(f[0], "auto");
        snprintf(names[n], 64, "%s  -  %s", isauto ? "Autosave" : (snprintf(key[n], 8, "%s", f[0]), "Slot"), empty ? "empty" : (*f[3] ? f[3] : "Saved"));
        if (!isauto) snprintf(names[n], 64, "Slot %s  -  %s", f[0], empty ? "empty" : (*f[3] ? f[3] : "Saved"));
        snprintf(key[n], 8, "%s", f[0]);
        if (empty) snprintf(dets[n], 260, "No save here yet."); else snprintf(dets[n], 260, "Part %s  -  %s\n\"%s\"", f[2], f[3], f[4]);
        it[n] = names[n]; de[n] = dets[n]; n++;
    }
    int p = ui_menu("Load Game", "Pick a save", it, de, n, 0); int ok = 0;
    if (p >= 0) { char e[64]; snprintf(e, 64, "Rt.loadSlot('%s')?1:0", key[p]); ok = js_int(e); }
    free(all); return ok;
}
