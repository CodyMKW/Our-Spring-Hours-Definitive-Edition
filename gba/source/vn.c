/* vn.c — story interpreter (port of 3ds/js/rt.js) + the in-game screens (line, menu, card, banner, ending, pause). */
#include "ui.h"

static VNState S EWRAM;
static VNState hist[24] EWRAM; static int hist_n, hist_head;
static const u16 *cur_code; static u16 cur_snip = NONE;
static int line_seen, auto_mode, linesSinceSave;
static char tbuf[640] EWRAM;
static char toast[48]; static int toast_t;

#define CODE(i) story_code[story_label_off[S.label] + (i)]
static u32 gpos(void) { return story_label_off[S.label] + S.idx; }

/* ------------------------------------------------------------------ state helpers */
static const u8 SPK_MAX = 4;
static void stage_enter(int who) {
    for (int i = 0; i < S.nstage; i++) if (S.stage[i] == who) return;
    if (S.nstage >= SPK_MAX) { for (int i = 1; i < SPK_MAX; i++) S.stage[i - 1] = S.stage[i]; S.nstage--; }
    S.stage[S.nstage++] = who;
}
static void newstate(VNState *s, int part) {
    memset(s, 0, sizeof *s); s->part = part; s->label = (u16)(part == 1 ? LBL_p1_start : part == 2 ? LBL_p2_start : part == 3 ? LBL_p3_start : LBL_p4_start);
    s->hist[0] = s->hist[1] = s->hist[2] = s->hist[3] = 0xFF; s->bg = 0xFF; s->mood = 0xFF; s->wx = 0xFF; s->chapter_t = s->chapter_s = NONE;
}
static void carry_over(VNState *s, const VNState *prev, int part) {
    newstate(s, part);
    int k100 = part == 2 ? 50 : part == 3 ? 60 : 100;
    for (int i = 0; i < 5; i++) s->stats[i] = (prev->stats[i] * k100 + 50) / 100;   /* Math.round for non-negative */
    for (int i = 0; i < 4; i++) s->hist[i] = prev->hist[i];
    memcpy(s->flags, prev->flags, sizeof s->flags);
    if (part == 4) { s->dead = prev->dead; s->aloof = prev->aloof; }
}
typedef struct { u8 part; const char *title; s8 st[5]; u8 aloof; u8 nflags; u8 fl[3][2]; u8 hist[2]; } Preset;
static const Preset PRESETS[] = {
    { 2, "True Ending - everyone, and Uraraka too", { 9, 7, 3, 0, 0 }, 0, 2, { { F_confessed, V_true }, { F_partner, V_uraraka } }, { L_ending_true, 0xFF } },
    { 2, "Falling Petals - you and Uraraka", { 8, 3, 2, 0, 0 }, 0, 2, { { F_confessed, V_true }, { F_partner, V_uraraka } }, { L_ending_romance, 0xFF } },
    { 2, "Golden Hour - the friend group", { 3, 8, 3, 0, 0 }, 0, 1, { { F_partner, V_friends } }, { L_ending_friends, 0xFF } },
    { 2, "Tailwind - you and Falcon", { 2, 4, 9, 0, 0 }, 0, 1, { { F_partner, V_falcon } }, { L_ending_falcon, 0xFF } },
    { 2, "Static - you drifted apart", { 1, 1, 1, 0, 0 }, 5, 0, { { 0 } }, { L_ending_lonely, 0xFF } },
    { 3, "Inheritance - the courtyard held", { 9, 10, 5, 5, 1 }, 0, 2, { { F_confessed, V_true }, { F_partner, V_uraraka } }, { L_ending_true, L_end_inheritance } },
    { 3, "Ashfall Dawn - nobody lost", { 5, 6, 4, 3, 2 }, 0, 1, { { F_confessed, V_true } }, { L_ending_friends, L_end_ashfalldawn } },
    { 3, "Static Ledger - Light's leverage", { 4, 4, 3, 2, 6 }, 0, 0, { { 0 } }, { L_ending_friends, L_end_staticledger } },
    { 3, "Embers - you walked away", { 2, 4, 7, 2, 1 }, 0, 1, { { F_partner, V_falcon } }, { L_ending_falcon, L_end_embers } },
    { 3, "The Long Dark - you kept your distance", { 1, 1, 1, 0, 0 }, 3, 0, { { 0 } }, { L_ending_lonely, L_end_longdark } },
};
#define NPRESET ((int)(sizeof PRESETS / sizeof PRESETS[0]))
int vn_preset_count(int part) { int n = 0; for (int i = 0; i < NPRESET; i++) n += PRESETS[i].part == part; return n; }
const char *vn_preset_title(int part, int idx) { for (int i = 0; i < NPRESET; i++) if (PRESETS[i].part == part && idx-- == 0) return PRESETS[i].title; return ""; }
static void preset_state(VNState *s, int part, int idx) {
    newstate(s, part);
    for (int i = 0; i < NPRESET; i++) if (PRESETS[i].part == part && idx-- == 0) {
        const Preset *p = &PRESETS[i];
        for (int k = 0; k < 5; k++) s->stats[k] = p->st[k]; s->aloof = p->aloof;
        for (int k = 0; k < p->nflags; k++) s->flags[p->fl[k][0]] = p->fl[k][1];
        s->hist[0] = p->hist[0]; s->hist[1] = p->hist[1];
    }
}
int vn_bonus_unlocked(void) {
    for (int part = 1; part <= 3; part++) { int ok = 0; for (int e = 0; e < story_nends; e++) if (story_ends[e].part == part && ((G.endings >> e) & 1)) ok = 1; if (!ok) return 0; }
    return 1;
}
int vn_part_unlocked(int part) {
    if (part == 1) return 1;
    if (part == 4) return vn_bonus_unlocked();
    if ((G.carry_valid >> (part - 2)) & 1) return 1;
    for (int e = 0; e < story_nends; e++) if (story_ends[e].part == part - 1 && ((G.endings >> e) & 1)) return 1;
    return 0;
}
int vn_latest_slot(void) { int best = -1; u32 bs = 0; for (int i = 0; i < 13; i++) if (slots[i].used && slots[i].stamp >= bs) { bs = slots[i].stamp; best = i; } return best; }

/* ------------------------------------------------------------------ view state */
enum { VW_NONE, VW_LINE, VW_MENU, VW_CARD, VW_BANNER, VW_WAIT, VW_ENDING };
static int view;
typedef struct { u16 str, got; u16 reqfn; s8 fx[6]; u16 nset; const u16 *sets; } Opt;
static Opt opts[8]; static int nopts, menu_sel;
static int line_who = -1; static const char *ln_s[12]; static u8 ln_l[12]; static int ln_n, ln_page, ln_per, reveal, reveal_total, speaking_blink;
static int bg_shown = -1, wx_shown = -2, stage_dirty = 1, timer;
static u16 card_t, card_s, card_e, card_p; 
static const EndDef *E; static int end_fresh, end_page, end_pages, end_menu;
static int end_ok;                        /* ending screen active */

static int is_char(int who) { return who >= 0 && who < N_CH; }
static void toast_show(const char *m) { char *d = toast; while (*m && d < toast + 46) *d++ = *m++; *d = 0; toast_t = 120; }

/* ------------------------------------------------------------------ drawing the scene */
static void draw_scene(int full) {
    obj_enable(1);
    if (S.bg != 0xFF && (S.bg != bg_shown || full)) { ui_show_bg(S.bg); bg_shown = S.bg; }
    if (S.bg == 0xFF) { memset(fb, COL_BLACK, sizeof fb); }
    if (S.wx != wx_shown) { weather_set(S.wx == 0xFF ? NONE : S.wx); wx_shown = S.wx; }
    stage_set(S.stage, S.nstage, line_who);
    tbox_draw(); fb_flush(0, H);
}
static void layout_line(const char *txt) {
    ln_per = line_who >= 0 ? 3 : 4;
    ln_n = text_wrap(txt, W - 16, ln_s, ln_l, 12); ln_page = 0; reveal = 0;
}
static int page_lines(void) { int n = ln_n - ln_page * ln_per; return n > ln_per ? ln_per : n; }
static void draw_text_page(int upto) {                 /* upto = glyph budget for typewriter (-1 = all) */
    tbox_draw();
    int y0 = line_who >= 0 ? 122 : 114, left = upto;
    for (int i = 0; i < page_lines(); i++) {
        int li = ln_page * ln_per + i; char tmp[100]; int n = ln_l[li]; if (n > 99) n = 99; memcpy(tmp, ln_s[li], n); tmp[n] = 0;
        int cells = 0; for (const char *p = tmp; *p; p++) cells += ((u8)*p & 0xC0) != 0x80 && *p != '*';
        int take = upto < 0 ? -1 : (left < cells ? left : cells);
        text_draw_n(8, y0 + i * 11, tmp, take, RAMP_WHITE);
        if (upto >= 0) { left -= cells; if (left <= 0) break; }
    }
}
static const char *const CHNAME[N_CH] = { "Cody", "Joseph", "Falcon", "Cementoss", "Uraraka", "Light Yagami", "Maki Oze", "Tomura Shigaraki", "All For One" };
static void draw_name(void) { if (line_who >= 0) text_draw(8, 110, CHNAME[line_who], RAMP_NAME0 + line_who, W); }
static int page_cells(void) {
    int total = 0;
    for (int i = 0; i < page_lines(); i++) { int li = ln_page * ln_per + i; for (int k = 0; k < ln_l[li]; k++) { u8 c = ln_s[li][k]; total += (c & 0xC0) != 0x80 && c != '*'; } }
    return total;
}
static void redraw_box(int upto) { draw_text_page(upto); draw_name(); }

/* ------------------------------------------------------------------ interpreter */
static void snapshot(void) { hist[hist_head] = S; hist_head = (hist_head + 1) % 24; if (hist_n < 24) hist_n++; }
static void autosave(void) {
    Slot *s = &slots[0]; s->used = 1; s->stamp = ++G.stamp; s->st = S; s->snip = cur_snip; save_slot(0); save_global(); linesSinceSave = 0;
}
static void show_line(int who, const char *txt, u16 snip) {
    int isSay = is_char(who);
    if (isSay) { stage_enter(who); line_who = who; } else line_who = -1;
    stage_dirty = 1; cur_snip = snip;
    int len = strlen(txt); if (len > 630) len = 630; memcpy(tbuf, txt, len); tbuf[len] = 0;
    layout_line(tbuf); reveal_total = page_cells();
    S.lines++; linesSinceSave++;
    u32 gp = gpos() - 1; line_seen = seen_get(gp & 0xFFFF); seen_set(gp & 0xFFFF);
    view = VW_LINE;
}
static void show_ending(int eidx);
static void do_run(void);
static int load_menu(const u16 *p);
static void fatal(const char *m) { ui_message("Story error", m); view = VW_NONE; }

static const u8 OPLEN[32] = { 0, 3, 4, 2, 3, 3, 2, 2, 3, 5, 2, 2, 2, 2, 0, 3, 3, 2, 2, 2, 4, 2, 2, 0, 3 };
static void run(void) {
    for (int guard = 0; guard < 5000; guard++) {
        const u16 *c = &CODE(S.idx);
        switch (c[0]) {
        case OP_SAY: snapshot(); S.idx += OPLEN[OP_SAY]; show_line(c[1] == NONE ? -1 : c[1], story_str(c[2]), c[2]); return;
        case OP_SAYF: snapshot(); S.idx += OPLEN[OP_SAYF]; { static char dyn2[520]; const char *t = fn_text(c[2], &S, dyn2); show_line(c[1] == NONE ? -1 : c[1], t, NONE); } return;
        case OP_N: snapshot(); S.idx += OPLEN[OP_N]; show_line(-1, story_str(c[1]), c[1]); return;
        case OP_NF: snapshot(); S.idx += OPLEN[OP_NF]; { static char dyn[520]; const char *t = fn_text(c[1], &S, dyn); show_line(-1, t, NONE); } return;
        case OP_BG: S.idx += 3; if (!(c[2] & 1)) { S.nstage = 0; } S.bg = c[1]; stage_dirty = 1; break;
        case OP_MUSIC: S.idx += 2; S.mood = c[1] == NONE ? 0xFF : c[1]; break;
        case OP_WEATHER: S.idx += 2; S.wx = c[1] == NONE ? 0xFF : c[1]; break;
        case OP_CHAPTER: {
            S.chapter_t = c[1]; S.chapter_s = c[2]; VNState keep = S; S.idx += 3;
            card_t = c[1]; card_s = c[2]; view = VW_BANNER; timer = 100; snd_sfx(SFX_CHAPTER, 0);
            Slot *sl = &slots[0]; sl->used = 1; sl->stamp = ++G.stamp; sl->st = keep; sl->snip = NONE; save_slot(0); save_global(); return;
        }
        case OP_CARD: S.idx += 5; card_p = c[1]; card_t = c[2]; card_s = c[3]; card_e = c[4]; view = VW_CARD; return;
        case OP_SHAKE: S.idx += 2; fx_shake(c[1]); break;
        case OP_FLASH: S.idx += 2; fx_flash(0); break;
        case OP_PULSE: S.idx += 2; fx_flash(1); break;
        case OP_WAIT: S.idx += 2; timer = c[1] * 3 / 50; if (timer > 240) timer = 240; view = VW_WAIT; return;
        case OP_ADD: S.idx += 3; if (c[1] == ST_ALOOF) S.aloof += (s16)c[2]; else S.stats[c[1]] += (s16)c[2]; break;
        case OP_ADDF: S.idx += 3; S.flags[c[1]] += (s16)c[2]; break;
        case OP_SET: S.idx += 3; S.flags[c[1]] = c[2]; break;
        case OP_KILL: S.idx += 2; S.dead |= 1 << c[1]; break;
        case OP_JUMP: S.label = c[1]; S.idx = 0; break;
        case OP_BRANCH: S.label = fn_cond(c[1], &S) ? c[2] : c[3]; S.idx = 0; break;
        case OP_ROUTE: S.label = fn_route(c[1], &S); S.idx = 0; break;
        case OP_END: S.idx += 2; show_ending(c[1]); return;
        case OP_MENU: snapshot(); load_menu(c + 1); menu_sel = 0; view = VW_MENU; autosave(); return;
        default: fatal("bad opcode"); return;
        }
    }
    fatal("story loop");
}
/* menu records are variable-length (sets), so parse and remember the end */
static int load_menu(const u16 *p) {
    int n = p[0]; const u16 *q = p + 1; nopts = 0;
    for (int i = 0; i < n; i++) {
        Opt o; o.str = q[0]; o.got = q[1]; o.reqfn = q[2];
        o.fx[0] = (s8)(q[3] & 255); o.fx[1] = (s8)(q[3] >> 8); o.fx[2] = (s8)(q[4] & 255); o.fx[3] = (s8)(q[4] >> 8); o.fx[4] = (s8)(q[5] & 255); o.fx[5] = (s8)(q[5] >> 8);
        o.nset = q[6]; o.sets = q + 7; q += 7 + 2 * o.nset;
        if (o.reqfn == NONE || fn_cond(o.reqfn, &S)) { if (nopts < 8) opts[nopts++] = o; }
    }
    return (int)(q - p);
}
static const char *const TOASTS[5] = { "Uraraka will remember that.", "Your friends will remember that.", "Falcon will remember that.", "Maki will remember that.", "Light took note of that." };
static void choose(int i) {
    const Opt *o = &opts[i];
    for (int k = 0; k < 6; k++) {
        int a = o->fx[k]; if (!a) continue;
        if (k == ST_ALOOF) S.aloof += a; else { S.stats[k] += a; if (a > 0) toast_show(TOASTS[k]); }
    }
    for (int k = 0; k < o->nset; k++) S.flags[o->sets[2 * k]] = o->sets[2 * k + 1];
    S.label = o->got; S.idx = 0; view = VW_NONE; run();
}

/* ------------------------------------------------------------------ endings */
static void show_ending(int eidx) {
    E = &story_ends[eidx]; S.hist[E->part - 1] = eidx;
    end_fresh = !((G.endings >> eidx) & 1); G.endings |= 1u << eidx;
    if (E->part >= 1 && E->part <= 3) { G.carry[E->part - 1] = S; G.carry_valid |= 1 << (E->part - 1); }
    save_global(); slots[0].used = 0; save_slot(0);
    S.bg = E->bg; S.mood = E->mood; S.wx = E->wx == NONE ? 0xFF : E->wx; S.nstage = 0; stage_dirty = 1;
    end_page = 0; end_pages = 1 + E->nlines + (E->part == 3 ? 1 : 0); end_menu = 0; view = VW_ENDING; timer = 0;
}
static void draw_ending_page(void) {
    int dark = RAMP_DARK_WHITE;
    obj_enable(0);
    fb_fill(0, 0, W, H, RAMP(RAMP_DARK_WHITE));
    char b[64];
    if (end_page == 0) {
        static const char *const KIND[4] = { "BAD ENDING", "GOOD ENDING", "TRUE ENDING", "ENDING" };
        char *d = scat(b, "Part "); d = snum(d, E->part); (void)d;
        text_center(120, 22, E->part == 4 ? "Bonus Story" : b, RAMP_DARK_WHITE);
        text_center(120, 44, KIND[E->kind & 3], RAMP_DARK_GOLD);
        text_draw2x(120, 62, story_str(E->title), RAMP_DARK_WHITE);
        if (end_fresh) text_center(120, 100, "* New ending unlocked *", RAMP_DARK_GOLD);
        int got = 0; for (int e = 0; e < story_nends; e++) got += (G.endings >> e) & 1;
        char *q = scat(b, "Endings found: "); q = snum(q, got); q = scat(q, " / "); snum(q, story_nends);
        text_center(120, 118, b, RAMP_DARK_WHITE);
        text_center(120, 142, "A: continue", RAMP_DARK_GOLD);
    } else if (end_page <= E->nlines) {
        u16 l = E->lines[end_page - 1]; const char *t = (l & 0x8000) ? fn_text(l & 0x7FFF, &S, tbuf) : story_str(l);
        static char keep[560]; int n = strlen(t); if (n > 550) n = 550; memcpy(keep, t, n); keep[n] = 0;
        const char *st[10]; u8 ln[10]; int c = text_wrap(keep, W - 24, st, ln, 10);
        int y = 80 - c * 6;
        for (int i = 0; i < c; i++) { char tmp[100]; int m = ln[i] > 99 ? 99 : ln[i]; memcpy(tmp, st[i], m); tmp[m] = 0; text_draw(12, y + i * 12, tmp, RAMP_DARK_WHITE, W); }
        text_center(120, 146, "A: continue", RAMP_DARK_GOLD);
    } else {
        text_center(120, 18, "Who made it", RAMP_DARK_GOLD);
        for (int i = 0; i < 6; i++) { int ok; const char *nm = story_cast_line(&S, i, &ok); text_draw(40, 36 + i * 15, nm, RAMP_DARK_WHITE, W); text_draw(150, 36 + i * 15, ok ? "Alive" : "Lost", ok ? RAMP_DARK_GOLD : RAMP_DARK_WHITE, W); }
        text_center(120, 146, "A: continue", RAMP_DARK_GOLD);
    }
    (void)dark; fb_flush(0, H);
}

/* ------------------------------------------------------------------ pause / save / load */
static void slot_label(char *b, int i) {
    char *d = b; if (i == 0) d = scat(d, "Auto: "); else { d = scat(d, "Slot "); d = snum(d, i); d = scat(d, ": "); }
    if (!slots[i].used) { scat(d, "(empty)"); return; }
    char t[48]; vn_chapter_text(t, &slots[i].st); scat(d, t);
}
void vn_chapter_text(char *b, const VNState *s) {
    char *d = scat(b, "Pt "); d = snum(d, s->part); d = scat(d, " ");
    if (s->chapter_t != NONE) { d = scat(d, story_str(s->chapter_t)); }
    int n = strlen(b); if (n > 38) { b[38] = 0; }
}
void vn_snippet(char *b, int slot) { b[0] = 0; (void)slot; }
static int slots_menu(int saving) {
    static char labels[13][48]; const char *items[13]; int n = 0, map[13];
    for (int i = saving ? 1 : 0; i < 13; i++) { slot_label(labels[n], i); items[n] = labels[n]; map[n] = i; n++; }
    int r = ui_list(saving ? "Save to which slot?" : "Load which slot?", items, n, 0, 1);
    return r < 0 ? -1 : map[r];
}
static int pause_menu(void) {            /* returns 1 to return to title */
    for (;;) {
        const char *items[] = { "Resume", "Save", "Load", "Text speed", "Skip unread text", "Return to title", "Sound" };
        char b1[32], b2[32]; scat(scat(b1, "Text speed: "), G.textspeed == 0 ? "slow" : G.textspeed == 1 ? "normal" : G.textspeed == 2 ? "fast" : "instant");
        scat(scat(b2, "Skip unread: "), G.skipunread ? "on" : "off"); items[3] = b1; items[4] = b2; items[6] = G.music ? "Sound: on" : "Sound: off";
        int r = ui_list("Paused", items, 7, 0, 1);
        if (r <= 0) return 0;
        if (r == 1) { int s = slots_menu(1); if (s > 0) { slots[s].used = 1; slots[s].stamp = ++G.stamp; slots[s].st = S; slots[s].snip = cur_snip; save_slot(s); save_global(); ui_message("Saved.", ""); } }
        else if (r == 2) { int s = slots_menu(0); if (s >= 0 && slots[s].used) { S = slots[s].st; hist_n = 0; hist_head = 0; bg_shown = -1; wx_shown = -2; view = VW_NONE; run(); return 2; } }
        else if (r == 3) G.textspeed = (G.textspeed + 1) & 3;
        else if (r == 4) G.skipunread ^= 1;
        else if (r == 5) return 1;
        else if (r == 6) G.music ^= 1;
        save_global();
    }
}

int vn_load_slot(int slot) {
    if (!slots[slot].used) return 0;
    S = slots[slot].st; hist_n = 0; hist_head = 0; bg_shown = -1; wx_shown = -2; view = VW_NONE; linesSinceSave = 0;
    G.stamp++; return 1;
}
void vn_new_game(int part, int preset) {
    if (preset < 0) { if ((G.carry_valid >> (part - 2)) & 1 && part >= 2 && part <= 4) { int src = part == 4 ? 2 : part - 2; carry_over(&S, &G.carry[src], part); } else newstate(&S, part); }
    else if (preset > 0) preset_state(&S, part, preset - 1); else newstate(&S, part);
    hist_n = 0; hist_head = 0; bg_shown = -1; wx_shown = -2; view = VW_NONE;
}

/* ------------------------------------------------------------------ main play loop */
static void draw_menu(void) {
    obj_enable(0);
    fb_fill(0, 0, W, H, RAMP(RAMP_DARK_WHITE)); fb_fill(0, 0, W, 1, COL_ACCENT);
    int y = 6, lineh = 11;
    for (int i = 0; i < nopts; i++) {
        const char *st[4]; u8 ln[4]; const char *t = story_str(opts[i].str);
        int c = text_wrap(t, W - 24, st, ln, 4);
        int h = c * lineh + 4;
        if (i == menu_sel) fb_fill(4, y - 1, W - 8, h, RAMP(RAMP_SEL));
        for (int k = 0; k < c; k++) { char tmp[100]; int m = ln[k] > 99 ? 99 : ln[k]; memcpy(tmp, st[k], m); tmp[m] = 0; text_draw(10, y + 1 + k * lineh, tmp, i == menu_sel ? RAMP_SEL : RAMP_DARK_WHITE, W); }
        y += h + 3;
    }
    text_center(120, 150, "Up/Down + A: choose", RAMP_DARK_GOLD);
    fb_flush(0, H);
}
static void draw_banner(void) {
    draw_scene(1);
    fb_fill(0, 40, W, 56, RAMP(RAMP_DARK_WHITE)); fb_fill(0, 40, W, 1, COL_ACCENT); fb_fill(0, 95, W, 1, COL_ACCENT);
    text_draw2x(120, 48, story_str(card_t), RAMP_DARK_GOLD);
    if (story_str(card_s)[0]) text_center(120, 78, story_str(card_s), RAMP_DARK_WHITE);
    fb_flush(0, H);
}
static void draw_card(void) {
    obj_enable(0);
    fb_fill(0, 0, W, H, RAMP(RAMP_DARK_WHITE));
    if (story_str(card_e)[0]) text_center(120, 30, story_str(card_e), RAMP_DARK_GOLD);
    text_draw2x(120, 52, story_str(card_t), RAMP_DARK_WHITE);
    const char *st[6]; u8 ln[6]; int c = text_wrap(story_str(card_s), W - 40, st, ln, 6);
    for (int k = 0; k < c; k++) { char tmp[100]; int m = ln[k] > 99 ? 99 : ln[k]; memcpy(tmp, st[k], m); tmp[m] = 0; text_center(120, 90 + k * 12, tmp, RAMP_DARK_WHITE); }
    text_center(120, 146, "A: begin", RAMP_DARK_GOLD);
    fb_flush(0, H);
}

void vn_play(void) {
    int tw = 0, held_auto = 0, need_draw = 1, blink = 0;
    if (view == VW_NONE) run();
    for (;;) {
        ui_frame_end(); snd_music(S.mood);
        if (toast_t) { toast_t--; if (!toast_t) need_draw = 1; }
        switch (view) {
        case VW_NONE: run(); if (view == VW_NONE) return; need_draw = 1; break;
        case VW_LINE: {
            if (need_draw || stage_dirty) { draw_scene(0); stage_dirty = 0; need_draw = 0; redraw_box(0); fb_flush(BOX_Y, H); tw = 0; reveal = 0; reveal_total = page_cells(); }
            int speed = G.textspeed == 0 ? 1 : G.textspeed == 1 ? 2 : G.textspeed == 2 ? 4 : 999;
            int skipping = (keys_held & KEY_B) && (line_seen || G.skipunread);
            if (skipping) speed = 999;
            if (reveal < reveal_total) {
                reveal += speed; if (reveal > reveal_total) reveal = reveal_total;
                redraw_box(reveal); fb_flush(BOX_Y, H);
                if (keys_down & KEY_A) { reveal = reveal_total; redraw_box(-1); fb_flush(BOX_Y, H); }
            } else {
                blink++; if (!(blink & 15)) { int on = (blink >> 4) & 1; fb_fill(226, 150, 7, 4, on ? RAMP(RAMP_WHITE) : COL_BOX); fb_fill(227, 154, 5, 1, on ? RAMP(RAMP_WHITE) : COL_BOX); fb_fill(228, 155, 3, 1, on ? RAMP(RAMP_WHITE) : COL_BOX); fb_flush(148, 158); }
                int go = (keys_down & KEY_A) || skipping || (auto_mode && ++tw > 40 + reveal_total * 2);
                if (go) {
                    tw = 0;
                    if ((ln_page + 1) * ln_per < ln_n) { ln_page++; reveal = 0; reveal_total = page_cells(); redraw_box(0); fb_flush(BOX_Y, H); }
                    else { view = VW_NONE; if (linesSinceSave >= 14) autosave(); run(); need_draw = 1; if (skipping) { /* keep flying */ } }
                }
            }
            if (toast_t) { /* simple toast over the art */ fb_fill(0, 0, W, 12, RAMP(RAMP_DARK_WHITE)); text_center(120, 1, toast, RAMP_DARK_GOLD); fb_flush(0, 12); }
            if (keys_down & KEY_L && hist_n > 1) { hist_n--; hist_head = (hist_head + 23) % 24; hist_n--; hist_head = (hist_head + 23) % 24; S = hist[hist_head]; /* snapshot taken before the line; re-run */ view = VW_NONE; bg_shown = -1; wx_shown = -2; stage_dirty = 1; run(); need_draw = 1; }
            if (keys_down & KEY_R) { auto_mode ^= 1; toast_show(auto_mode ? "Auto: on" : "Auto: off"); }
            if (keys_down & KEY_START) { int r = pause_menu(); if (r == 1) return; need_draw = 1; stage_dirty = 1; bg_shown = -1; wx_shown = -2; (void)held_auto; }
            break;
        }
        case VW_MENU:
            if (need_draw) { draw_menu(); need_draw = 0; }
            if (keys_down & KEY_UP) { menu_sel = (menu_sel + nopts - 1) % nopts; need_draw = 1; }
            if (keys_down & KEY_DOWN) { menu_sel = (menu_sel + 1) % nopts; need_draw = 1; }
            if (keys_down & KEY_A) { choose(menu_sel); need_draw = 1; bg_shown = -1; stage_dirty = 1; wx_shown = -2; }
            if (keys_down & KEY_START) { int r = pause_menu(); if (r == 1) return; need_draw = 1; }
            break;
        case VW_BANNER:
            if (need_draw) { draw_banner(); need_draw = 0; }
            if (--timer <= 0 || (keys_down & KEY_A)) { view = VW_NONE; bg_shown = -1; need_draw = 1; stage_dirty = 1; }
            break;
        case VW_CARD:
            if (need_draw) { draw_card(); need_draw = 0; }
            if (keys_down & KEY_A) { view = VW_NONE; need_draw = 1; bg_shown = -1; }
            break;
        case VW_WAIT: if (--timer <= 0 || (keys_down & KEY_A)) { view = VW_NONE; } break;
        case VW_ENDING:
            if (need_draw) { if (end_page == 0) { ui_show_bg(E->bg); S.bg = E->bg; bg_shown = E->bg; } draw_ending_page(); need_draw = 0; }
            if (keys_down & KEY_A) {
                end_page++; need_draw = 1;
                if (end_page >= end_pages) {
                    const char *items[4]; int map[4], n = 0;
                    int part = E->part; int has_next = part < 3 || (part == 3 && vn_bonus_unlocked());
                    if (has_next) { items[n] = part < 3 ? "Continue to the next part" : "Play the bonus story"; map[n++] = 1; }
                    items[n] = "Rewind to the last choice"; map[n++] = 2;
                    items[n] = "Return to title"; map[n++] = 3;
                    int r = ui_list("What now?", items, n, 0, 0); r = map[r];
                    if (r == 1) { VNState nx; carry_over(&nx, &S, part == 3 ? 4 : part + 1); S = nx; hist_n = 0; hist_head = 0; bg_shown = -1; wx_shown = -2; view = VW_NONE; run(); need_draw = 1; }
                    else if (r == 2) { if (hist_n > 0) { hist_head = (hist_head + 23) % 24; hist_n--; S = hist[hist_head]; view = VW_NONE; bg_shown = -1; wx_shown = -2; run(); need_draw = 1; } else { end_page = 0; } }
                    else return;
                }
            }
            break;
        }
    }
}
