#include "synth.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define TAU 6.2831853f
static float mtof(float m) { return 440.0f * powf(2.0f, (m - 69.0f) / 12.0f); }
static unsigned seed = 7;
static float rnd(void) { seed = seed * 1664525u + 1013904223u; return (seed >> 8) / 16777216.0f; }

typedef struct { int16_t *buf; size_t n; int wrap; } Mix;
static void add(Mix *m, size_t i, float v) {
    if (m->wrap) i %= m->n; else if (i >= m->n) return;
    int s = m->buf[i] + (int)(v * 32767.0f); if (s > 32767) s = 32767; if (s < -32768) s = -32768; m->buf[i] = (int16_t)s;
}
/* wave: 0 sine, 1 triangle, 2 saw, 3 square */
static float wave(int w, float ph) {
    ph -= floorf(ph);
    switch (w) { case 0: return sinf(ph * TAU); case 1: return ph < 0.5f ? 4 * ph - 1 : 3 - 4 * ph; case 2: return 2 * ph - 1; default: return ph < 0.5f ? 1.0f : -1.0f; }
}
/* attack/exp-decay note, optional pitch slide (to > 0) */
static void tone(Mix *m, int w, float f0, float f1, float t0, float dur, float vol, float atk, float rel_pow) {
    size_t s0 = (size_t)(t0 * SYN_RATE), len = (size_t)(dur * SYN_RATE); float ph = 0;
    for (size_t i = 0; i < len; i++) {
        float t = (float)i / SYN_RATE, k = (float)i / len, f = f1 > 0 ? f0 * powf(f1 / f0, k) : f0;
        float env = (t < atk ? t / atk : 1.0f) * powf(1 - k, rel_pow);
        ph += f / SYN_RATE; add(m, s0 + i, wave(w, ph) * vol * env);
    }
}
static void noise(Mix *m, float t0, float dur, float vol, float lp) {
    size_t s0 = (size_t)(t0 * SYN_RATE), len = (size_t)(dur * SYN_RATE); float y = 0;
    for (size_t i = 0; i < len; i++) { y += (rnd() * 2 - 1 - y) * lp; float k = (float)i / len; add(m, s0 + i, y * vol * (1 - k) * (1 - k)); }
}
static int16_t *new_buf(float secs, Mix *m, size_t *out, int wrap) {
    m->n = (size_t)(secs * SYN_RATE); m->buf = calloc(m->n, sizeof(int16_t)); m->wrap = wrap; *out = m->n; return m->buf;
}

int16_t *synth_sfx(const char *name, size_t *n) {
    Mix m; seed = 99;
    #define IS(x) (!strcmp(name, x))
    if (IS("click") || IS("page")) { new_buf(0.1f, &m, n, 0); tone(&m, 1, 880, 0, 0, 0.06f, 0.18f, 0.004f, 2); }
    else if (IS("choice")) { new_buf(0.3f, &m, n, 0); tone(&m, 1, 660, 0, 0, 0.12f, 0.25f, 0.005f, 2); tone(&m, 1, 990, 0, 0.07f, 0.18f, 0.22f, 0.005f, 2); }
    else if (IS("chime")) { new_buf(1.1f, &m, n, 0); tone(&m, 0, 784, 0, 0, 0.5f, 0.2f, 0.01f, 2); tone(&m, 0, 1175, 0, 0.09f, 0.7f, 0.17f, 0.01f, 2); tone(&m, 0, 1568, 0, 0.18f, 0.9f, 0.14f, 0.01f, 2); }
    else if (IS("chapter")) { new_buf(1.3f, &m, n, 0); tone(&m, 0, 523, 0, 0, 0.6f, 0.2f, 0.01f, 2); tone(&m, 0, 659, 0, 0.12f, 0.7f, 0.17f, 0.01f, 2); tone(&m, 0, 784, 0, 0.24f, 1.0f, 0.17f, 0.01f, 2); }
    else if (IS("hit")) { new_buf(0.4f, &m, n, 0); tone(&m, 0, 120, 38, 0, 0.35f, 0.6f, 0.004f, 2); noise(&m, 0, 0.3f, 0.5f, 0.25f); }
    else if (IS("alert")) { new_buf(0.8f, &m, n, 0); for (int i = 0; i < 3; i++) tone(&m, 3, 740, 700, i * 0.22f, 0.14f, 0.16f, 0.004f, 1.5f); }
    else if (IS("gong")) { new_buf(2.4f, &m, n, 0); tone(&m, 0, 110, 0, 0, 2.2f, 0.4f, 0.01f, 2); tone(&m, 0, 165, 0, 0.02f, 2.0f, 0.25f, 0.01f, 2); tone(&m, 1, 221, 0, 0.02f, 1.6f, 0.14f, 0.01f, 2); }
    else if (IS("drop")) { new_buf(0.15f, &m, n, 0); tone(&m, 0, 420, 260, 0, 0.1f, 0.3f, 0.003f, 2); }
    else if (IS("pop")) { new_buf(0.25f, &m, n, 0); tone(&m, 0, 520, 900, 0, 0.12f, 0.35f, 0.003f, 1.5f); tone(&m, 1, 1040, 0, 0.04f, 0.15f, 0.15f, 0.003f, 2); }
    else if (IS("pop_big")) { new_buf(0.6f, &m, n, 0); tone(&m, 0, 392, 784, 0, 0.3f, 0.35f, 0.004f, 1.5f); tone(&m, 0, 784, 1568, 0.06f, 0.4f, 0.22f, 0.004f, 2); tone(&m, 0, 98, 60, 0, 0.3f, 0.35f, 0.004f, 2); }
    else if (IS("bloom")) { new_buf(1.4f, &m, n, 0); const float N[5] = { 523, 659, 784, 1047, 1319 }; for (int i = 0; i < 5; i++) tone(&m, 0, N[i], 0, i * 0.09f, 0.9f, 0.2f, 0.01f, 2); }
    else if (IS("over")) { new_buf(1.0f, &m, n, 0); tone(&m, 1, 330, 110, 0, 0.9f, 0.3f, 0.01f, 1.2f); }
    else if (IS("fire")) { new_buf(0.6f, &m, n, 0); noise(&m, 0, 0.5f, 0.5f, 0.2f); tone(&m, 2, 300, 90, 0, 0.5f, 0.14f, 0.01f, 1.5f); }
    else return NULL;
    return m.buf;
}

typedef struct { float bpm; int root; int nscale; int scale[9]; int nch; int ch[4][4]; int pad; float padVol, pluck, pluckVol; int bass, pulse; float noiseVol; } Mood;
static const struct { const char *name; Mood m; } MOODS[] = {
    { "spring",   { 80, 60, 8, { 0, 2, 4, 7, 9, 12, 14, 16 }, 4, { { 0, 4, 7, 11 }, { -3, 0, 4, 7 }, { -7, -3, 0, 4 }, { -5, -1, 2, 7 } }, 1, 0.07f, 0.55f, 0.10f, 0, 0, 0 } },
    { "night",    { 64, 57, 7, { 0, 3, 5, 7, 10, 12, 15 }, 4, { { 0, 7, 10, 15 }, { -4, 3, 7, 12 }, { -2, 5, 9, 12 }, { -5, 2, 7, 10 } }, 0, 0.085f, 0.28f, 0.09f, 0, 0, 0 } },
    { "festival", { 104, 62, 9, { 0, 2, 4, 7, 9, 12, 14, 16, 19 }, 4, { { 0, 4, 7, 12 }, { 5, 9, 12, 16 }, { 7, 11, 14, 19 }, { -3, 0, 4, 9 } }, 1, 0.05f, 0.8f, 0.11f, 1, 0, 0 } },
    { "tense",    { 70, 50, 7, { 0, 1, 3, 5, 7, 8, 12 }, 4, { { 0, 7, 12, 13 }, { 0, 6, 10, 15 }, { -2, 5, 10, 12 }, { -5, 0, 7, 10 } }, 2, 0.035f, 0.2f, 0.09f, 1, 0, 0.025f } },
    { "ruin",     { 58, 52, 7, { 0, 3, 5, 7, 10, 12, 15 }, 4, { { 0, 7, 12, 15 }, { -4, 3, 7, 12 }, { -5, 2, 7, 10 }, { -7, 0, 5, 9 } }, 1, 0.06f, 0.16f, 0.08f, 0, 0, 0.03f } },
    { "sorrow",   { 54, 57, 8, { 0, 2, 3, 7, 8, 12, 14, 15 }, 4, { { 0, 7, 12, 15 }, { -4, 3, 8, 12 }, { -2, 5, 9, 14 }, { -7, 0, 7, 10 } }, 0, 0.09f, 0.32f, 0.10f, 0, 0, 0 } },
    { "hope",     { 76, 62, 9, { 0, 2, 4, 7, 9, 12, 14, 16, 19 }, 4, { { 0, 4, 7, 14 }, { -3, 4, 9, 12 }, { -5, 2, 7, 11 }, { -7, 0, 4, 9 } }, 1, 0.075f, 0.6f, 0.11f, 0, 0, 0 } },
    { "battle",   { 132, 48, 7, { 0, 3, 5, 7, 10, 12, 15 }, 4, { { 0, 7, 12, 15 }, { 0, 7, 12, 15 }, { -4, 3, 8, 12 }, { -2, 5, 10, 14 } }, 2, 0.035f, 0.3f, 0.08f, 1, 1, 0.02f } },
    { "quiet",    { 50, 55, 5, { 0, 2, 7, 9, 12 }, 1, { { 0, 7, 12 } }, 0, 0.05f, 0.08f, 0.07f, 0, 0, 0.02f } },
};

int16_t *synth_music(const char *mood, size_t *n) {
    const Mood *md = NULL; for (unsigned i = 0; i < sizeof MOODS / sizeof *MOODS; i++) if (!strcmp(MOODS[i].name, mood)) md = &MOODS[i].m;
    if (!md) return NULL;
    float spb = 60.0f / md->bpm / 2; int steps = 8 * md->nch * (md->nch == 1 ? 2 : 1);
    Mix m; new_buf(spb * steps, &m, n, 1); seed = 4242 + (unsigned)md->bpm;
    int mel = 3;
    for (int k = 0; k < steps; k++) {
        int bar = k % 8; const int *chord = md->ch[(k / 8) % md->nch]; float T = k * spb;
        if (bar == 0) {
            for (int i = 0; i < 4 && (i < 3 || md->nch > 1 || 1); i++) {
                if (md->nch == 1 && i == 3) break;
                float f = mtof(md->root + chord[i] - (i == 0 ? 12 : 0)), vol = md->padVol / (1 + i * 0.25f), dur = spb * 8 + 1.6f;
                size_t s0 = (size_t)(T * SYN_RATE), len = (size_t)(dur * SYN_RATE); float ph = 0, lp = 0;
                for (size_t q = 0; q < len; q++) {
                    float t = (float)q / SYN_RATE, env = fminf(t / 1.4f, 1.0f) * (t > dur - 1.8f ? fmaxf(0, (dur - t) / 1.8f) : 1.0f);
                    ph += f / SYN_RATE; float w = wave(md->pad == 0 ? 0 : md->pad == 1 ? 1 : 2, ph);
                    lp += (w - lp) * 0.25f; add(&m, s0 + q, (md->pad == 2 ? lp : w) * vol * env);
                }
            }
            if (md->bass) tone(&m, 0, mtof(md->root + chord[0] - 12), 0, T, spb * 7.5f, md->padVol * 1.7f, 0.08f, 0.6f);
        }
        if (md->pulse && bar % 2 == 0) tone(&m, 0, 120, 40, T, 0.16f, 0.3f, 0.002f, 2);
        if (md->pulse && bar % 2 == 1) tone(&m, 2, mtof(md->root + chord[0] - 12), 0, T, spb * 0.9f, 0.028f, 0.01f, 1.5f);
        if (rnd() < md->pluck * (bar % 2 == 0 ? 1.0f : 0.55f)) {
            static const int ST[7] = { -2, -1, -1, 0, 1, 1, 2 }; mel += ST[(int)(rnd() * 7) % 7]; if (mel < 0) mel = 0; if (mel > md->nscale - 1) mel = md->nscale - 1;
            int semi = md->scale[mel]; if (rnd() < 0.35f) semi = chord[(int)(rnd() * 3.99f)] + 12;
            tone(&m, 0, mtof(md->root + 12 + semi), 0, T, 1.4f, md->pluckVol * (0.6f + rnd() * 0.5f), 0.004f, 3);
        }
        if (md->noiseVol > 0 && bar == 0) { noise(&m, T, spb * 8, md->noiseVol * 0.6f, 0.03f); }
    }
    return m.buf;
}
