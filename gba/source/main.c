#include "ui.h"
extern int ui_list_backdrop;

static void endings_screen(void) {
    static char lab[40][48]; const char *items[40]; int n = 0;
    for (int e = 0; e < story_nends && n < 40; e++) {
        char *d = lab[n]; int got = (G.endings >> e) & 1;
        d = scat(d, got ? "* " : "? "); scat(d, got ? story_str(story_ends[e].title) : story_str(story_ends[e].hint));
        if (strlen(lab[n]) > 36) lab[n][36] = 0;
        items[n] = lab[n]; n++;
    }
    int saved = ui_list_backdrop; ui_list_backdrop = -1; ui_list("Endings (* found)", items, n, 0, 1); ui_list_backdrop = saved;
}
static void options_screen(void) {
    for (;;) {
        char a[40], b[40]; scat(scat(a, "Text speed: "), G.textspeed == 0 ? "slow" : G.textspeed == 1 ? "normal" : G.textspeed == 2 ? "fast" : "instant"); scat(scat(b, "Skip unread text: "), G.skipunread ? "on" : "off");
        const char *it[] = { a, b };
        int saved = ui_list_backdrop; ui_list_backdrop = -1; int r = ui_list("Options", it, 2, 0, 1); ui_list_backdrop = saved;
        if (r < 0) return; if (r == 0) G.textspeed = (G.textspeed + 1) & 3; else G.skipunread ^= 1; save_global();
    }
}
static void chapter_select(void) {
    for (;;) {
        static const char *const PN[4] = { "Part I - Our Spring Hours", "Part II - Ashfall", "Part III - Last Light", "Bonus - The Hundredth Petal" };
        const char *items[4]; int map[4], n = 0;
        for (int p = 1; p <= 4; p++) { items[n] = PN[p - 1]; map[n++] = vn_part_unlocked(p) ? p : -p; }
        static char lock[4][40];
        for (int i = 0; i < n; i++) if (map[i] < 0) { char *d = scat(lock[i], "(locked) "); scat(d, PN[-map[i] - 1]); items[i] = lock[i]; }
        int r = ui_list("Chapter Select", items, n, 0, 1);
        if (r < 0) return; if (map[r] < 0) { ui_message("Locked", "Finish the previous part first."); continue; }
        int part = map[r];
        if (part == 1) { vn_new_game(1, 0); vn_play(); return; }
        const char *it2[8]; int idx[8], m = 0;
        if (part == 4 || ((G.carry_valid >> (part - 2)) & 1)) { it2[m] = "Carry over my last playthrough"; idx[m++] = -1; }
        if (part != 4) for (int k = 0; k < vn_preset_count(part); k++) { it2[m] = vn_preset_title(part, k); idx[m++] = k + 1; }
        if (!m) { it2[m] = "Start fresh"; idx[m++] = 0; }
        int r2 = ui_list("Start from...", it2, m, 0, 1);
        if (r2 < 0) continue;
        vn_new_game(part, idx[r2]); vn_play(); return;
    }
}

int main(void) {
    gfx_init(); save_init();
    for (;;) {
        int latest = vn_latest_slot();
        const char *items[6]; int map[6], n = 0;
        if (latest >= 0) { items[n] = "Continue"; map[n++] = 0; }
        items[n] = "New Game"; map[n++] = 1; items[n] = "Chapter Select"; map[n++] = 2; items[n] = "Load Game"; map[n++] = 3;
        items[n] = "Endings"; map[n++] = 4; items[n] = "Options"; map[n++] = 5;
        ui_list_backdrop = BG_courtyard_day;
        int r = ui_list("", items, n, 0, 0); r = map[r];
        ui_list_backdrop = -1;
        if (r == 0) { if (vn_load_slot(latest)) vn_play(); }
        else if (r == 1) { vn_new_game(1, 0); vn_play(); }
        else if (r == 2) chapter_select();
        else if (r == 3) { static char lab[13][48]; const char *it[13]; for (int i = 0; i < 13; i++) { char *d = lab[i]; if (i == 0) d = scat(d, "Auto: "); else { d = scat(d, "Slot "); d = snum(d, i); d = scat(d, ": "); } if (!slots[i].used) scat(d, "(empty)"); else { char t[48]; vn_chapter_text(t, &slots[i].st); scat(d, t); } it[i] = lab[i]; }
            int s = ui_list("Load which slot?", it, 13, 0, 1); if (s >= 0 && vn_load_slot(s)) vn_play(); }
        else if (r == 4) endings_screen();
        else options_screen();
        ui_bg_current = -1;
    }
}
