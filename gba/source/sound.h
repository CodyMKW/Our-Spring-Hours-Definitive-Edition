#pragma once
#include "gba.h"
enum { SFX_CHOICE, SFX_DROP, SFX_MERGE, SFX_BLOOM, SFX_ABILITY, SFX_OVER, SFX_CHAPTER, SFX_WARN, SFX_HIT, SFX_TICK };
void snd_init(void);
void snd_tick(void);                    /* call once per frame */
void snd_music(int mood);               /* MOOD_ id, or 0xFF for silence; no-op if already playing */
void snd_sfx(int id, int arg);          /* arg: e.g. tier for SFX_MERGE */
