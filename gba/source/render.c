#include "render.h"

u8 fb[W * H] EWRAM;
static int nglyph; static const u8 *gtab, *gpix;
static u16 ui_pal[64];

static u16 mix(u16 a, u16 b, int t /*0..3*/) {
    int ar = a & 31, ag = (a >> 5) & 31, ab = (a >> 10) & 31, br = b & 31, bg = (b >> 5) & 31, bb = (b >> 10) & 31;
    return (ar + (br - ar) * t / 3) | ((ag + (bg - ag) * t / 3) << 5) | ((ab + (bb - ab) * t / 3) << 10);
}
#define C555(r, g, b) ((u16)(((r) >> 3) | (((g) >> 3) << 5) | (((b) >> 3) << 10)))
static void ramp_set(int k, u16 fill, u16 fg) { for (int t = 0; t < 4; t++) ui_pal[RAMP(k) - 192 + t] = mix(fill, fg, t); }
void ui_palette(void) { for (int i = 0; i < 64; i++) PAL_BG[192 + i] = ui_pal[i]; }

void gfx_init(void) {
    REG_DISPCNT = 0x0080;
    const u8 *font = assets_bin + OFF_FONT; nglyph = rd16(font); gtab = font + 4; gpix = gtab + nglyph * 11;
    u16 box = C555(34, 20, 58), hl = C555(250, 232, 238), dark = C555(10, 6, 20);
    ui_pal[0] = box; ui_pal[COL_BLACK - 192] = 0; ui_pal[COL_ACCENT - 192] = C555(255, 140, 170); ui_pal[COL_WHITE - 192] = C555(255, 255, 255);
    ramp_set(RAMP_WHITE, box, C555(250, 246, 255)); ramp_set(RAMP_DIM, box, C555(165, 150, 195)); ramp_set(RAMP_GOLD, box, C555(255, 214, 120));
    ramp_set(RAMP_SEL, hl, C555(60, 24, 70)); ramp_set(RAMP_DARK_WHITE, dark, C555(255, 255, 255)); ramp_set(RAMP_DARK_GOLD, dark, C555(255, 214, 120));
    for (int i = 0; i < N_CH; i++) ramp_set(RAMP_NAME0 + i, box, CHAR_COL[i]);
    REG_BG2CNT = 0; REG_BG2PA = 0x100; REG_BG2PB = 0; REG_BG2PC = 0; REG_BG2PD = 0x100; REG_BG2X = 0; REG_BG2Y = 0;
    spr_init();
    memset(fb, COL_BLACK, sizeof fb);
    ui_palette();
    REG_DISPCNT = 0x0404 | 0x1000 | 0x40;
}

int gfx_faded;
void obj_enable(int on) { if (on) REG_DISPCNT |= 0x1000; else REG_DISPCNT &= ~0x1000; }
void fb_flush(int y0, int y1) {
    vram_copy((u8 *)VRAM + y0 * W, fb + y0 * W, (y1 - y0) * W);
    if (gfx_faded) { for (int i = 16; i >= 0; i -= 2) { REG_BLDY = i; vsync(); } REG_BLDCNT = 0; gfx_faded = 0; }
}
void fb_fill(int x, int y, int w, int h, u8 c) {
    if (x < 0) { w += x; x = 0; } if (y < 0) { h += y; y = 0; } if (x + w > W) w = W - x; if (y + h > H) h = H - y;
    for (int j = 0; j < h; j++) { u8 *p = fb + (y + j) * W + x; for (int i = 0; i < w; i++) p[i] = c; }
}
void fb_rect_frame(int x, int y, int w, int h, u8 c) { fb_fill(x, y, w, 1, c); fb_fill(x, y + h - 1, w, 1, c); fb_fill(x, y, 1, h, c); fb_fill(x + w - 1, y, 1, h, c); }

void bg_load(int id) {
    const u8 *b = assets_bin + BG_OFF[id];
    for (int i = 0; i < 192; i++) PAL_BG[i] = rd16(b + i * 2);
    memcpy(fb, b + 384, W * ART_H);
    memset(fb + W * ART_H, COL_BLACK, W * (H - ART_H));
}

/* ------------------------------------------------------------------ text */
static const u8 *glyph(u32 cp) {
    int lo = 0, hi = nglyph - 1;
    while (lo <= hi) { int m = (lo + hi) >> 1; u32 c = rd32(gtab + m * 11); if (c == cp) return gtab + m * 11; if (c < cp) lo = m + 1; else hi = m - 1; }
    return 0;
}
static u32 next_cp(const char **ps) {
    const u8 *s = (const u8 *)*ps; u32 c = *s++;
    if (c >= 0xE0) { c = ((c & 15) << 12) | ((s[0] & 63) << 6) | (s[1] & 63); s += 2; }
    else if (c >= 0xC0) { c = ((c & 31) << 6) | (s[0] & 63); s += 1; }
    *ps = (const char *)s; return c;
}
static int adv_of(u32 cp) { const u8 *g = glyph(cp); if (!g) g = glyph('?'); return g ? g[4] : 4; }
int text_w(const char *s) {
    int w = 0;
    while (*s && *s != '\n') { u32 c = next_cp(&s); if (c == '*') continue; w += adv_of(c); }
    return w;
}
static int blit_glyph(int x, int y, u32 cp, int ramp, int scale) {
    const u8 *g = glyph(cp); if (!g) g = glyph('?'); if (!g) return 4 * scale;
    int adv = g[4], xo = (s8)g[5], yo = (s8)g[6], gw = g[7], gh = g[8], off = rd16(g + 9);
    const u8 *p = gpix + off; int base = RAMP(ramp);
    for (int r = 0; r < gh; r++) for (int c = 0; c < gw; c++) {
        int lv = p[r * gw + c]; if (!lv) continue;
        int px = x + (xo + c) * scale, py = y + (yo + r) * scale;
        for (int j = 0; j < scale; j++) for (int i = 0; i < scale; i++) {
            int X = px + i, Y = py + j; if ((unsigned)X < W && (unsigned)Y < H) fb[Y * W + X] = base + lv;
        }
    }
    return adv * scale;
}
int text_draw_n(int x, int y, const char *s, int n, int ramp) {
    while (*s && *s != '\n' && n != 0) { u32 c = next_cp(&s); if (c == '*') continue; x += blit_glyph(x, y, c, ramp, 1); n--; }
    return x;
}
int text_draw(int x, int y, const char *s, int ramp, int maxx) { (void)maxx; return text_draw_n(x, y, s, -1, ramp); }
void text_center(int cx, int y, const char *s, int ramp) { text_draw(cx - text_w(s) / 2, y, s, ramp, W); }
void text_draw2x(int cx, int y, const char *s, int ramp) {
    int x = cx - text_w(s); while (*s && *s != '\n') { u32 c = next_cp(&s); if (c == '*') continue; x += blit_glyph(x, y, c, ramp, 2); }
}
int text_wrap(const char *s, int maxw, const char **start, u8 *len, int maxlines) {
    int n = 0;
    while (*s && n < maxlines) {
        const char *ls = s, *lastsp = 0; int w = 0, wsp = 0; const char *p = s;
        for (;;) {
            if (!*p) { s = p; break; }
            if (*p == '\n') { s = p + 1; break; }
            const char *q = p; u32 c = next_cp(&q); int a = (c == '*') ? 0 : adv_of(c);
            if (c == ' ') { lastsp = p; wsp = w; }
            if (w + a > maxw && c != ' ') { if (lastsp) { p = lastsp; w = wsp; s = lastsp + 1; } else s = p; break; }
            w += a; p = q;
        }
        start[n] = ls; len[n] = (u8)(p - ls); n++;
        if (!*s) break;
    }
    return n;
}
void tbox_draw(void) {
    fb_fill(0, BOX_Y, W, H - BOX_Y, COL_BOX);
    fb_fill(0, BOX_Y, W, 1, COL_ACCENT);
}

/* ------------------------------------------------------------------ sprites */
#define NPART 14
static struct { s32 x, y; s16 vx, vy; u8 on; } part[NPART];
static int wx_kind = -1;
static u16 stage_pal[3][16];
static int stage_n; static u8 stage_ch[3];

void spr_hide_all(void) { for (int i = 0; i < 128; i++) { OAM[i * 4] = 0x200; OAM[i * 4 + 1] = 0; OAM[i * 4 + 2] = 0; } }
static const u8 PART_TILES[4][8] = {    /* 8x8 1-nibble-per-pixel glyphs: petal, dust, ash/ember, rain streak */
    { 0x00, 0x11, 0x12, 0x11, 0x01, 0x00, 0x00, 0x00 }, { 0, 0, 0, 0x01, 0, 0, 0, 0 }, { 0, 0, 0x01, 0x11, 0x01, 0, 0, 0 }, { 0x01, 0x01, 0x01, 0x01, 0, 0, 0, 0 } };
void spr_init(void) {
    spr_hide_all();
    /* particle tiles at tile 800.. (slot 3) */
    for (int t = 0; t < 4; t++) {
        u32 tile[8];
        static const u8 shape[4][8][8] = {
            { {0,0,0,0,0,0,0,0}, {0,0,1,1,0,0,0,0}, {0,1,1,2,1,0,0,0}, {0,1,2,1,1,1,0,0}, {0,0,1,1,1,1,0,0}, {0,0,0,1,1,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0} },
            { {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,1,1,0,0,0}, {0,0,0,1,1,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0} },
            { {0,0,0,0,0,0,0,0}, {0,0,0,1,0,0,0,0}, {0,0,1,1,1,0,0,0}, {0,0,0,1,2,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0} },
            { {0,0,0,0,1,0,0,0}, {0,0,0,1,0,0,0,0}, {0,0,0,1,0,0,0,0}, {0,0,1,0,0,0,0,0}, {0,0,1,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0}, {0,0,0,0,0,0,0,0} } };
        for (int r = 0; r < 8; r++) { u32 v = 0; for (int c = 0; c < 8; c++) v |= (u32)shape[t][r][c] << (c * 4); tile[r] = v; }
        volatile u32 *d = (volatile u32 *)((u8 *)VRAM_OBJ_M4 + (3 * 96 + t) * 32);
        for (int i = 0; i < 8; i++) d[i] = tile[i];
    }
}
static u16 dim(u16 c, int num) { int r = (c & 31) * num >> 3, g = ((c >> 5) & 31) * num >> 3, b = ((c >> 10) & 31) * num >> 3; return r | (g << 5) | (b << 10); }
static void stage_pal_apply(int speaker) {
    for (int k = 0; k < stage_n; k++) { int lit = speaker < 0 || stage_ch[k] == speaker; for (int i = 1; i < 16; i++) PAL_OBJ[k * 16 + i] = lit ? stage_pal[k][i] : dim(stage_pal[k][i], 5); }
}
void stage_set(const u8 *chars, int n, int speaker) {
    int first = n > 3 ? n - 3 : 0; int cnt = n - first;
    int same = (cnt == stage_n);
    for (int k = 0; same && k < cnt; k++) if (stage_ch[k] != chars[first + k]) same = 0;
    if (!same) {
        stage_n = cnt;
        for (int k = 0; k < cnt; k++) {
            stage_ch[k] = chars[first + k];
            const u8 *b = assets_bin + CHAR_OFF[stage_ch[k]];
            for (int i = 0; i < 16; i++) stage_pal[k][i] = rd16(b + i * 2);
            vram_copy((u8 *)VRAM_OBJ_M4 + k * 3072, b + 32, 3072);
        }
        static const int X1[1] = { 88 }, X2[2] = { 40, 136 }, X3[3] = { 8, 88, 168 };
        const int *xs = cnt == 1 ? X1 : cnt == 2 ? X2 : X3;
        for (int k = 0; k < 3; k++) {
            if (k >= cnt) { OAM[k * 8] = 0x200; OAM[k * 8 + 4] = 0x200; continue; }
            int tile = 512 + k * 96;
            OAM[k * 8 + 0] = (BOX_Y - 96 + 0) & 0xFF;                 /* A: 64x64, y=12 */
            OAM[k * 8 + 1] = (xs[k] & 0x1FF) | (3 << 14);
            OAM[k * 8 + 2] = tile | (k << 12);
            OAM[k * 8 + 4] = ((BOX_Y - 96 + 64) & 0xFF) | (1 << 14);  /* B: 64x32 (wide) */
            OAM[k * 8 + 5] = (xs[k] & 0x1FF) | (3 << 14);
            OAM[k * 8 + 6] = (tile + 64) | (k << 12);
        }
    }
    stage_pal_apply(speaker);
}

void weather_set(int wx) {
    wx_kind = wx == NONE ? -1 : wx;
    for (int i = 0; i < NPART; i++) { part[i].on = wx_kind >= 0; part[i].x = ((i * 37) % 240) << 8; part[i].y = ((i * 53) % 130) << 8; part[i].vx = 0; part[i].vy = 0; }
    if (wx_kind < 0) { for (int i = 0; i < NPART; i++) OAM[(8 + i) * 4] = 0x200; return; }
}
static int rnd_s = 12345; static int rnd(void) { rnd_s = rnd_s * 1103515245 + 12345; return (rnd_s >> 16) & 0x7FFF; }
/* per WX_ id: tile, colour 1/2, fall speed (8.8 px/frame), sideways drift */
static const u8 WTILE[6] = { 1, 0, 2, 3, 1, 2 };
static const u16 WC1[6] = { C555(235, 228, 210), C555(255, 170, 200), C555(150, 140, 150), C555(150, 190, 240), C555(220, 255, 140), C555(255, 150, 60) };
static const u16 WC2[6] = { C555(255, 255, 255), C555(255, 235, 245), C555(215, 205, 205), C555(225, 238, 255), C555(255, 255, 210), C555(255, 220, 120) };
static const s16 WVY[6] = { 30, 80, 60, 900, 12, -50 };
void weather_step(void) {
    if (wx_kind < 0 || wx_kind > 5) return;
    int k = wx_kind;
    PAL_OBJ[48 + 1] = WC1[k]; PAL_OBJ[48 + 2] = WC2[k];
    for (int i = 0; i < NPART; i++) {
        int vy = WVY[k] + (k == 3 ? 0 : (i & 3) * 14); int vx = k == 3 ? 0 : k == 1 ? 50 + (i & 3) * 16 : ((i & 1) ? 18 : -18);
        part[i].x += vx; part[i].y += vy;
        if (k == 1 || k == 4 || k == 0) part[i].x += (((i * 31 + (part[i].y >> 7)) & 63) - 32) * (k == 1 ? 2 : 1);
        if (vy > 0 && (part[i].y >> 8) > 112) { part[i].y = -(8 << 8); part[i].x = (rnd() % 232) << 8; }
        if (vy < 0 && (part[i].y >> 8) < -8) { part[i].y = 112 << 8; part[i].x = (rnd() % 232) << 8; }
        if ((part[i].x >> 8) > 240) part[i].x -= 248 << 8; if (part[i].x < 0) part[i].x += 240 << 8;
        int px = part[i].x >> 8, py = part[i].y >> 8;
        OAM[(8 + i) * 4 + 0] = (py & 0xFF); OAM[(8 + i) * 4 + 1] = (px & 0x1FF);
        OAM[(8 + i) * 4 + 2] = (800 + WTILE[k]) | (3 << 12);
        if (py < 0 || py > 112) OAM[(8 + i) * 4] = 0x200;
    }
}

/* ------------------------------------------------------------------ screen effects */
static int fx_fl, fx_fl_dark, fx_sh;
void fx_flash(u16 dark) { fx_fl = 16; fx_fl_dark = dark; }
void fx_shake(int s) { fx_sh = 10 + s * 4; }
void fx_step(void) {
    if (fx_fl > 0) { REG_BLDCNT = (fx_fl_dark ? 0x80 : 0x40) | 0x3F; REG_BLDY = fx_fl > 16 ? 16 : fx_fl; fx_fl--; if (!fx_fl) REG_BLDCNT = 0; }
    if (fx_sh > 0) { int a = fx_sh > 8 ? 8 : fx_sh; int dx = (rnd() % (2 * a + 1)) - a, dy = (rnd() % (a + 1)) - a / 2; REG_BG2X = (u32)(dx << 8); REG_BG2Y = (u32)(dy << 8); fx_sh--; if (!fx_sh) { REG_BG2X = 0; REG_BG2Y = 0; } }
}
