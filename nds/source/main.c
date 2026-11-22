/* main.c — DS entry point (same flow as 3ds/source/main.c; QuickJS needs a big stack, so everything runs on a heap-allocated one). */
#include <nds.h>
#include <stdlib.h>
#include "game.h"
#include "js.h"
void title_loop(void);
extern volatile unsigned dbg[16];

#define BIGSTACK (320 * 1024)
static void app(void) {
    if (!plat_init(0, NULL)) { while (1) swiWaitForVBlank(); }
    cfg_load();
    if (plat_frame_begin()) {
        plat_target(0); plat_rect_grad(0, 0, 400, 240, RGB(255, 226, 236), RGB(255, 190, 210)); plat_text(200, 96, 26, RGB(120, 50, 90), T_CENTER, "Our Spring Hours");
        plat_text(200, 134, 15, RGB(150, 80, 110), T_CENTER, "Loading the story...");
        plat_target(1); plat_rect(0, 0, 320, 240, RGB(62, 34, 74)); plat_frame_end();
    }
    plat_set_volume(cfg.music / 10.0f, cfg.sfx / 10.0f);
    if (!js_boot()) {
        while (ui_frame()) {
            plat_target(0); plat_rect(0, 0, 400, 240, RGB(40, 10, 20)); plat_text(200, 90, 22, RGB(255, 255, 255), T_CENTER, "Couldn't start the story");
            plat_target(1); plat_rect(0, 0, 320, 240, RGB(30, 10, 16));
        }
    } else { dbg[8] = 1; title_loop(); }
    js_shutdown(); plat_exit();
}
static void run_on_stack(void (*fn)(void), void *top) {
    asm volatile("mov r4, sp\n\tmov sp, %0\n\tblx %1\n\tmov sp, r4" :: "r"(top), "r"(fn) : "r4", "r0", "r1", "r2", "r3", "r12", "lr", "memory", "cc");
}
int main(void) {
    char *stk = malloc(BIGSTACK);
    run_on_stack(app, stk + BIGSTACK - 64);
    return 0;
}
