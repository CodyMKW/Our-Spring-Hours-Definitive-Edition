/* story_fn.c — C ports of every JS function in js/story/*.js (see gba/build/story_fn.txt for the originals).
   fn ids follow compile_story.js numbering; fn_hash.txt guards against the story drifting from this file. */
#include "story.h"
#include "story_fn_lits.h"

#define FL(k) (s->flags[F_##k])
#define IS(k, v) (s->flags[F_##k] == V_##v)
#define ST(k) (s->stats[ST_##k])
#define DEAD(c) ((s->dead >> (c)) & 1)
#define ALIVE(c) (!DEAD(c))
static const u8 CAST[5] = { CH_joseph, CH_cementoss, CH_falcon, CH_maki, CH_uraraka };
static const char *const NAME[N_CH] = { "Cody", "Joseph", "Falcon", "Cementoss", "Uraraka", "Light Yagami", "Maki", "Tomura Shigaraki", "All For One" };
static const u8 ENDIDX[N_ENDS] = { 0 };

int story_dead_count(const VNState *s) { int n = 0; for (int i = 0; i < N_CH; i++) n += (s->dead >> i) & 1; return n; }
static int lostn(const VNState *s) { int n = 0; for (int i = 0; i < 5; i++) n += DEAD(CAST[i]); return n; }
static char *cat(char *d, const char *t) { while (*t) *d++ = *t++; *d = 0; return d; }
static char *num(char *d, int v) { char t[12]; int n = 0; if (v < 0) { *d++ = '-'; v = -v; } do { t[n++] = '0' + v % 10; v /= 10; } while (v); while (n) *d++ = t[--n]; *d = 0; return d; }
static char *lostnames(char *d, const VNState *s, const char *sep) { int first = 1; for (int i = 0; i < 5; i++) if (DEAD(CAST[i])) { if (!first) d = cat(d, sep); d = cat(d, NAME[CAST[i]]); first = 0; } return d; }
static int endidx(const char *name);

/* ending ids (index into story_ends) of the ones Part I/II code compares against */
static int h1is(const VNState *s, int endlbl_index) { return s->hist[0] == endlbl_index; }
extern const u16 story_ends_labels_unused;
#define EIDX(n) L_##n

static u16 resolve1(const VNState *s) {
    int ura = ST(URA), fri = ST(FRI), fal = ST(FAL);
    if (IS(p1route, alone) || (s->aloof >= 4 && ura < 4 && fri < 4 && fal < 4)) return LBL_ending_lonely;
    if (FL(confessed) && ura >= 8 && fri >= 6 && fal >= 3) return LBL_ending_true;
    if (FL(confessed) && ura >= fri && ura >= fal) return LBL_ending_romance;
    if (FL(falconSincere) && fal >= 6) return LBL_ending_falcon;
    return LBL_ending_friends;
}
static u16 resolve2(const VNState *s) {
    int ura = ST(URA), fri = ST(FRI), fal = ST(FAL), maki = ST(MAKI), light = ST(LIGHT);
    if (s->aloof >= 5 || (fri < 4 && ura < 4 && fal < 4 && maki < 3)) return LBL_end_longdark;
    if (IS(p2path, light)) return LBL_end_staticledger;
    if (IS(p2path, quiet)) return LBL_end_embers;
    if (IS(p2path, unity) && FL(confessed) && fri >= 9 && ura >= 7 && maki >= 4 && light <= 5) return LBL_end_inheritance;
    return LBL_end_ashfalldawn;
}
static u16 resolve3(const VNState *s) {
    int ura = ST(URA), fri = ST(FRI), fal = ST(FAL), D = story_dead_count(s);
    if (FL(optedOut)) return LBL_end_quietlife;
    if (s->aloof >= 6) return LBL_end_isolation;
    if (IS(lightPath, weaponized) && ST(LIGHT) >= 7) return LBL_end_shadowalliance;
    if (IS(lightPath, renounced) && D == 0) return LBL_end_redemption;
    if (D == 0 && fri >= 6 && (ura >= 5 || fal >= 5)) return LBL_end_dawnunity;
    if (D >= 3) return LBL_end_pyrrhic;
    return LBL_end_costlyvictory;
}

int fn_cond(u16 id, const VNState *s) {
    switch (id) {
    case 3: return IS(askedCementoss, ura);
    case 4: return FL(helpedPapers) != 0;
    case 5: return IS(wishWho, falcon);
    case 8: return s->hist[0] == L_ending_falcon;
    case 14: return IS(lightPath, pending_renounce);
    case 15: return !IS(lightPath, renounced);
    case 16: return ST(MAKI) >= 5;
    case 17: return ST(MAKI) >= 7;
    case 18: return ST(MAKI) >= 8;
    case 19: return DEAD(CH_maki);
    case 20: return ST(FAL) >= 4;
    case 21: return ST(FRI) >= 6 || ST(FAL) >= 7;
    case 22: return ST(FAL) >= 7;
    case 24: return ST(FRI) >= 9;
    case 25: return !DEAD(CH_joseph) && FL(sparedShigaraki);
    case 28: return FL(foundNote) != 0;
    case 30: return ST(FRI) >= 7;
    case 31: return ST(FRI) >= 10;
    case 32: return ST(URA) >= 7;
    case 33: return ST(URA) >= 9;
    case 34: return !DEAD(CH_falcon) && !DEAD(CH_maki);
    case 37: return IS(lightPath, weaponized);
    case 38: return ST(FRI) >= 8;
    case 40: return ALIVE(CH_falcon) && IS(nightWatch, fal);
    case 43: return ALIVE(CH_falcon);
    case 45: return ALIVE(CH_maki);
    case 46: return ALIVE(CH_cementoss);
    case 48: return !ALIVE(CH_joseph);
    case 49: return ALIVE(CH_maki) && ALIVE(CH_light);
    case 50: return FL(sparedShigaraki) != 0;
    case 51: return IS(lightPath, renounced);
    case 52: return !ALIVE(CH_cementoss);
    case 53: return !ALIVE(CH_maki);
    case 54: return !ALIVE(CH_uraraka);
    case 56: return !ALIVE(CH_falcon);
    case 59: return lostn(s) == 0;
    case 60: return IS(bonusBring, switch);
    }
    return 0;
}

u16 fn_route(u16 id, VNState *s) {
    switch (id) {
    case 0: return IS(partner, uraraka) ? LBL_p1_partner_uraraka : IS(partner, falcon) ? LBL_p1_partner_falcon : LBL_p1_partner_friends;
    case 1: {
        int ura = ST(URA), fri = ST(FRI), fal = ST(FAL);
        if (s->aloof >= 4 && ura < 4 && fri < 4 && fal < 4) return LBL_p1_night_alone;
        int u = ura + (IS(partner, uraraka) ? 1 : 0) + (IS(wishWho, uraraka) ? 1 : 0);
        int a = fal + (IS(partner, falcon) ? 1 : 0) + (IS(wishWho, falcon) ? 1 : 0);
        int r = fri + (IS(partner, friends) ? 1 : 0) + (IS(wishWho, friends) ? 1 : 0);
        if (u >= a && u >= r) return LBL_p1_night_ura;
        if (a >= r) return LBL_p1_night_fal;
        return LBL_p1_night_fri;
    }
    case 2: return resolve1(s);
    case 11: return resolve2(s);
    case 29: return LBL_p3_final;
    case 39: return resolve3(s);
    case 58:
        if (FL(optedOut) || s->aloof >= 6) return LBL_p4_close_lone;
        if (ALIVE(CH_uraraka) && (FL(confessed) || ST(URA) >= ST(FAL))) return LBL_p4_close_ura;
        if (ALIVE(CH_falcon)) return LBL_p4_close_fal;
        return LBL_p4_close_group;
    case 66: {
        int total = FL(petals) + 30; for (int i = 0; i < 5; i++) total += ALIVE(CAST[i]) ? 8 : 0;
        s->flags[F_petalTotal] = total > 255 ? 255 : total;
        return total >= 100 ? LBL_ending_hundredth : total >= 70 ? LBL_ending_almost : LBL_ending_quiet_spring;
    }
    }
    return 0;
}

const char *fn_text(u16 id, VNState *s, char *buf) {
    char *d = buf;
    switch (id) {
    case 6: return RECAP[s->hist[0] == L_ending_romance || s->hist[0] == L_ending_true ? 0 : s->hist[0] == L_ending_falcon ? 1 : s->hist[0] == L_ending_friends ? 2 : s->hist[0] == L_ending_lonely ? 3 : 4][0];
    case 7: return RECAP[s->hist[0] == L_ending_romance || s->hist[0] == L_ending_true ? 0 : s->hist[0] == L_ending_falcon ? 1 : s->hist[0] == L_ending_friends ? 2 : s->hist[0] == L_ending_lonely ? 3 : 4][1];
    case 9: return URARETURN[s->hist[0] == L_ending_romance || s->hist[0] == L_ending_true ? 0 : s->hist[0] == L_ending_falcon ? 1 : s->hist[0] == L_ending_friends ? 2 : s->hist[0] == L_ending_lonely ? 3 : 4][0];
    case 10: return URARETURN[s->hist[0] == L_ending_romance || s->hist[0] == L_ending_true ? 0 : s->hist[0] == L_ending_falcon ? 1 : s->hist[0] == L_ending_friends ? 2 : s->hist[0] == L_ending_lonely ? 3 : 4][1];
    case 12: return FL(reunited) ? T12_0 : T12_1;
    case 13: return IS(lightStance, allied) ? T13_1 : IS(lightStance, defied) ? T13_3 : T13_4;
    case 23: return DEAD(CH_falcon) ? T23_1 : T23_2;
    case 26: return DEAD(CH_joseph) ? T26_1 : T26_2;
    case 27: return DEAD(CH_uraraka) ? T27_1 : FL(reunited) ? T27_2 : T27_3;
    case 35: return story_dead_count(s) ? T35_0 : T35_1;
    case 36: return IS(lightPath, weaponized) ? T36_1 : T36_2;
    case 41: return ALIVE(CH_uraraka) ? T41_1 : T41_2;
    case 42: return ALIVE(CH_falcon) ? T42_1 : T42_2;
    case 44: return ALIVE(CH_uraraka) ? T44_1 : T44_2;
    case 47: return ALIVE(CH_joseph) ? T47_1 : T47_2;
    case 55: d = cat(d, T55_0); d = lostnames(d, s, T55_1); cat(d, T55_2); return buf;
    case 57: return lostn(s) ? T57_0 : T57_1;
    case 61: return ALIVE(CH_joseph) ? T61_1 : T61_2;
    case 62: return lostn(s) ? T62_0 : T62_1;
    case 63: return ALIVE(CH_cementoss) ? T63_1 : T63_2;
    case 64: return ALIVE(CH_joseph) ? T64_1 : T64_2;
    case 65: { int total = FL(petals) + 30; for (int i = 0; i < 5; i++) total += ALIVE(CAST[i]) ? 8 : 0; d = cat(d, T65_0); d = num(d, total); cat(d, T65_1); return buf; }
    case 67: {
        if (!lostn(s)) return "Nobody is missing from the line.";
        d = cat(d, "You carry "); d = lostnames(d, s, ", "); cat(d, lostn(s) == 1 ? " with you now." : " with you now, all of them."); return buf;
    }
    case 68: d = cat(d, T68_0); d = num(d, FL(petalTotal)); cat(d, T68_1); return buf;
    case 69:
        if (lostn(s)) { d = cat(d, T69_0); d = lostnames(d, s, T69_1); cat(d, T69_2); return buf; }
        return T69_3;
    case 70: d = cat(d, T70_0); d = num(d, FL(petalTotal)); cat(d, T70_1); return buf;
    case 71: d = cat(d, T71_0); d = num(d, FL(petalTotal)); cat(d, T71_1); return buf;
    }
    return "";
}

/* Part III ending cast list */
const char *story_cast_line(const VNState *s, int idx, int *ok) {
    if (idx < 5) { *ok = ALIVE(CAST[idx]); return NAME[CAST[idx]]; }
    *ok = 1; return "Light Yagami";
}
