/* sound.c — procedural PSG music + effects. ch1 = melody, ch3 = bass (wave), ch2/ch4 = effects. Driven by snd_tick() at 60 Hz. */
#include "sound.h"
#include "save.h"
#define R(a) REG16(a)
/* PSG frequency register values for MIDI notes 36..84 */
static const u16 NOTE[49] = { 44, 157, 263, 363, 457, 547, 631, 711, 786, 856, 923, 986, 1046, 1102, 1155, 1205, 1253, 1297, 1339, 1379, 1417, 1452, 1486, 1517, 1547, 1575, 1602, 1627, 1650, 1673, 1694, 1714, 1732, 1750, 1767, 1783, 1798, 1812, 1825, 1837, 1849, 1860, 1871, 1881, 1890, 1899, 1907, 1915, 1923 };
static int cur_mood = -2, step, tcount, seed_s;
typedef struct { u8 tempo, root, duty, vol; u8 scale[7]; u8 nscale; u8 density; u8 lead_oct; u8 seed; } Mood;
/* mood order matches MOOD_ ids: spring night festival tense ruin sorrow hope battle quiet */
static const Mood MOODS[9] = {
    { 9, 55, 2, 6, { 0, 2, 4, 7, 9, 12, 0 }, 6, 6, 1, 3 },       /* spring: major pentatonic, bright */
    { 12, 50, 1, 5, { 0, 3, 5, 7, 10, 12, 0 }, 6, 4, 1, 7 },      /* night */
    { 7, 57, 2, 7, { 0, 2, 4, 5, 7, 9, 11 }, 7, 8, 1, 11 },       /* festival: major, quick */
    { 8, 48, 1, 6, { 0, 1, 3, 5, 6, 8, 10 }, 7, 5, 1, 5 },        /* tense: locrian-ish */
    { 14, 45, 0, 5, { 0, 2, 3, 5, 7, 8, 10 }, 7, 3, 0, 13 },      /* ruin: minor, sparse */
    { 15, 50, 1, 5, { 0, 2, 3, 5, 7, 8, 10 }, 7, 3, 1, 17 },      /* sorrow */
    { 10, 53, 2, 6, { 0, 2, 4, 7, 9, 12, 14 }, 7, 6, 1, 19 },     /* hope */
    { 6, 45, 1, 7, { 0, 2, 3, 5, 7, 8, 11 }, 7, 9, 0, 23 },       /* battle: harmonic minor, fast */
    { 16, 55, 2, 4, { 0, 2, 4, 7, 9, 12, 0 }, 6, 2, 1, 29 },      /* quiet */
};
static int lcg(void) { seed_s = seed_s * 1664525 + 1013904223; return (seed_s >> 16) & 0x7FFF; }
static int pat_note[64], pat_bass[16];

static void gen_pattern(int m) {
    const Mood *mo = &MOODS[m]; seed_s = mo->seed * 7919; int deg = 2;
    for (int i = 0; i < 64; i++) {
        if ((i & 15) == 0 || lcg() % 10 < mo->density) {
            deg += (lcg() % 5) - 2; if (deg < 0) deg = 0; if (deg > mo->nscale + 2) deg = mo->nscale + 2;
            if ((i & 15) == 15) deg = (i >> 4) & 1 ? 0 : 2;
            int oct = deg / mo->nscale, d = deg % mo->nscale;
            pat_note[i] = mo->root + 12 * (mo->lead_oct + oct) + mo->scale[d] - 12;
        } else pat_note[i] = -1;
    }
    static const u8 root_off[4] = { 0, 9, 5, 7 };
    for (int i = 0; i < 16; i++) pat_bass[i] = mo->root - 12 + root_off[i & 3];
}
static void wave_init(void) {
    REG16(0x04000070) = 0x40;                          /* play bank 1 so bank 0 is writable */
    static const u8 tri[16] = { 0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10 };
    for (int i = 0; i < 8; i++) REG16(0x04000090 + i * 2) = tri[i * 2] | (tri[i * 2 + 1] << 8);
    REG16(0x04000070) = 0x00; REG16(0x04000070) = 0x80;
}
void snd_init(void) {
    R(0x04000084) = 0x80; R(0x04000080) = 0xFF77; R(0x04000082) = 2;
    R(0x04000060) = 0; wave_init(); cur_mood = -2;
}
static int tonecap(int n) { return n < 36 ? 36 : n > 84 ? 84 : n; }
void snd_music(int mood) {
    if (mood == cur_mood) return;
    cur_mood = mood;
    if (mood == 0xFF || mood >= 9) { R(0x04000062) = 0; R(0x04000064) = 0x8000; R(0x04000072) = 0; return; }
    gen_pattern(mood); step = 0; tcount = 0;
}

/* effects: script of (reg value, frames) on ch2; noise on ch4 */
typedef struct { u8 n; u8 dur; u16 f[6]; u8 noise; } Sfx;
static const Sfx SFX[10] = {
    { 2, 3, { 1750, 1850 }, 0 },                       /* choice */
    { 1, 5, { 300 }, 1 },                              /* drop thud */
    { 3, 3, { 1700, 1800, 1900 }, 0 },                 /* merge (shifted by tier) */
    { 6, 4, { 1750, 1800, 1850, 1900, 1950, 1990 }, 0 },
    { 5, 3, { 1500, 1650, 1750, 1850, 1920, 1990 }, 0 },
    { 5, 8, { 1900, 1800, 1700, 1600, 1500 }, 1 },     /* over */
    { 4, 6, { 1700, 1790, 1860, 1990 }, 0 },           /* chapter */
    { 2, 3, { 1950, 1900 }, 0 },                       /* warn */
    { 1, 6, { 0 }, 1 },                                /* hit */
    { 1, 1, { 1990 }, 0 },                             /* tick */
};
static const Sfx *sf; static int sf_i, sf_t, sf_shift;
void snd_sfx(int id, int arg) {
    if (!G.music) return;
    sf = &SFX[id]; sf_i = 0; sf_t = 0; sf_shift = id == SFX_MERGE ? arg * 25 : 0;
    if (sf->noise) { R(0x04000078) = 0xA100 | 0x0002; R(0x0400007C) = 0x8000 | (id == SFX_HIT ? 0x0053 : 0x0063); }
}
void snd_tick(void) {
    if (sf) {
        if (sf_t == 0) {
            if (sf_i >= sf->n) sf = 0;
            else { u16 f = sf->f[sf_i] + sf_shift; if (f > 2040) f = 2040; if (!(sf->noise && sf->f[sf_i] < 400)) { R(0x04000068) = 0x80C1; R(0x0400006C) = 0x8000 | f; } sf_i++; sf_t = sf->dur; }
        }
        if (sf_t) sf_t--;
    }
    if (cur_mood < 0 || cur_mood >= 9 || !G.music) { if (!G.music && cur_mood >= 0) { R(0x04000064) = 0x8000; R(0x04000062) = 0; R(0x04000072) = 0; } return; }
    const Mood *mo = &MOODS[cur_mood];
    if (++tcount < mo->tempo) return;
    tcount = 0;
    int n = pat_note[step & 63];
    if (n >= 0) { R(0x04000062) = (mo->duty << 6) | (mo->vol << 12) | (2 << 8); R(0x04000064) = 0x8000 | NOTE[tonecap(n) - 36]; }
    if ((step & 3) == 0) { int b = pat_bass[(step >> 2) & 15]; R(0x04000072) = 0x2000; R(0x04000074) = 0x8000 | NOTE[tonecap(b + 12) - 36]; }
    step++;
}
