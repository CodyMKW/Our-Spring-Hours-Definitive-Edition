/* blossom.c — Blossom Drop (single player) for the 3DS. A C port of blossom/js/game.js: same jar, same ten-tier
 * merge chain, same nine character abilities and unlock rules, with a small custom circle-physics solver instead of
 * Matter.js. Units are "jar units" (the web version's), the jar is drawn on the bottom screen at scale JS. */
#include "game.h"
#include "js.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define JW 440.0f
#define JH 600.0f
#define LINE_Y 70.0f
#define FLOOR (JH - 16.0f)
#define NT 10
#define MAXO 110
#define GRAV 1700.0f
#define JS 0.35f          /* jar scale on the bottom screen */
#define JX 10.0f
#define JY 26.0f

static const struct { const char *name; float r; int pts; uint32_t c[3]; } T[NT] = {
    { "Petal", 15, 1, { RGB(255, 227, 234), RGB(255, 179, 198), RGB(232, 124, 156) } },
    { "Bud", 21, 3, { RGB(255, 208, 223), RGB(255, 143, 180), RGB(217, 84, 127) } },
    { "Blossom", 28, 6, { RGB(255, 255, 255), RGB(255, 214, 227), RGB(240, 154, 183) } },
    { "Dango", 36, 10, { RGB(255, 247, 222), RGB(248, 220, 160), RGB(214, 170, 92) } },
    { "Onigiri", 45, 15, { RGB(230, 243, 255), RGB(169, 210, 242), RGB(95, 156, 204) } },
    { "Tomato", 55, 21, { RGB(255, 155, 140), RGB(240, 80, 63), RGB(176, 42, 36) } },
    { "Lantern", 66, 28, { RGB(255, 224, 160), RGB(255, 172, 63), RGB(207, 109, 23) } },
    { "Wish Charm", 78, 36, { RGB(217, 200, 255), RGB(154, 123, 224), RGB(95, 67, 168) } },
    { "Moon", 92, 45, { RGB(255, 251, 226), RGB(255, 229, 143), RGB(217, 178, 74) } },
    { "Cherry Tree", 108, 55, { RGB(255, 230, 239), RGB(255, 159, 192), RGB(201, 86, 127) } },
};
static const int WEIGHTS[5] = { 34, 28, 20, 12, 6 };

/* ---- characters + unlocks */
typedef struct { const char *id, *name, *tag, *ab_name, *ab_desc, *start, *big, *over; uint32_t color; const char *need_vn; int need_kind; int need_val; const char *need_txt; const char *bg; } Ch;
enum { NK_NONE, NK_BEST, NK_TIER, NK_COMBO };
static const Ch CH[9] = {
    { "cody", "Cody", "The one who brings everyone together", "Rally", "Instantly merges the best matching pair in the jar.", "Okay. Deep breath. Let's go.", "Whoa, look at that one!", "Okay... again?", RGB(139, 127, 192), NULL, NK_NONE, 0, "", "courtyard_bloom" },
    { "uraraka", "Uraraka", "Gravity is a suggestion", "Zero Gravity", "Everything floats for a few seconds, drifting together to merge.", "Let's make it float!", "Look at it go!", "Oh no, it all came down...", RGB(255, 111, 143), NULL, NK_NONE, 0, "", "courtyard_sunset" },
    { "joseph", "Joseph", "Chaos, but make it tidy", "Shake It Up", "Jostles every orb to repack the jar and free stuck pairs.", "Eh, let's see what happens.", "Okay, that's actually cool.", "Called it. Not.", RGB(91, 147, 199), NULL, NK_NONE, 0, "", "home_morning" },
    { "falcon", "Falcon", "Subtlety is overrated", "Falcon Punch", "A flaming fist smashes down, shattering small orbs (up to Tomato).", "I have a plan. You won't like it.", "THAT'S what I'm talking about!", "Rematch. Immediately.", RGB(127, 162, 92), "P1", NK_BEST, 2500, "Finish Part I and score 2,500 in one game", "courtyard_day" },
    { "cementoss", "Cementoss", "Steady. Solid. Reliable.", "Stone Shelf", "Raises a stone shelf across the jar for a few seconds to catch the pile.", "Patience.", "A fine piece.", "We rebuild.", RGB(176, 113, 63), "P1", NK_TIER, 6, "Finish Part I and grow a Tomato in one game", "rooftop_sunset" },
    { "maki", "Maki", "Burn away what's in the way", "Cleansing Fire", "Burns away every orb of the smallest tier in the jar.", "Secure the perimeter.", "Impressive.", "Regroup. Go again.", RGB(208, 100, 47), "P2", NK_BEST, 6000, "Finish Part II (Ashfall) and score 6,000 in one game", "rooftop_garden" },
    { "light", "Light Yagami", "Everything according to plan", "Decree", "Choose your next piece. Passive: you can see the next four.", "I've already calculated this.", "Better than projected.", "...A miscalculation.", RGB(201, 165, 106), "P3", NK_TIER, 9, "Finish Part III (Last Light) and grow a Moon in one game", "hideout" },
    { "shigaraki", "Tomura Shigaraki", "Break it. Then break the pieces", "Decay", "Tap an orb to crumble it; its neighbors shrink one tier.", "...Fine.", "...Not bad.", "Pathetic. Again.", RGB(143, 183, 207), "SPARED", NK_COMBO, 4, "Talk Shigaraki down in Part II and land a 4-chain combo", "ruined_dawn" },
    { "allforone", "All For One", "Everything is mine to take", "Absorb", "A vortex drags every orb to the middle of the jar.", "Show me what you can do.", "Magnificent.", "Even I lose, sometimes.", RGB(179, 54, 59), "P4", NK_TIER, 10, "Finish the Bonus Story and grow a Cherry Tree in one game", "battlegrounds_dusk" },
};
static const char *LISTS[4][8] = {
    { "ending_romance", "ending_friends", "ending_falcon", "ending_true", "ending_lonely", NULL },
    { "end_inheritance", "end_ashfalldawn", "end_staticledger", "end_embers", "end_longdark", NULL },
    { "end_dawnunity", "end_redemption", "end_shadowalliance", "end_costlyvictory", "end_pyrrhic", "end_isolation", "end_quietlife", NULL },
    { "ending_hundredth", "ending_almost", "ending_quiet_spring", NULL },
};

typedef struct { int games, best, maxTier, bestCombo, merges, last; int perBest[9]; } Stats;
static Stats ST;
static char prog_endings[1200]; static bool prog_spared;

static void stats_load(void) {
    memset(&ST, 0, sizeof ST); char *d; size_t n;
    if (plat_store_read("osh3ds_blossom.txt", &d, &n)) {
        sscanf(d, "%d %d %d %d %d %d %d %d %d %d %d %d %d %d %d", &ST.games, &ST.best, &ST.maxTier, &ST.bestCombo, &ST.merges, &ST.last,
               &ST.perBest[0], &ST.perBest[1], &ST.perBest[2], &ST.perBest[3], &ST.perBest[4], &ST.perBest[5], &ST.perBest[6], &ST.perBest[7], &ST.perBest[8]);
        free(d);
    }
    char *p = js_str("Flat.progress()"); char *bar = strchr(p, '|'); prog_spared = false;
    if (bar) { *bar = 0; prog_spared = bar[1] == '1'; }
    snprintf(prog_endings, sizeof prog_endings, ",%s,", p); free(p);
}
static void stats_save(void) {
    char b[300]; int n = snprintf(b, 300, "%d %d %d %d %d %d %d %d %d %d %d %d %d %d %d\n", ST.games, ST.best, ST.maxTier, ST.bestCombo, ST.merges, ST.last,
        ST.perBest[0], ST.perBest[1], ST.perBest[2], ST.perBest[3], ST.perBest[4], ST.perBest[5], ST.perBest[6], ST.perBest[7], ST.perBest[8]);
    plat_store_write("osh3ds_blossom.txt", b, n);
}
static bool has_ending(const char *id) { char k[80]; snprintf(k, 80, ",%s,", id); return strstr(prog_endings, k) != NULL; }
static bool finished(int part) { for (int i = 0; LISTS[part][i]; i++) if (has_ending(LISTS[part][i])) return true; return false; }
static bool unlocked(int c) {
    if (getenv("OSH_UNLOCK_ALL")) return true;   /* desktop test hook (getenv is always NULL on 3DS) */
    const Ch *h = &CH[c]; if (!h->need_vn) return true;
    bool vn = !strcmp(h->need_vn, "SPARED") ? prog_spared : finished(h->need_vn[1] - '1');
    if (!vn) return false;
    int v = h->need_kind == NK_BEST ? ST.best : h->need_kind == NK_TIER ? ST.maxTier : ST.bestCombo;
    return v >= h->need_val;
}

/* ---- game state */
typedef struct { float x, y, vx, vy, ang, r, born, over, pop; int tier; bool live; } Orb;
typedef struct { float x, y, vx, vy, life, max, size; uint32_t col; } Part;
typedef struct { float x, y, life; int n; uint32_t col; char t[12]; } Pop;
typedef struct { float x, y, r0, r1, life; uint32_t col; } Ring;
enum { S_PLAY, S_OVER, S_DECREE, S_DECAY };

static struct {
    Orb o[MAXO]; Part p[200]; int np; Pop pop[10]; Ring rg[8];
    int ch, state; float t, accum, pointer, dropReady, shake, warn, meter;
    int held, queue[6]; int score, combo, bestCombo, maxTier, merges; float lastMerge;
    float zero, vortex, abilT; bool shelf; float shelfLife; bool punch; float px, py; 
    char quip[100]; float quipT; float overAt; float air;
} G;

static unsigned rs = 12345;
static float frand(void) { rs = rs * 1664525u + 1013904223u; return (rs >> 8) / 16777216.0f; }
static float rr(float a, float b) { return a + frand() * (b - a); }
static int rand_tier(void) { int tot = 0; for (int i = 0; i < 5; i++) tot += WEIGHTS[i]; float r = frand() * tot; for (int i = 0; i < 5; i++) { r -= WEIGHTS[i]; if (r <= 0) return i + 1; } return 1; }
static void say(const char *s) { snprintf(G.quip, 100, "%s", s); G.quipT = 2.6f; }
static void burst(float x, float y, uint32_t c, int n, float speed) {
    for (int i = 0; i < n && G.np < 200; i++) { float a = rr(0, 6.2832f), s = rr(0.25f, 1) * speed; Part *q = &G.p[G.np++]; q->x = x; q->y = y; q->vx = cosf(a) * s; q->vy = sinf(a) * s - speed * 0.25f; q->life = q->max = rr(0.4f, 1.0f); q->size = rr(3, 7); q->col = c; }
}
static void ring(float x, float y, float r, uint32_t c) { for (int i = 0; i < 8; i++) if (G.rg[i].life <= 0) { G.rg[i] = (Ring){ x, y, r * 0.2f, r, 0.5f, c }; return; } }
static void add_score(int n, float x, float y, uint32_t c) {
    G.score += n; for (int i = 0; i < 10; i++) if (G.pop[i].life <= 0) { G.pop[i].x = x; G.pop[i].y = y - 10; G.pop[i].life = 1.0f; G.pop[i].col = c; snprintf(G.pop[i].t, 12, "+%d", n); break; }
}
static Orb *make_orb(int tier, float x, float y, float vx, float vy, float pop) {
    for (int i = 0; i < MAXO; i++) if (!G.o[i].live) { Orb *o = &G.o[i]; memset(o, 0, sizeof *o); o->live = true; o->tier = tier; o->r = T[tier - 1].r; o->x = x; o->y = y; o->vx = vx; o->vy = vy; o->born = G.t; o->pop = pop; return o; }
    return NULL;
}
static void reset(int ch) {
    memset(&G, 0, sizeof G); G.ch = ch; G.state = S_PLAY; G.pointer = JW / 2; G.meter = getenv("OSH_FULLMETER") ? 100 : 40; G.lastMerge = -99; G.air = 0.006f;
    for (int i = 0; i < 6; i++) G.queue[i] = rand_tier();
    G.held = G.queue[0]; for (int i = 0; i < 5; i++) G.queue[i] = G.queue[i + 1]; G.queue[5] = rand_tier();
    say(CH[ch].start);
}
static float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
static void kill(Orb *o) { o->live = false; }

static void merge(Orb *a, Orb *b) {
    int tier = a->tier; float mx = (a->x + b->x) / 2, my = (a->y + b->y) / 2, vx = (a->vx + b->vx) / 2, vy = (a->vy + b->vy) / 2;
    kill(a); kill(b);
    G.combo = (G.t - G.lastMerge < 1.15f) ? G.combo + 1 : 1; G.lastMerge = G.t; if (G.combo > G.bestCombo) G.bestCombo = G.combo; G.merges++;
    float mult = 1 + 0.25f * (G.combo - 1);
    if (tier >= NT) {
        add_score((int)(120 * mult + 0.5f), mx, my, RGB(255, 209, 227)); burst(mx, my, RGB(255, 159, 192), 40, 360); ring(mx, my, 260, RGB(255, 209, 227));
        G.shake = 14; G.meter = fminf(100, G.meter + 35); plat_sfx("bloom"); say(CH[G.ch].big); return;
    }
    int nt = tier + 1; float r = T[nt - 1].r;
    make_orb(nt, clampf(mx, r + 2, JW - r - 2), fminf(my, FLOOR - r - 1), vx * 0.4f, vy * 0.4f, 0.45f);
    if (nt > G.maxTier) G.maxTier = nt;
    add_score((int)(T[nt - 1].pts * mult + 0.5f), mx, my, T[nt - 1].c[1]);
    burst(mx, my, T[nt - 1].c[1], 6 + nt * 2, 120 + nt * 22); ring(mx, my, T[tier - 1].r * 2.2f, T[nt - 1].c[1]);
    plat_sfx(nt >= 7 ? "pop_big" : "pop"); if (nt >= 7) G.shake = fmaxf(G.shake, 5 + nt * 0.5f);
    G.meter = fminf(100, G.meter + 2 + nt * 0.9f + (G.combo - 1) * 3);
    if (nt >= 7 && nt == G.maxTier) say(CH[G.ch].big);
}

/* ---- physics */
static int pi_[1400], pj_[1400], npairs;
static void collide_shelf(Orb *o) {
    if (!G.shelf) return;
    float cx = JW / 2, cy = JH * 0.46f, hw = JW * 0.31f, hh = 12;
    float nx = clampf(o->x, cx - hw, cx + hw), ny = clampf(o->y, cy - hh, cy + hh), dx = o->x - nx, dy = o->y - ny, d2 = dx * dx + dy * dy;
    if (d2 >= o->r * o->r) return;
    float d = sqrtf(d2), nxn, nyn, pen;
    if (d > 1e-3f) { nxn = dx / d; nyn = dy / d; pen = o->r - d; } else { nxn = 0; nyn = o->y < cy ? -1 : 1; pen = o->r + hh; }
    o->x += nxn * pen; o->y += nyn * pen;
    float vn = o->vx * nxn + o->vy * nyn; if (vn < 0) { o->vx -= (1.02f) * vn * nxn; o->vy -= 1.02f * vn * nyn; o->vx *= 0.995f; }
}
static void physics(float dt) {
    int live[MAXO], n = 0; for (int i = 0; i < MAXO; i++) if (G.o[i].live) live[n++] = i;
    float g = G.zero > 0 ? 0 : GRAV;
    /* integrate */
    for (int k = 0; k < n; k++) {
        Orb *o = &G.o[live[k]]; o->vy += g * dt;
        if (G.vortex > 0) { float dx = JW / 2 - o->x, dy = JH * 0.68f - o->y, d = fmaxf(30, sqrtf(dx * dx + dy * dy)); float a = GRAV * 12; o->vx += dx / d * a * dt; o->vy += (dy / d * a - GRAV * 0.35f) * dt; }
        float damp = G.zero > 0 ? 0.05f : (G.vortex > 0 ? 0.04f : G.air); float f = powf(1 - damp, dt * 60); o->vx *= f; o->vy *= f;
        o->x += o->vx * dt; o->y += o->vy * dt;
    }
    /* broad phase */
    npairs = 0;
    for (int a = 0; a < n; a++) { Orb *A = &G.o[live[a]]; for (int b = a + 1; b < n && npairs < 1400; b++) { Orb *B = &G.o[live[b]]; float dx = B->x - A->x, dy = B->y - A->y, rs_ = A->r + B->r + 2; if (dx * dx + dy * dy < rs_ * rs_) { pi_[npairs] = live[a]; pj_[npairs] = live[b]; npairs++; } } }
    for (int it = 0; it < 6; it++) {
        for (int k = 0; k < npairs; k++) {
            Orb *A = &G.o[pi_[k]], *B = &G.o[pj_[k]];
            float dx = B->x - A->x, dy = B->y - A->y, d2 = dx * dx + dy * dy, rsum = A->r + B->r;
            if (d2 >= rsum * rsum) continue;
            float d = sqrtf(d2), nx, ny; if (d < 1e-4f) { nx = 0; ny = 1; d = 0; } else { nx = dx / d; ny = dy / d; }
            float pen = rsum - d, ma = A->r * A->r, mb = B->r * B->r, im = 1 / (ma + mb);
            float cor = fmaxf(0, pen - 0.04f) * 0.55f;
            A->x -= nx * cor * mb * im; A->y -= ny * cor * mb * im; B->x += nx * cor * ma * im; B->y += ny * cor * ma * im;
            float rvx = B->vx - A->vx, rvy = B->vy - A->vy, vn = rvx * nx + rvy * ny;
            if (vn < 0) {
                float e = vn < -60 ? 0.1f : 0, j = -(1 + e) * vn / (1 / ma + 1 / mb);
                A->vx -= j * nx / ma; A->vy -= j * ny / ma; B->vx += j * nx / mb; B->vy += j * ny / mb;
                float tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = -vt / (1 / ma + 1 / mb), mx = 0.15f * j; if (jt > mx) jt = mx; if (jt < -mx) jt = -mx;
                A->vx -= jt * tx / ma; A->vy -= jt * ty / ma; B->vx += jt * tx / mb; B->vy += jt * ty / mb;
            }
        }
        for (int k = 0; k < n; k++) {
            Orb *o = &G.o[live[k]];
            if (o->x < o->r) { o->x = o->r; if (o->vx < 0) o->vx = 0; } if (o->x > JW - o->r) { o->x = JW - o->r; if (o->vx > 0) o->vx = 0; }
            if (o->y > FLOOR - o->r) { o->y = FLOOR - o->r; if (o->vy > 0) { o->vy = o->vy > 80 ? -o->vy * 0.08f : 0; o->vx *= 0.97f; } }
            collide_shelf(o);
        }
    }
    for (int k = 0; k < n; k++) { Orb *o = &G.o[live[k]]; o->ang += o->vx / o->r * dt * 0.6f; if (fabsf(o->vx) < 1.5f && fabsf(o->vy) < 3) { o->vx *= 0.9f; if (fabsf(o->vy) < 1.5f) o->vy = 0; } }
}
static void process_merges(void) {
    bool used[MAXO] = { false };
    for (int k = 0; k < npairs; k++) {
        Orb *A = &G.o[pi_[k]], *B = &G.o[pj_[k]]; if (!A->live || !B->live || A->tier != B->tier || used[pi_[k]] || used[pj_[k]]) continue;
        float dx = B->x - A->x, dy = B->y - A->y, rs_ = A->r + B->r + 1.0f;
        if (dx * dx + dy * dy <= rs_ * rs_) { used[pi_[k]] = used[pj_[k]] = true; merge(A, B); }
    }
}
static void game_over(void) { G.state = S_OVER; G.overAt = G.t; plat_sfx("over"); G.shake = 10; say(CH[G.ch].over); }
static void check_danger(float dt) {
    float worst = 0;
    for (int i = 0; i < MAXO; i++) { Orb *o = &G.o[i]; if (!o->live) continue; float sp = sqrtf(o->vx * o->vx + o->vy * o->vy);
        if (G.t - o->born > 1.5f && o->y - o->r < LINE_Y && sp < 190) o->over += dt; else o->over = fmaxf(0, o->over - dt * 2);
        if (o->over > worst) worst = o->over; }
    G.warn = clampf(worst / 2.4f, 0, 1); if (worst >= 2.4f) game_over();
}

/* ---- abilities */
static bool ability_ready(void) { return G.meter >= 100 && G.state == S_PLAY; }
static void flame(Orb *o) { add_score((T[o->tier - 1].pts + 1) / 2, o->x, o->y, RGB(255, 176, 103)); burst(o->x, o->y, RGB(255, 138, 61), 12 + o->tier * 2, 260); kill(o); }
static bool use_ability(void) {
    if (!ability_ready()) return false;
    const char *id = CH[G.ch].id;
    if (!strcmp(id, "cody")) {
        Orb *ba = NULL, *bb = NULL; float bs = -1e9f;
        for (int i = 0; i < MAXO; i++) for (int j = i + 1; j < MAXO; j++) { Orb *a = &G.o[i], *b = &G.o[j]; if (!a->live || !b->live || a->tier != b->tier) continue; float d = hypotf(a->x - b->x, a->y - b->y), sc = a->tier * 1000 - d; if (sc > bs) { bs = sc; ba = a; bb = b; } }
        if (!ba) { say("Nothing to rally yet!"); return false; }
        ring(ba->x, ba->y, 120, RGB(201, 189, 245)); G.combo = 0; merge(ba, bb);
    } else if (!strcmp(id, "uraraka")) { G.zero = 3.4f; for (int i = 0; i < MAXO; i++) if (G.o[i].live) { G.o[i].vx = G.o[i].vx * 0.3f + rr(-84, 84); G.o[i].vy = -rr(36, 132); } ring(JW / 2, JH / 2, 420, RGB(255, 179, 203)); }
    else if (!strcmp(id, "joseph")) { G.shake = 16; for (int i = 0; i < MAXO; i++) if (G.o[i].live) { G.o[i].vx = rr(-300, 300); G.o[i].vy = -rr(240, 660); } ring(JW / 2, JH - 40, 360, RGB(156, 196, 232)); }
    else if (!strcmp(id, "falcon")) { G.punch = true; G.px = clampf(G.pointer, 40, JW - 40); G.py = -60; plat_sfx("fire"); }
    else if (!strcmp(id, "cementoss")) { G.shelf = true; G.shelfLife = 7.5f; G.shake = 8; burst(JW / 2, JH * 0.46f, RGB(201, 179, 154), 24, 220); }
    else if (!strcmp(id, "maki")) {
        int low = 99; for (int i = 0; i < MAXO; i++) if (G.o[i].live && G.o[i].tier < low) low = G.o[i].tier; if (low == 99) { say("Nothing to burn yet!"); return false; }
        G.shake = 10; ring(JW / 2, JH / 2, 480, RGB(255, 138, 61)); for (int i = 0; i < MAXO; i++) if (G.o[i].live && G.o[i].tier == low) flame(&G.o[i]);
    } else if (!strcmp(id, "light")) { G.state = S_DECREE; return true; }
    else if (!strcmp(id, "shigaraki")) { bool any = false; for (int i = 0; i < MAXO; i++) any |= G.o[i].live; if (!any) { say("Nothing to crumble yet!"); return false; } G.state = S_DECAY; return true; }
    else if (!strcmp(id, "allforone")) { G.vortex = 1.5f; }
    G.meter = 0; return true;
}
static void decay_at(float lx, float ly) {
    Orb *hit = NULL; for (int i = 0; i < MAXO; i++) { Orb *o = &G.o[i]; if (o->live && hypotf(o->x - lx, o->y - ly) <= o->r) hit = o; }
    if (!hit) return;
    float px = hit->x, py = hit->y, hr = hit->r; burst(px, py, RGB(143, 183, 207), 20, 240); ring(px, py, hr * 2.6f, RGB(143, 183, 207)); kill(hit);
    for (int i = 0; i < MAXO; i++) { Orb *o = &G.o[i]; if (!o->live || o->tier <= 1) continue; if (hypotf(o->x - px, o->y - py) < hr + o->r + 14) { float x = o->x, y = o->y, vx = o->vx, vy = o->vy; int nt = o->tier - 1; kill(o); make_orb(nt, x, y, vx, vy - 60, 0.5f); } }
    G.shake = 6; G.meter = 0; G.state = S_PLAY;
}
static void step_abilities(float dt) {
    if (G.zero > 0) { G.zero -= dt; if (G.zero <= 0) ring(JW / 2, JH / 2, 300, RGB(255, 209, 227)); }
    if (G.vortex > 0) G.vortex -= dt;
    if (G.shelf) { G.shelfLife -= dt; if (G.shelfLife <= 0) { G.shelf = false; burst(JW / 2, JH * 0.46f, RGB(168, 149, 127), 30, 260); } }
    if (G.punch) {
        G.py += 1150 * dt; bool end = G.py > FLOOR - 20;
        for (int i = 0; i < MAXO; i++) { Orb *o = &G.o[i]; if (!o->live) continue; if (hypotf(o->x - G.px, o->y - G.py) < o->r + 36) { if (o->tier <= 6) { flame(o); G.shake = 9; } else end = true; } }
        if (end) { burst(G.px, fminf(G.py, FLOOR - 20), RGB(255, 138, 61), 26, 340); ring(G.px, G.py, 200, RGB(255, 138, 61)); G.shake = 12; G.punch = false; }
    }
}
static void drop(void) {
    if (G.state != S_PLAY || G.t < G.dropReady) return;
    float r = T[G.held - 1].r; make_orb(G.held, clampf(G.pointer, r + 3, JW - r - 3), -46, 0, 90, 0.35f);
    plat_sfx("drop"); G.held = G.queue[0]; for (int i = 0; i < 5; i++) G.queue[i] = G.queue[i + 1]; G.queue[5] = rand_tier();
    G.dropReady = G.t + 0.5f; G.combo = 0;
}
static void step(float dt) {
    G.t += dt;
    if (G.state == S_DECREE) return;
    if (G.state != S_OVER) step_abilities(dt);
    physics(dt * 0.5f); physics(dt * 0.5f);
    if (G.state != S_OVER) { process_merges(); check_danger(dt); }
    for (int i = 0; i < MAXO; i++) if (G.o[i].live && G.o[i].pop > 0) G.o[i].pop = fmaxf(0, G.o[i].pop - dt * 3.2f);
    for (int i = 0; i < G.np; ) { Part *q = &G.p[i]; q->life -= dt; q->vy += 500 * dt; q->x += q->vx * dt; q->y += q->vy * dt; if (q->life <= 0) G.p[i] = G.p[--G.np]; else i++; }
    for (int i = 0; i < 10; i++) if (G.pop[i].life > 0) { G.pop[i].life -= dt; G.pop[i].y -= 38 * dt; }
    for (int i = 0; i < 8; i++) if (G.rg[i].life > 0) G.rg[i].life -= dt;
    G.shake = fmaxf(0, G.shake - dt * 30); if (G.quipT > 0) G.quipT -= dt;
}

/* ---- drawing */
static float sx(float x) { return JX + x * JS; }
static float sy(float y) { return JY + y * JS; }
static void draw_orb(float x, float y, float r, int tier, float ang, float pop) {
    float d = 2 * r * (1 + pop * 0.25f);
    int px = d <= 36 ? 32 : d <= 72 ? 64 : 128; char nm[24]; snprintf(nm, 24, "orb%d_%d", px, tier);
    Img *im = img_get(nm);
    if (im) { float sc = d / px; plat_img_draw(im, x - d / 2, y - d / 2, sc, sc, ang * 0.35f, RGB(255, 255, 255)); return; }
    const uint32_t *c = T[tier - 1].c; r = d / 2;   /* fallback: flat circles if the pictures are missing */
    plat_circle(x, y, r, c[2]); plat_circle(x, y - r * 0.04f, r * 0.9f, c[1]); plat_circle(x - r * 0.28f, y - r * 0.32f, r * 0.28f, col_alpha(c[0], 0.9f));
}
static void draw_jar(void) {
    float ox = G.shake > 0 ? sinf(G.t * 90) * G.shake * 0.12f : 0;
    ui_card(JX - 5 + ox, JY - 4, JW * JS + 10, JH * JS + 10, 8, RGB(196, 138, 150));
    ui_card(JX - 3 + ox, JY - 2, JW * JS + 6, JH * JS + 6, 6, RGB(236, 188, 198));
    plat_rect_grad(JX + ox, JY, JW * JS, JH * JS, RGB(255, 246, 244), RGB(255, 220, 228));
    plat_rect(JX + 3 + ox, JY, 2, JH * JS, RGBA(255, 255, 255, 120));
    float ly = sy(LINE_Y); float wa = G.warn;
    for (int x = 0; x < (int)(JW * JS); x += 8) plat_rect(JX + x + ox, ly, 4, 1, wa > 0.1f ? RGBA(230, 60, 80, 200) : RGBA(200, 120, 140, 130));
    if (G.shelf) plat_rrect(sx(JW * 0.19f) + ox, sy(JH * 0.46f - 12), JW * 0.62f * JS, 24 * JS, 2, RGB(130, 112, 96));
    for (int i = 0; i < MAXO; i++) { Orb *o = &G.o[i]; if (o->live) draw_orb(sx(o->x) + ox, sy(o->y), o->r * JS, o->tier, o->ang, o->pop); }
    for (int i = 0; i < 8; i++) if (G.rg[i].life > 0) { float f = 1 - G.rg[i].life / 0.5f; plat_ring(sx(G.rg[i].x), sy(G.rg[i].y), (G.rg[i].r0 + (G.rg[i].r1 - G.rg[i].r0) * f) * JS, 1.5f, col_alpha(G.rg[i].col, 1 - f)); }
    for (int i = 0; i < G.np; i++) { Part *q = &G.p[i]; plat_rect(sx(q->x) - 1, sy(q->y) - 1, 2, 2, col_alpha(q->col, q->life / q->max)); }
    if (G.punch) { plat_circle(sx(G.px), sy(G.py), 36 * JS, RGB(255, 176, 60)); plat_circle(sx(G.px), sy(G.py), 22 * JS, RGB(255, 235, 150)); }
    if (G.vortex > 0) plat_ring(sx(JW / 2), sy(JH * 0.68f), 18 + 8 * sinf(G.t * 8), 2, RGBA(150, 40, 60, 160));
    for (int i = 0; i < 10; i++) if (G.pop[i].life > 0) plat_text(sx(G.pop[i].x), sy(G.pop[i].y) - 6, 13, col_alpha(RGB(255, 255, 255), fminf(1, G.pop[i].life * 2)), T_CENTER | T_SHADOW, G.pop[i].t);
    /* dropper */
    if (G.state == S_PLAY || G.state == S_DECAY) {
        float r = T[G.held - 1].r, x = clampf(G.pointer, r + 3, JW - r - 3);
        plat_line(sx(x), sy(-30) + 4, sx(x), sy(JH - 20), 1, RGBA(120, 70, 90, 70));
        if (G.t >= G.dropReady) draw_orb(sx(x), JY - 8 + 2, r * JS * 0.9f, G.held, 0, 0);
    }
    if (G.warn > 0.15f) plat_rect(JX, JY, JW * JS, 2, RGBA(230, 60, 80, (int)(200 * G.warn)));
}
static void draw_panel(void) {
    const Ch *h = &CH[G.ch]; float x0 = 178, w = 136;
    ui_card(x0, 8, w, 46, 12, RGBA(255, 255, 255, 46));
    plat_text(x0 + 8, 10, 12, RGB(255, 210, 225), 0, "Score"); char b[40]; snprintf(b, 40, "%d", G.score); plat_text(x0 + 8, 24, 22, RGB(255, 255, 255), T_SHADOW, b);
    plat_text(x0 + w - 6, 12, 12, RGB(255, 210, 225), T_RIGHT, G.combo > 1 ? (snprintf(b, 40, "x%d combo", G.combo), b) : "");
    ui_card(x0, 60, w, 52, 12, RGBA(255, 255, 255, 46)); plat_text(x0 + 8, 62, 12, RGB(255, 210, 225), 0, "Next");
    for (int i = 0; i < (h->id[0] == 'l' && !strcmp(h->id, "light") ? 4 : 1); i++) { int tr = G.queue[i]; float r = T[tr - 1].r * 0.34f; draw_orb(x0 + 22 + i * 32, 92, r > 17 ? 17 : r, tr, 0, 0); }
    /* ability button */
    float by = 118; bool ready = ability_ready();
    ui_card(x0, by, w, 52, 12, ready ? RGB(255, 236, 242) : RGBA(255, 255, 255, 40));
    plat_text(x0 + w / 2, by + 3, 14, ready ? RGB(110, 40, 80) : RGB(255, 235, 245), T_CENTER, h->ab_name);
    ui_card(x0 + 8, by + 24, w - 16, 8, 4, RGBA(0, 0, 0, 80)); if (G.meter > 3) ui_card(x0 + 8, by + 24, (w - 16) * G.meter / 100, 8, 4, ready ? RGB(255, 120, 165) : RGB(190, 140, 220));
    plat_text(x0 + w / 2, by + 34, 12, ready ? RGB(110, 40, 80) : RGB(255, 225, 238), T_CENTER, ready ? "TAP or press X!" : "charging...");
    ui_button(x0, 178, 64, 26, "Pause", false, RGB(255, 247, 250), 14);
    plat_text(x0 + 70, 182, 11, RGBA(255, 255, 255, 170), 0, "touch jar: aim,");
    plat_text(x0 + 70, 193, 11, RGBA(255, 255, 255, 170), 0, "release: drop");
    plat_text(x0 + w / 2, 212, 11, RGBA(255, 255, 255, 150), T_CENTER, "D-pad aim  A drop  X power");
}
static void draw_top(Img *portrait) {
    const Ch *h = &CH[G.ch]; char nm[60];
    snprintf(nm, 60, "bg_%s", h->bg); Img *bg = img_get(nm);
    if (bg) plat_img_draw(bg, 0, 0, 1, 1, 0, RGB(255, 255, 255)); plat_rect(0, 0, 400, 240, RGBA(20, 8, 30, 90)); ui_fade_edges();
    if (portrait) { float hh = 210, sc = hh / plat_img_h(portrait); plat_img_draw(portrait, 14, 244 - hh, sc, sc, 0, RGB(255, 255, 255)); }
    ui_card(196, 8, 196, 70, 12, RGBA(20, 8, 30, 175));
    plat_text(206, 12, 18, h->color, T_SHADOW, h->name);
    char b[80]; snprintf(b, 80, "Score %d", G.score); plat_text(206, 36, 18, RGB(255, 255, 255), T_SHADOW, b);
    snprintf(b, 80, "Best %d", ST.best > G.score ? ST.best : G.score); plat_text(206, 58, 13, RGB(255, 220, 232), 0, b);
    if (G.quipT > 0) { float w = plat_text_w(14, G.quip) + 20; if (w > 190) w = 190; ui_card(196, 88, 196, 40, 14, RGB(255, 250, 252)); ui_text_box(204, 92, 180, 14, RGB(80, 40, 64), G.quip, 2); }
    /* merge chain legend */
    ui_card(150, 150, 244, 80, 12, RGBA(20, 8, 30, 175)); plat_text(158, 152, 11, RGB(255, 210, 225), 0, "Merge chain  (match two to grow)");
    for (int i = 0; i < NT; i++) { float x = 166 + i * 23, y = 188; float r = 4 + i * 0.95f; draw_orb(x, y - (i > 6 ? 0 : 0), r, i + 1, 0, 0); if (i == G.maxTier - 1) plat_rect(x - 2, y + 15, 4, 3, RGB(255, 230, 140)); }
    plat_text(272, 206, 11, RGBA(255, 255, 255, 190), T_CENTER, "Petal > Bud > Blossom > ... > Cherry Tree");
    plat_text(272, 217, 11, RGBA(255, 255, 255, 140), T_CENTER, G.maxTier ? T[G.maxTier - 1].name : "");
}

static int pick_character(void) {
    const char *it[9], *de[9]; static char nm[9][80], dt[9][300];
    for (int i = 0; i < 9; i++) {
        bool u = unlocked(i); snprintf(nm[i], 80, "%s%s", CH[i].name, u ? "" : "   (locked)");
        if (u) snprintf(dt[i], 300, "%s\n%s: %s\nBest %d", CH[i].tag, CH[i].ab_name, CH[i].ab_desc, ST.perBest[i]);
        else snprintf(dt[i], 300, "Locked. %s.", CH[i].need_txt);
        it[i] = nm[i]; de[i] = dt[i];
    }
    int p = ui_menu("Choose your player", "Blossom Drop", it, de, 9, ST.last < 9 ? ST.last : 0);
    if (p >= 0 && !unlocked(p)) { snprintf(dt[p], 300, "Locked. %s.", CH[p].need_txt); return -2; }
    return p;
}

static void run_game(int ch) {
    Img *portrait; char nm[40]; snprintf(nm, 40, "ch_%s", CH[ch].id); portrait = img_get(nm);
    reset(ch); rs ^= (unsigned)plat_time_ms() * 2654435761u; bool paused = false; bool touching = false;
    while (ui_frame()) {
        const Input *in = plat_input(); bool decree_pick = false; int decree_tier = 0;
        if (G.state == S_OVER) {
            if (G.t - G.overAt > 1.2f) break;
        }
        if (!paused) {
            if (in->held & K_LEFT) G.pointer -= 330 * (1.0f / 60); if (in->held & K_RIGHT) G.pointer += 330 * (1.0f / 60);
            G.pointer = clampf(G.pointer, 0, JW);
            if (in->touch_held && in->tx >= JX - 6 && in->tx <= JX + JW * JS + 6) { G.pointer = (in->tx - JX) / JS; touching = true; if (G.state == S_DECAY && in->touch_down) decay_at((in->tx - JX) / JS, (in->ty - JY) / JS); }
            if (in->touch_up && touching && G.state == S_PLAY) { drop(); } touching = in->touch_held;
            if (in->down & K_A) drop();
            if (G.state == S_PLAY && ((in->down & (K_X | K_Y)) || ui_hit(178, 118, 136, 52))) use_ability();
            if (G.state == S_DECAY && (in->down & K_B)) G.state = S_PLAY;
            if (G.state == S_DECAY && (in->down & K_A)) { /* pick the biggest orb under the pointer column */
                Orb *best = NULL; for (int i = 0; i < MAXO; i++) { Orb *o = &G.o[i]; if (o->live && fabsf(o->x - G.pointer) < o->r && (!best || o->tier > best->tier)) best = o; } if (best) decay_at(best->x, best->y); }
            if (G.state == S_DECREE) {
                const char *it[5]; static char nb[5][40]; for (int i = 0; i < 5; i++) { snprintf(nb[i], 40, "%s  (tier %d)", T[i].name, i + 1); it[i] = nb[i]; }
                int p = ui_menu("Decree", "Choose your next piece", it, NULL, 5, 0); if (g_quit) return;
                if (p >= 0) { G.held = p + 1; G.meter = 0; G.state = S_PLAY; } else G.state = S_PLAY;
            }
            if (G.state != S_DECREE) { G.accum += 1.0f / 60; int guard = 0; while (G.accum >= 1.0f / 60 && guard++ < 3) { G.accum -= 1.0f / 60; step(1.0f / 60); } }
        }
        if ((in->down & K_START) || ui_hit(178, 178, 64, 26)) {
            const char *it[3] = { "Resume", "New game (same character)", "Quit to menu" }; int p = ui_menu("Paused", NULL, it, NULL, 3, 0); if (g_quit) return;
            if (p == 1) { reset(ch); } else if (p == 2) { goto finish; }
        }
        (void)decree_pick; (void)decree_tier;
        plat_target(0); draw_top(portrait);
        plat_target(1); ui_bg_bottom(G.t); draw_jar(); draw_panel();
        if (G.state == S_DECAY) { plat_rect(JX, JY + JH * JS - 18, JW * JS, 16, RGBA(20, 8, 30, 190)); plat_text(JX + JW * JS / 2, JY + JH * JS - 17, 12, RGB(255, 255, 255), T_CENTER, "Tap an orb to crumble it"); }
    }
finish:
    if (G.score > 0 || G.merges) {
        ST.games++; ST.merges += G.merges; if (G.score > ST.best) ST.best = G.score; if (G.maxTier > ST.maxTier) ST.maxTier = G.maxTier; if (G.bestCombo > ST.bestCombo) ST.bestCombo = G.bestCombo;
        if (G.score > ST.perBest[ch]) ST.perBest[ch] = G.score; ST.last = ch; stats_save();
    }
}

void blossom_play(void) {
    stats_load();
    while (!g_quit) {
        int ch = pick_character(); if (ch == -1 || g_quit) break; if (ch == -2) continue;
        bool again = true;
        while (again && !g_quit) {
            run_game(ch); if (g_quit) return;
            char l1[80], l2[80]; snprintf(l1, 80, "Score %d   -   biggest: %s", G.score, G.maxTier ? T[G.maxTier - 1].name : "none"); snprintf(l2, 80, "Best combo x%d   -   merges %d", G.bestCombo, G.merges);
            const char *it[3] = { "Play again", "Change character", "Back to title" }; const char *de[3] = { l1, l2, "" };
            if (G.state == S_OVER) { int p = ui_menu("Jar overflowed!", l1, it, de, 3, 0); stats_load(); if (p == 0) continue; again = false; if (p == 2 || p < 0) { return; } }
            else return;
        }
    }
}

#ifdef OSH_PHYS_TEST
#endif
