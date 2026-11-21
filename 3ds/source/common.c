#include "plat.h"
#include <string.h>
#include <stdlib.h>
uint32_t col_hex(const char *s) {
    if (!s || s[0] != '#' || strlen(s) < 7) return RGB(220, 220, 230);
    unsigned v = (unsigned)strtoul(s + 1, NULL, 16);
    return RGB((v >> 16) & 255, (v >> 8) & 255, v & 255);
}
/* greedy word wrap on spaces; honours '\n'; breaks long words by character */
int text_wrap(float size, float maxw, const char *s, int *starts, int *ends, int maxlines) {
    int n = 0, len = (int)strlen(s), i = 0;
    char buf[1024];
    while (i <= len && n < maxlines) {
        int ls = i, last_sp = -1, j = i;
        for (; j < len && s[j] != '\n'; j++) {
            if (s[j] == ' ') last_sp = j;
            int cl = j - ls + 1; if (cl > 1000) cl = 1000;
            memcpy(buf, s + ls, cl); buf[cl] = 0;
            if (plat_text_w(size, buf) > maxw && j > ls) {
                if (last_sp > ls) { j = last_sp; } else { /* hard break; avoid splitting UTF-8 */ while (j > ls && ((unsigned char)s[j] & 0xC0) == 0x80) j--; }
                break;
            }
        }
        starts[n] = ls; ends[n] = j; n++;
        if (j >= len) break;
        i = (s[j] == ' ' || s[j] == '\n') ? j + 1 : j;
    }
    return n;
}
