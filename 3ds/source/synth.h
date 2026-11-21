/* synth.h — procedural audio, no files. Mono signed 16-bit PCM at SYN_RATE Hz. A C port of the web version's
 * Web-Audio score (js/audio.js MOODS) and sound effects. Platform independent; plat_3ds.c plays the buffers. */
#ifndef SYNTH_H
#define SYNTH_H
#include <stdint.h>
#include <stddef.h>
#define SYN_RATE 16000
int16_t *synth_sfx(const char *name, size_t *samples);            /* malloc'd, NULL if the name is unknown */
int16_t *synth_music(const char *mood, size_t *samples);          /* malloc'd seamless loop, NULL if unknown mood */
#endif
