/* Spike: boot QuickJS + story.js on the DS and report memory/time on the screen. */
#include <nds.h>
#include <nds/arm9/exceptions.h>
#include <filesystem.h>
#include <malloc.h>
#include <stdio.h>
#include <stdlib.h>
#include "js.h"
#include "plat.h"

bool plat_store_read(const char *n, char **d, size_t *l) { return false; }
bool plat_store_write(const char *n, const char *d, size_t l) { return false; }
void plat_store_remove(const char *n) {}
#include <stdarg.h>
volatile unsigned dbg[16]; char dbg_log[6000]; static int dbg_n;
void plat_log(const char *f, ...) { va_list a; va_start(a, f); if (dbg_n < 5800) dbg_n += vsnprintf(dbg_log + dbg_n, 5900 - dbg_n, f, a); va_end(a); if (dbg_n < 5900) dbg_log[dbg_n++] = '\n'; }
bool plat_asset_read(const char *name, char **data, size_t *len) {
    char p[64]; snprintf(p, 64, "nitro:/%s", name);
    FILE *f = fopen(p, "rb"); if (!f) return false;
    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
    *data = malloc(n + 1); if (!*data) { fclose(f); return false; }
    fread(*data, 1, n, f); (*data)[n] = 0; fclose(f); *len = n; return true;
}
static void mem(const char *tag) { struct mallinfo m = mallinfo(); dbg[4] = m.uordblks; printf("%s: used %dK\n", tag, m.uordblks / 1024); }
static u16 *fb;
static void crumb(int k, u16 c) { for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) fb[(y + 60) * 256 + k * 10 + x] = c | BIT(15); }
static void halt(u16 c) { if (fb) { for (int i = 0; i < 256 * 6; i++) fb[185 * 256 - i] = c | BIT(15); } while (1) swiWaitForVBlank(); }
void abort(void) { dbg[5]++; halt(RGB15(31, 0, 0)); __builtin_unreachable(); }
void exit(int code) { dbg[6] = code + 1; halt(RGB15(31, 0, 31)); __builtin_unreachable(); }
/* The ARM9 default stack is tiny (DTCM); QuickJS recurses deeply, so run everything on a big heap-allocated stack. */
#define BIGSTACK (320 * 1024)
static void app_main(void);
static void run_on_stack(void (*fn)(void), void *top) {
    asm volatile("mov r4, sp\n\tmov sp, %0\n\tblx %1\n\tmov sp, r4" :: "r"(top), "r"(fn) : "r4", "r0", "r1", "r2", "r3", "r12", "lr", "memory", "cc");
}
static void on_exc(void) { dbg[5] = 99; dbg[10] = exceptionRegisters[15]; dbg[11] = exceptionRegisters[14]; dbg[12] = exceptionRegisters[13]; dbg[13] = exceptionRegisters[0]; dbg[14] = exceptionRegisters[1]; dbg[15] = exceptionRegisters[12]; halt(RGB15(31, 0, 0)); }
int main(void) {
    setExceptionHandler(on_exc);
    char *stk = malloc(BIGSTACK); dbg[9] = stk ? 1 : 2;
    run_on_stack(app_main, stk + BIGSTACK - 64);
    return 0;
}
static void app_main(void) {
    videoSetMode(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG);
    fb = bgGetGfxPtr(bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0));
    for (int i = 0; i < 256 * 192; i++) fb[i] = RGB15(2, 2, 6) | BIT(15);
    dbg[0] = 1; crumb(0, RGB15(31, 31, 31));
    bool ok = nitroFSInit(NULL); dbg[1] = 10 + ok; crumb(1, ok ? RGB15(0, 31, 0) : RGB15(31, 0, 0));
    struct mallinfo m0 = mallinfo(); (void)m0;
    cpuStartTiming(0);
    { void *tp = malloc(5000); plat_log("m%x", (unsigned)tp); void *tq = realloc(NULL, 4000); plat_log("m%x", (unsigned)tq); }
    dbg[7] = 1; REG_IME = 0; bool b = js_boot(); REG_IME = 1; u32 t = cpuEndTiming(); dbg[2] = 10 + b; dbg[3] = t; crumb(2, b ? RGB15(0, 31, 0) : RGB15(31, 0, 0));
    /* boot time in 1/10 s as a bar of blocks, memory used in 100K units as blocks on row 2 */
    int tenths = t / 3351400; for (int i = 0; i < tenths && i < 25; i++) crumb(3 + i, RGB15(31, 20, 0));
    struct mallinfo m = mallinfo(); dbg[4] = m.uordblks; int used = m.uordblks / 102400; for (int i = 0; i < used && i < 25; i++) { for (int y = 12; y < 20; y++) for (int x = 0; x < 8; x++) fb[(y + 60) * 256 + i * 10 + x] = RGB15(0, 20, 31) | BIT(15); }
    char *r = js_str("Flat.events().length + ':' + Flat.title().length"); crumb(1, r[0] ? RGB15(0, 31, 31) : RGB15(31, 0, 31));
    int n = 0; for (char *q = r; *q && n < 30; q++, n++) { for (int y = 24; y < 32; y++) for (int x = 0; x < 8; x++) fb[(y + 60) * 256 + n * 9 + x] = ((*q * 7) & 31) << 5 | BIT(15); }
    dbg[8] = 1; while (1) swiWaitForVBlank();
}
