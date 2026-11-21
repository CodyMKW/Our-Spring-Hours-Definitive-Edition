/* Spike: boot QuickJS + story.js on the DS and report memory/time on the screen. */
#include <nds.h>
#include <filesystem.h>
#include <malloc.h>
#include <stdio.h>
#include <stdlib.h>
#include "js.h"
#include "plat.h"

bool plat_store_read(const char *n, char **d, size_t *l) { return false; }
bool plat_store_write(const char *n, const char *d, size_t l) { return false; }
void plat_store_remove(const char *n) {}
void plat_log(const char *f, ...) { }
bool plat_asset_read(const char *name, char **data, size_t *len) {
    char p[64]; snprintf(p, 64, "nitro:/%s", name);
    FILE *f = fopen(p, "rb"); if (!f) return false;
    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
    *data = malloc(n + 1); if (!*data) { fclose(f); return false; }
    fread(*data, 1, n, f); (*data)[n] = 0; fclose(f); *len = n; return true;
}
static void mem(const char *tag) { struct mallinfo m = mallinfo(); printf("%s: used %dK\n", tag, m.uordblks / 1024); }
int main(void) {
    consoleDemoInit();
    bool ok = nitroFSInit(NULL); printf("nitroFS %d\n", ok); mem("start");
    timerStart(0, ClockDivider_1024, 0, NULL); timerStart(1, ClockDivider_1024, 0, NULL);
    printf("booting...\n"); cpuStartTiming(0);
    bool b = js_boot(); u32 t = cpuEndTiming(); printf("js_boot=%d %lu ms\n", b, (unsigned long)(t / 33514));
    mem("after boot");
    char *s = js_str("typeof Flat + ':' + (Flat.title ? Flat.title().length : -1)"); printf("flat: %s\n", s);
    cpuStartTiming(0); s = js_str("Flat.events().length"); t = cpuEndTiming(); printf("events: %s (%lu ms)\n", s, (unsigned long)(t / 33514));
    mem("end");
    while (1) swiWaitForVBlank();
}
