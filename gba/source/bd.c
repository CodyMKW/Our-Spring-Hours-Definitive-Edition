/* bd.c — Blossom Drop on GBA: fixed-point position-based circle physics, hardware-sprite orbs. Rules follow blossom/js/game.js. */
#include "ui.h"
#include "bd_data.h"
extern int ui_list_backdrop;

#define FXS 8
#define SC22(v) ((v) * 5632 / 100)                 /* web "jar units" → 24.8 px at the 0.22 GBA scale */
#define JX 10
#define JY 24
#define JW_FX SC22(440)
#define FLOOR_FX SC22(584)
#define LINE_FX SC22(70)
#define MAXO 44
#ifndef BD_START_METER
#define BD_START_METER 400
#endif
typedef struct { s32 x, y, px, py; u8 tier, alive; u16 born, overT, pop; } Orb;
static Orb orb[MAXO] __attribute__((section(".iwram.d")));
static s32 rfx[10] __attribute__((section(".iwram.d"))); static u8 share[10][10] __attribute__((section(".iwram.d")));
static s32 RR[10][10] __attribute__((section(".iwram.d"))), IRR[10][10] __attribute__((section(".iwram.d"))), I2RR[10][10] __attribute__((section(".iwram.d")));
static u8 alist[MAXO] __attribute__((section(".iwram.d"))); static int na;

static int rng_s; static int rnd(void) { rng_s = rng_s * 1103515245 + 12345; return (rng_s >> 16) & 0x7FFF; }
static inline u32 isqrt(u32 n) { u32 r = 0, b = 1u << 30; while (b > n) b >>= 2; while (b) { if (n >= r + b) { n -= r + b; r = (r >> 1) + b; } else r >>= 1; b >>= 2; } return r; }

/* game state */
static int state;                 /* 0 play, 1 decree, 2 decay, 3 over, 4 paused */
static u32 score; static int frame, combo, lastMerge, merges, maxTier, bestCombo, meter;   /* meter in 0.1 units (0..1000) */
static int held, queue[6], dropReady; static s32 ptrx; static int cur_char, gravity, zero, vortex, shelf, shelfy, overWorst, abTime;
static s32 punch_x, punch_y; static int punch_on, decree_pick, decay_sel;
static char toastbuf[32]; static int toast_t;
typedef struct { s32 x, y, vx, vy; u8 life, tile; } Part; static Part parts[28];
static int dirty_hud;
u32 prof[6];
#define TNOW() ((u32)REG_TM0CNT_L | ((u32)REG_TM1CNT_L << 16))


static int rand_tier(void) { static const u8 w[5] = { 34, 28, 20, 12, 6 }; int r = rnd() % 100; for (int i = 0; i < 5; i++) { r -= w[i]; if (r < 0) return i + 1; } return 1; }
static void toast(const char *m) { char *d = toastbuf; while (*m && d < toastbuf + 30) *d++ = *m++; *d = 0; toast_t = 90; dirty_hud = 1; }

static void burst(s32 x, s32 y, int n, int tile) {
    for (int i = 0; i < n; i++) for (int k = 0; k < 28; k++) if (!parts[k].life) {
        int a = rnd() & 255, sp = 150 + (rnd() & 255);
        static const s8 SIN[16] = { 0, 49, 90, 117, 127, 117, 90, 49, 0, -49, -90, -117, -127, -117, -90, -49 };
        parts[k].x = x; parts[k].y = y; parts[k].vx = SIN[(a >> 4) & 15] * sp / 127; parts[k].vy = SIN[((a >> 4) + 12) & 15] * sp / 127 - 120; parts[k].life = 24 + (rnd() & 15); parts[k].tile = tile; break;
    }
}
static int count_orbs(void) { int n = 0; for (int i = 0; i < MAXO; i++) n += orb[i].alive; return n; }
static Orb *spawn(int tier, s32 x, s32 y, s32 vx, s32 vy, int pop) {
    for (int i = 0; i < MAXO; i++) if (!orb[i].alive) { Orb *o = &orb[i]; o->alive = 1; o->tier = tier; o->x = x; o->y = y; o->px = x - vx; o->py = y - vy; o->born = frame; o->overT = 0; o->pop = pop; return o; }
    return 0;
}
static void add_score(int n) { score += n; dirty_hud = 1; }
static void add_meter(int n) { meter += n; if (meter > 1000) meter = 1000; dirty_hud = 1; }

static void merge(Orb *a, Orb *b) {
    int tier = a->tier; s32 mx = (a->x + b->x) / 2, my = (a->y + b->y) / 2, vx = ((a->x - a->px) + (b->x - b->px)) / 2, vy = ((a->y - a->py) + (b->y - b->py)) / 2;
    a->alive = b->alive = 0;
    combo = (frame - lastMerge < 69) ? combo + 1 : 1; lastMerge = frame; if (combo > bestCombo) bestCombo = combo; merges++;
    int mult4 = 4 + (combo - 1);                          /* x0.25 steps */
    if (tier >= 10) { add_score(120 * mult4 / 4); burst(mx, my, 18, 0); add_meter(350); snd_sfx(SFX_BLOOM, 0); toast("Full Bloom!"); return; }
    snd_sfx(SFX_MERGE, tier > 9 ? 9 : tier);
    int nt = tier + 1; s32 r = rfx[nt - 1];
    s32 x = mx < r + 512 ? r + 512 : mx > JW_FX - r - 512 ? JW_FX - r - 512 : mx; s32 yy = my > FLOOR_FX - r - 256 ? FLOOR_FX - r - 256 : my;
    spawn(nt, x, yy, vx * 2 / 5, vy * 2 / 5, 12);
    if (nt > maxTier) maxTier = nt;
    add_score(bd_tiers[nt - 1].pts * mult4 / 4); burst(mx, my, 4 + nt, 0);
    add_meter(20 + nt * 9 + (combo - 1) * 30);
    if (combo >= 2) { char b[20]; char *d = scat(b, "Combo x"); snum(d, combo); toast(b); }
}

#define ITER 3
IWRAM_CODE static void step_substep(void) {
    int g4 = gravity ? 27 : 0; na = 0;
    for (int i = 0; i < MAXO; i++) {
        Orb *o = &orb[i]; if (!o->alive) continue; alist[na++] = i;
        s32 vx = o->x - o->px, vy = o->y - o->py;
        vx -= vx >> 7; vy -= vy >> 7;
        if (zero) { vx -= vx >> 4; vy -= vy >> 4; }
        if (vortex) { s32 cx = JW_FX / 2, cy = SC22(408); s32 dx = cx - o->x, dy = cy - o->y; vx += dx >> 8; vy += dy >> 8; vx -= vx >> 3; vy -= vy >> 3; }
        o->px = o->x; o->py = o->y; o->x += vx; o->y += vy + g4;
    }
    for (int it = 0; it < ITER; it++) {
        for (int ii = 0; ii < na; ii++) {
            Orb *a = &orb[alist[ii]]; s32 ra = rfx[a->tier - 1];
            if (a->x < ra) a->x = ra; if (a->x > JW_FX - ra) a->x = JW_FX - ra;
            if (a->y > FLOOR_FX - ra) { a->y = FLOOR_FX - ra; a->px += (a->x - a->px) >> 2; }
            if (shelf) { s32 hw = SC22(440) * 31 / 100 + ra / 3, cx = JW_FX / 2; s32 dxs = a->x - cx; if (dxs < 0) dxs = -dxs;
                if (dxs < hw && a->y > shelfy - ra && a->y < shelfy + ra / 2 + 600) { a->y = shelfy - ra; a->py = a->y - ((a->y - a->py) > 0 ? 0 : (a->y - a->py)); a->px += (a->x - a->px) >> 2; } }
            for (int jj = ii + 1; jj < na; jj++) {
                Orb *b = &orb[alist[jj]];
                int ta = a->tier - 1, tb = b->tier - 1; s32 rr = RR[ta][tb], dx = b->x - a->x; if (dx >= rr || dx <= -rr) continue;
                s32 dy = b->y - a->y; if (dy >= rr || dy <= -rr) continue;
                s32 d2 = dx * dx + dy * dy, rr2 = rr * rr; if (d2 >= rr2) continue;
                if (d2 == 0) { dx = 64; dy = 0; d2 = 4096; }
                s32 ov = (((rr2 - d2) >> 9) * I2RR[ta][tb]) >> 15, nx = (dx * IRR[ta][tb]) >> 16, ny = (dy * IRR[ta][tb]) >> 16;
                s32 sa = share[ta][tb];
                s32 mx = (nx * ov) >> 8, my = (ny * ov) >> 8;
                a->x -= (mx * sa) >> 8; a->y -= (my * sa) >> 8; b->x += (mx * (256 - sa)) >> 8; b->y += (my * (256 - sa)) >> 8;
                a->px += (a->x - a->px) >> 5; a->py += (a->y - a->py) >> 6; b->px += (b->x - b->px) >> 5; b->py += (b->y - b->py) >> 6;
            }
        }
    }
}
IWRAM_CODE static void collect_merges(void) {
    for (int ii = 0; ii < na; ii++) { Orb *a = &orb[alist[ii]]; if (!a->alive) continue; s32 ra = rfx[a->tier - 1];
        for (int jj = ii + 1; jj < na; jj++) { Orb *b = &orb[alist[jj]]; if (!b->alive || b->tier != a->tier) continue;
            s32 rr = ra + ra + 96, dx = b->x - a->x, dy = b->y - a->y; if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
            if (dx * dx + dy * dy <= rr * rr) { merge(a, b); break; } } }
}
static s32 landing_y(s32 x, int tier) {
    s32 r = rfx[tier - 1], y = FLOOR_FX - r;
    for (int i = 0; i < MAXO; i++) if (orb[i].alive) { s32 rr = r + rfx[orb[i].tier - 1], dx = orb[i].x - x; if (dx < 0) dx = -dx; if (dx < rr) { s32 yy = orb[i].y - (s32)isqrt(rr * rr - dx * dx); if (yy < y) y = yy; } }
    return y;
}

/* ------------------------------------------------------------------ abilities */
static void kill_orb(Orb *o, int ptsmul2) { add_score(bd_tiers[o->tier - 1].pts * ptsmul2 / 2); burst(o->x, o->y, 3, 0); o->alive = 0; }
static int use_ability(void) {
    switch (cur_char) {
    case 0: { Orb *ba = 0, *bb = 0; int best = -1 << 30;
        for (int i = 0; i < MAXO; i++) for (int j = i + 1; j < MAXO; j++) if (orb[i].alive && orb[j].alive && orb[i].tier == orb[j].tier) { s32 dx = (orb[i].x - orb[j].x) >> 8, dy = (orb[i].y - orb[j].y) >> 8; int sc = orb[i].tier * 1000 - (dx * dx + dy * dy) / 4; if (sc > best) { best = sc; ba = &orb[i]; bb = &orb[j]; } }
        if (!ba) return 0; combo = 0; merge(ba, bb); break; }
    case 1: zero = 204; gravity = 0; for (int i = 0; i < MAXO; i++) if (orb[i].alive) { Orb *o = &orb[i]; s32 vx = (o->x - o->px) / 3 + ((rnd() % 700) - 350), vy = -(150 + rnd() % 450); o->px = o->x - vx; o->py = o->y - vy; } break;
    case 2: for (int i = 0; i < MAXO; i++) if (orb[i].alive) { Orb *o = &orb[i]; s32 vx = (rnd() % 1400) - 700, vy = -(900 + rnd() % 1700); o->px = o->x - vx; o->py = o->y - vy; } fx_shake(3); break;
    case 3: punch_on = 1; punch_x = ptrx < SC22(40) ? SC22(40) : ptrx > JW_FX - SC22(40) ? JW_FX - SC22(40) : ptrx; punch_y = -SC22(60); break;
    case 4: shelf = 450; shelfy = SC22(276); break;
    case 5: { int low = 99; for (int i = 0; i < MAXO; i++) if (orb[i].alive && orb[i].tier < low) low = orb[i].tier; if (low == 99) return 0;
        for (int i = 0; i < MAXO; i++) if (orb[i].alive && orb[i].tier == low) kill_orb(&orb[i], 1); fx_flash(0); break; }
    case 6: state = 1; decree_pick = held; return 2;
    case 7: if (!count_orbs()) return 0; state = 2; decay_sel = 0; { for (int i = 0; i < MAXO; i++) if (orb[i].alive) { decay_sel = i; break; } } toast("Pick an orb"); return 2;
    case 8: vortex = 90; break;
    }
    return 1;
}
static void step_abilities(void) {
    if (zero && --zero == 0) gravity = 1;
    if (vortex) vortex--;
    if (shelf) shelf--;
    if (punch_on) {
        punch_y += 1080;
        s32 pr = SC22(36);
        for (int i = 0; i < MAXO; i++) if (orb[i].alive) { Orb *o = &orb[i]; s32 dx = (o->x - punch_x) >> 4, dy = (o->y - punch_y) >> 4, rr = (rfx[o->tier - 1] + pr) >> 4;
            if (dx * dx + dy * dy < rr * rr) { if (o->tier <= 6) { kill_orb(o, 1); fx_shake(1); } else punch_y = FLOOR_FX; } }
        if (punch_y > FLOOR_FX - SC22(20)) { punch_on = 0; burst(punch_x, FLOOR_FX - 1500, 8, 0); fx_shake(2); }
    }
}
static void check_danger(void) {
    int worst = 0;
    for (int i = 0; i < MAXO; i++) { Orb *o = &orb[i]; if (!o->alive) continue;
        s32 sp = (o->x - o->px); if (sp < 0) sp = -sp; s32 sy = o->y - o->py; if (sy < 0) sy = -sy; sp += sy;
        if (frame - o->born > 90 && o->y - rfx[o->tier - 1] < LINE_FX && sp < 180) o->overT++; else if (o->overT) o->overT -= (o->overT > 1) ? 2 : 1;
        if (o->overT > worst) worst = o->overT; }
    if (worst >= 60 && worst > overWorst && !(frame & 15)) snd_sfx(SFX_WARN, 0);
    overWorst = worst; if (worst >= 144) { state = 3; fx_shake(3); dirty_hud = 1; snd_music(0xFF); snd_sfx(SFX_OVER, 0); }
}

/* ------------------------------------------------------------------ drawing */
static const char *CHSHORT; static int bgid;
static void draw_static(void) {
    obj_enable(0);
    ui_show_bg(bgid);
    fb_fill(JX - 3, JY - 3, 97 + 6, 135 + 3, RAMP(RAMP_DARK_WHITE)); fb_rect_frame(JX - 3, JY - 3, 97 + 6, 135 + 3, COL_ACCENT);
    fb_fill(JX - 3, JY + 133, 103, 3, COL_ACCENT);
    for (int x = JX; x < JX + 97; x += 4) fb_fill(x, JY + 15, 2, 1, RAMP(RAMP_DARK_GOLD) + 1);       /* danger line */
    fb_fill(116, 4, 120, 152, RAMP(RAMP_DARK_WHITE)); fb_rect_frame(116, 4, 120, 152, COL_ACCENT);
    fb_flush(0, H); dirty_hud = 1;
}
static void draw_hud(void) {
    text_draw(192, 8, "NEXT", RAMP_DARK_GOLD, W);
    fb_fill(120, 104, 112, 50, RAMP(RAMP_DARK_WHITE));
    char b[24], *d;
    text_draw(122, 104, "Score", RAMP_DARK_GOLD, W); d = snum(b, score); text_draw(160, 104, b, RAMP_DARK_WHITE, W);
    text_draw(122, 114, "Best", RAMP_DARK_GOLD, W); d = snum(b, G.bd_best[cur_char] > score ? G.bd_best[cur_char] : score); text_draw(160, 114, b, RAMP_DARK_WHITE, W);
    (void)d;
    text_draw(122, 124, bd_chars[cur_char].ab_name, RAMP_DARK_GOLD, W);
    fb_fill(122, 135, 108, 6, COL_BLACK); fb_fill(123, 136, meter * 106 / 1000, 4, meter >= 1000 ? COL_ACCENT : COL_WHITE);
    if (state == 0 && meter >= 1000) text_draw(122, 143, "B: use ability!", RAMP_DARK_GOLD, W); else if (toast_t) text_draw(122, 143, toastbuf, RAMP_DARK_WHITE, W);
    else text_draw(122, 143, "A: drop  Start: pause", RAMP_DARK_WHITE, W);
    fb_fill(190, 40, 44, 10, RAMP(RAMP_DARK_WHITE)); if (overWorst > 20) text_draw(192, 40, "DANGER", RAMP_DARK_GOLD, W);
    fb_flush(40, 50); fb_flush(104, 154);
}
static void oam_set(int i, int y, int x, int shape, int size, int tile, int bank) {
    OAM[i * 4] = (y & 255) | (shape << 14); OAM[i * 4 + 1] = (x & 511) | (size << 14); OAM[i * 4 + 2] = tile | (bank << 12);
}
static void spr_orb(int *n, int tier, s32 x, s32 y) {      /* tier 1..10, centre in 24.8 px relative to the jar */
    int S = ORB_SIZE[tier - 1], sz = S == 8 ? 0 : S == 16 ? 1 : S == 32 ? 2 : 3;
    oam_set(*n, JY + (y >> 8) - S / 2, JX + (x >> 8) - S / 2, 0, sz, 512 + ORB_TILE[tier - 1], tier - 1); (*n)++;
}
static void draw_oam(void) {
    int n = 0;
    if (state == 3) { for (int i = 0; i < 128; i++) OAM[i * 4] = 0x200; return; }   /* game over: no sprites over the popup */
    for (int i = 0; i < MAXO; i++) if (orb[i].alive && n < 70) spr_orb(&n, orb[i].tier, orb[i].x, orb[i].y);
    /* dropper + guide */
    if (state == 0 && held) {
        s32 r = rfx[held - 1], x = ptrx < r ? r : ptrx > JW_FX - r ? JW_FX - r : ptrx;
        spr_orb(&n, held, x, -SC22(46));
        s32 ly = landing_y(x, held);
        for (int y = -SC22(46) + 3000; y < ly - 1500 && n < 90; y += 2560) oam_set(n++, JY + (y >> 8) - 4, JX + (x >> 8) - 4, 0, 0, 512 + 264 + 96, 13);
    }
    /* next orb (HUD) */
    { int S = ORB_SIZE[queue[0] - 1], sz = S == 8 ? 0 : S == 16 ? 1 : S == 32 ? 2 : 3; oam_set(n++, 28 - S / 2 + 2, 212 - S / 2, 0, sz, 512 + ORB_TILE[queue[0] - 1], queue[0] - 1); }
    if (shelf) { int sy = JY + (shelfy >> 8) - 2; oam_set(n++, sy, JX + 17, 1, 2, 512 + ORB_TILE[11], 11); oam_set(n++, sy, JX + 49, 1, 2, 512 + ORB_TILE[11], 11); }
    if (punch_on) oam_set(n++, JY + (punch_y >> 8) - 8, JX + (punch_x >> 8) - 8, 0, 1, 512 + ORB_TILE[10], 10);
    if (state == 2) { Orb *o = &orb[decay_sel]; if (o->alive) oam_set(n++, JY + (o->y >> 8) - 4, JX + (o->x >> 8) - 4, 0, 0, 512 + 264 + 96 + 1, 14); }
    for (int k = 0; k < 28 && n < 118; k++) if (parts[k].life) oam_set(n++, JY + (parts[k].y >> 8) - 4, JX + (parts[k].x >> 8) - 4, 0, 0, 512 + 264 + 96 + 2, 13);
    /* portrait */
    oam_set(n++, 8, 122, 0, 3, 512 + 264, 12); OAM[(n - 1) * 4 + 2] = (512 + 264) | (12 << 12);
    oam_set(n++, 72, 122, 1, 3, 512 + 264 + 64, 12);
    for (int i = n; i < 128; i++) OAM[i * 4] = 0x200;
}

/* ------------------------------------------------------------------ setup */
static void gfx_setup_sprites(void) {
    spr_hide_all();
    vram_copy(VRAM_OBJ_M4, assets_bin + OFF_ORBTILES, ORBTILES_BYTES);
    const u8 *pb = assets_bin + OFF_ORBPAL; for (int i = 0; i < 12 * 16; i++) PAL_OBJ[i] = rd16(pb + i * 2);
    const u8 *cb = assets_bin + CHAR_OFF[bd_chars[cur_char].ch];
    for (int i = 0; i < 16; i++) PAL_OBJ[12 * 16 + i] = rd16(cb + i * 2);
    vram_copy((u8 *)VRAM_OBJ_M4 + 264 * 32, cb + 32, 3072);
    /* guide dot / decay cursor / particle tiles at 360.. (tile 872 = 512+360) */
    static const u8 shp[3][8][8] = {
        { {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,1,1,0,0,0}, {0,0,0,1,1,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0} },
        { {1,1,1,0,0,1,1,1}, {1,0,0,0,0,0,0,1}, {1,0,0,0,0,0,0,1}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {1,0,0,0,0,0,0,1}, {1,0,0,0,0,0,0,1}, {1,1,1,0,0,1,1,1} },
        { {0,0,1,1,0,0,0,0}, {0,1,2,1,1,0,0,0}, {0,1,1,2,1,1,0,0}, {0,0,1,1,1,0,0,0}, {0,0,0,1,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0} } };
    for (int t = 0; t < 3; t++) { volatile u32 *d = (volatile u32 *)((u8 *)VRAM_OBJ_M4 + (360 + t) * 32); for (int r = 0; r < 8; r++) { u32 v = 0; for (int c = 0; c < 8; c++) v |= (u32)shp[t][r][c] << (c * 4); d[r] = v; } }
    PAL_OBJ[13 * 16 + 1] = 0x7FFF; PAL_OBJ[13 * 16 + 2] = 0x6BDF; PAL_OBJ[14 * 16 + 1] = 0x03FF;
}
static void new_game(int ch) {
    cur_char = ch; bgid = bd_chars[ch].bg;
    for (int i = 0; i < 10; i++) rfx[i] = SC22(bd_tiers[i].r);
    for (int a = 0; a < 10; a++) for (int b = 0; b < 10; b++) { s32 rr = rfx[a] + rfx[b]; RR[a][b] = rr; IRR[a][b] = (1 << 24) / rr; I2RR[a][b] = (1 << 24) / (2 * rr); }
    for (int a = 0; a < 10; a++) for (int b = 0; b < 10; b++) { int ra = bd_tiers[a].r, rb = bd_tiers[b].r; share[a][b] = (rb * rb * 256) / (ra * ra + rb * rb); }
    memset(orb, 0, sizeof orb); memset(parts, 0, sizeof parts);
    rng_s = 777 + REG_VCOUNT * 31 + frame * 7; frame = 0;
    state = 0; score = 0; combo = 0; lastMerge = -999; merges = 0; maxTier = 0; bestCombo = 0; meter = BD_START_METER; dropReady = 30;
    gravity = 1; zero = vortex = shelf = punch_on = overWorst = 0; ptrx = JW_FX / 2; toast_t = 0;
    for (int i = 0; i < 6; i++) queue[i] = rand_tier(); held = queue[0]; for (int i = 0; i < 5; i++) queue[i] = queue[i + 1]; queue[5] = rand_tier();
}
static void next_piece(void) { held = queue[0]; for (int i = 0; i < 5; i++) queue[i] = queue[i + 1]; queue[5] = rand_tier(); }

static int bd_unlocked(int c, const char **why1, const char **why2, int *ok1, int *ok2) {
#ifdef BD_TEST
    if (!why1) return 1;
#endif
    int p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    for (int e = 0; e < story_nends; e++) if ((G.endings >> e) & 1) { int p = story_ends[e].part; if (p == 1) p1 = 1; if (p == 2) p2 = 1; if (p == 3) p3 = 1; if (p == 4) p4 = 1; }
    int spared = (G.carry_valid & 4) ? G.carry[2].flags[F_sparedShigaraki] != 0 : 0;
    int v = 1, g = 1;
    switch (c) {
    case 3: v = p1; g = G.bd_top >= 2500; break; case 4: v = p1; g = G.bd_maxtier >= 6; break;
    case 6: v = p2; g = G.bd_top >= 6000; break; case 5: v = p3; g = G.bd_maxtier >= 9; break;
    case 7: v = spared; g = G.bd_combo >= 4; break; case 8: v = p4; g = G.bd_maxtier >= 10; break;
    default: break;
    }
    if (why1) { *why1 = bd_chars[c].unlock_vn; *why2 = bd_chars[c].unlock_game; *ok1 = v; *ok2 = g; }
    return v && g;
}

/* ------------------------------------------------------------------ select screen */
static int bd_select(int sel) {
    /* story CH order → show Cody, Uraraka, Joseph, Falcon, Cementoss, Maki, Light, Shigaraki, All For One (BD.CHARS order) */
    int dirty = 1;
    for (;;) {
        if (dirty) {
            obj_enable(0);
            const BdChar *bc = &bd_chars[sel];
            ui_show_bg(bc->bg);
            fb_fill(0, 0, W, H, RAMP(RAMP_DARK_WHITE)); fb_fill(0, 0, W, 1, COL_ACCENT);
            text_draw(6, 4, "Blossom Drop - choose your player", RAMP_DARK_GOLD, W);
            int lock[9];
            for (int i = 0; i < 9; i++) {
                lock[i] = !bd_unlocked(i, 0, 0, 0, 0); int y = 18 + i * 13;
                if (i == sel) fb_fill(4, y - 1, 88, 12, RAMP(RAMP_SEL));
                text_draw(8, y, bd_chars[i].name[0] == 'T' ? bd_chars[i].name + 7 : bd_chars[i].name, i == sel ? RAMP_SEL : (lock[i] ? RAMP_DIM : RAMP_DARK_WHITE), W);
                if (lock[i]) text_draw(82, y, "x", i == sel ? RAMP_SEL : RAMP_DIM, W);
            }
            text_draw(116, 6 + 0, "", RAMP_DIM, W);
            int y = 18; const char *st[8]; u8 ln[8];
            int c = text_wrap(bc->tag, 74, st, ln, 4);
            for (int k = 0; k < c; k++) { char t[80]; int m = ln[k] > 79 ? 79 : ln[k]; memcpy(t, st[k], m); t[m] = 0; text_draw(164, y, t, RAMP_DARK_WHITE, W); y += 11; }
            y += 3; text_draw(164, y, bc->ab_name, RAMP_DARK_GOLD, W); y += 11;
            c = text_wrap(bc->ab_desc, 74, st, ln, 8);
            for (int k = 0; k < c; k++) { char t[100]; int m = ln[k] > 99 ? 99 : ln[k]; memcpy(t, st[k], m); t[m] = 0; text_draw(164, y, t, RAMP_DARK_WHITE, W); y += 11; }
            if (lock[sel]) {
                const char *w1, *w2; int o1, o2; bd_unlocked(sel, &w1, &w2, &o1, &o2); y += 4;
                y = 112; text_draw(96, y, "Locked:", RAMP_DARK_GOLD, W); y += 9;
                const char *ws[2] = { w1, w2 }; int os[2] = { o1, o2 };
                for (int q = 0; q < 2; q++) { if (!ws[q][0]) continue; char t[100]; char *d = scat(t, os[q] ? "[x] " : "[ ] "); scat(d, ws[q]); int cc = text_wrap(t, 140, st, ln, 2); for (int k = 0; k < cc; k++) { char u[100]; int m = ln[k] > 99 ? 99 : ln[k]; memcpy(u, st[k], m); u[m] = 0; text_draw(96, y, u, os[q] ? RAMP_DARK_GOLD : RAMP_DARK_WHITE, W); y += 9; } }
            } else
            { char b[40]; char *d = scat(b, "Best: "); snum(d, G.bd_best[sel]); text_draw(96, 144, b, RAMP_DARK_GOLD, W); }
            fb_flush(0, H);
            /* portrait sprite */
            const u8 *cb = assets_bin + CHAR_OFF[bc->ch];
            spr_hide_all();
            for (int i = 0; i < 16; i++) PAL_OBJ[i] = rd16(cb + i * 2);
            vram_copy(VRAM_OBJ_M4, cb + 32, 3072);
            oam_set(0, 18, 94, 0, 3, 512, 0); oam_set(1, 82, 94, 1, 3, 512 + 64, 0);
            obj_enable(1); dirty = 0;
        }
        ui_frame_end();
        if (keys_down & KEY_UP) { sel = (sel + 8) % 9; dirty = 1; }
        if (keys_down & KEY_DOWN) { sel = (sel + 1) % 9; dirty = 1; }
        if (keys_down & KEY_B) return -1;
        if (keys_down & KEY_A) { if (bd_unlocked(sel, 0, 0, 0, 0)) return sel; }
    }
}

/* ------------------------------------------------------------------ main loop */
static int play(int ch) {
    snd_music(MOOD_festival); new_game(ch); draw_static(); gfx_setup_sprites(); obj_enable(1);
    G.bd_games++; G.bd_last = ch; REG_TM0CNT_H = 0; REG_TM1CNT_H = 0; REG_TM0CNT_L = 0; REG_TM1CNT_L = 0; REG_TM1CNT_H = 0x84; REG_TM0CNT_H = 0x80;
    for (;;) {
        u32 t0 = TNOW(); ui_frame_end(); u32 t1 = TNOW(); draw_oam(); u32 t2 = TNOW();
        /* input */
        if (state == 0 || state == 3 || state == 4) {
            if (state == 0) {
                int sp = (keys_held & KEY_R) ? 2400 : 1000;
                if (keys_held & KEY_LEFT) ptrx -= sp; if (keys_held & KEY_RIGHT) ptrx += sp;
                if (ptrx < 0) ptrx = 0; if (ptrx > JW_FX) ptrx = JW_FX;
                if ((keys_down & KEY_A) && frame >= dropReady && held) { s32 r = rfx[held - 1]; s32 x = ptrx < r + 256 ? r + 256 : ptrx > JW_FX - r - 256 ? JW_FX - r - 256 : ptrx; spawn(held, x, -SC22(46), 0, 380, 8); snd_sfx(SFX_DROP, 0); next_piece(); dropReady = frame + 30; combo = 0; }
                if ((keys_down & KEY_B) && meter >= 1000) { int r = use_ability(); if (r == 1) { meter = 0; snd_sfx(SFX_ABILITY, 0); } else if (r == 0) toast("Nothing to use that on"); dirty_hud = 1; }
                if (keys_down & KEY_START) { state = 4; }
            } else if (state == 4) {
                obj_enable(0);
                const char *it[] = { "Resume", "Restart", "Quit to player select" };
                int r = ui_list("Paused", it, 3, 0, 1);
                if (r == 1) { new_game(ch); }
                else if (r == 2) return 0;
                else { if (state == 4) state = 0; }
                state = 0; draw_static(); gfx_setup_sprites(); obj_enable(1); continue;
            } else if (state == 3) {
                static int shown = 0;
                if (!shown) { shown = 1;
                    if (score > G.bd_best[ch]) G.bd_best[ch] = score; if (score > G.bd_top) G.bd_top = score;
                    if (maxTier > G.bd_maxtier) G.bd_maxtier = maxTier; if (bestCombo > G.bd_combo) G.bd_combo = bestCombo; save_global();
                    fb_fill(20, 50, 200, 56, RAMP(RAMP_DARK_WHITE)); fb_rect_frame(20, 50, 200, 56, COL_ACCENT);
                    text_center(120, 56, "Game Over", RAMP_DARK_GOLD); char b[40]; char *d = scat(b, "Score: "); snum(d, score); text_center(120, 70, b, RAMP_DARK_WHITE);
                    d = scat(b, "Best chain: "); d = snum(d, maxTier); d = scat(d, "   Combo: "); snum(d, bestCombo); text_center(120, 82, b, RAMP_DARK_WHITE);
                    text_center(120, 94, "A: again   B: players", RAMP_DARK_GOLD); fb_flush(0, H); }
                if (keys_down & KEY_A) { shown = 0; snd_music(MOOD_festival); new_game(ch); draw_static(); gfx_setup_sprites(); continue; }
                if (keys_down & KEY_B) { shown = 0; return 0; }
            }
        } else if (state == 1) {       /* decree: choose the next piece 1..5 */
            if (keys_down & KEY_LEFT) { decree_pick = decree_pick <= 1 ? 5 : decree_pick - 1; } if (keys_down & KEY_RIGHT) { decree_pick = decree_pick >= 5 ? 1 : decree_pick + 1; }
            held = decree_pick; dirty_hud = 1;
            if (keys_down & KEY_A) { meter = 0; state = 0; } if (keys_down & KEY_B) state = 0;
        } else if (state == 2) {       /* decay: pick an orb */
            int dir = (keys_down & (KEY_RIGHT | KEY_DOWN)) ? 1 : (keys_down & (KEY_LEFT | KEY_UP)) ? -1 : 0;
            if (dir) { for (int k = 1; k <= MAXO; k++) { int j = (decay_sel + dir * k + MAXO * 2) % MAXO; if (orb[j].alive) { decay_sel = j; break; } } }
            if (keys_down & KEY_B) state = 0;
            if (keys_down & KEY_A && orb[decay_sel].alive) {
                Orb *h = &orb[decay_sel]; s32 hx = h->x, hy = h->y, hr = rfx[h->tier - 1]; burst(hx, hy, 6, 0); h->alive = 0;
                for (int i = 0; i < MAXO; i++) if (orb[i].alive && orb[i].tier > 1) { Orb *o = &orb[i]; s32 dx = (o->x - hx) >> 4, dy = (o->y - hy) >> 4, rr = (hr + rfx[o->tier - 1] + SC22(14)) >> 4; if (dx * dx + dy * dy < rr * rr) { o->tier--; } }
                meter = 0; state = 0; fx_shake(1);
            }
        }
        /* simulation */
        if (state == 0 || state == 1 || state == 2) {
            frame++;
            if (state != 1) { step_substep(); step_abilities(); collect_merges(); check_danger(); }
            for (int k = 0; k < 28; k++) if (parts[k].life) { parts[k].life--; parts[k].x += parts[k].vx; parts[k].y += parts[k].vy; parts[k].vy += 18; }
            for (int i = 0; i < MAXO; i++) if (orb[i].alive && orb[i].pop) orb[i].pop--;
            if (toast_t && !--toast_t) dirty_hud = 1;
        }
        u32 t3 = TNOW();
        if (dirty_hud || (frame & 7) == 0) { if (dirty_hud || meter) { draw_hud(); dirty_hud = 0; } }
        u32 t4 = TNOW(); prof[0] += t1 - t0; prof[1] += t2 - t1; prof[2] += t3 - t2 ; prof[3] += t4 - t3; prof[4]++;
    }
}

void bd_main(void) {
#ifdef BD_TEST_CHAR
    play(BD_TEST_CHAR);
#endif
    int sel = G.bd_last < 9 ? G.bd_last : 0;
    for (;;) {
        int c = bd_select(sel); if (c < 0) break; sel = c;
        play(c); snd_music(MOOD_quiet); spr_hide_all(); ui_bg_current = -1;
    }
    spr_hide_all(); obj_enable(0);
}
