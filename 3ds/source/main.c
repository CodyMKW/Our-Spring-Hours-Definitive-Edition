#include "game.h"
#include "js.h"
#include <stdio.h>
void title_loop(void);
#ifdef __3DS__
unsigned int __stacksize__ = 0x100000;   /* QuickJS recurses; the default 32 KB main-thread stack is too small */
#endif

int main(int argc, char **argv) {
    if (!plat_init(argc, argv)) return 1;
    cfg_load();
    if (plat_frame_begin()) {   /* the story takes a moment to compile on real hardware: say so */
        plat_target(0); plat_rect_grad(0, 0, 400, 240, RGB(255, 226, 236), RGB(255, 190, 210)); plat_text(200, 96, 26, RGB(120, 50, 90), T_CENTER, "Our Spring Hours");
        plat_text(200, 134, 15, RGB(150, 80, 110), T_CENTER, "Loading the story...");
        plat_target(1); plat_rect(0, 0, 320, 240, RGB(62, 34, 74)); plat_frame_end();
    } plat_set_volume(cfg.music / 10.0f, cfg.sfx / 10.0f);
    if (!js_boot()) {
        while (ui_frame()) {
            plat_target(0); plat_rect(0, 0, 400, 240, RGB(40, 10, 20)); plat_text(200, 90, 22, RGB(255, 255, 255), T_CENTER, "Couldn't start the story");
            plat_text(200, 124, 14, RGB(255, 200, 200), T_CENTER, "romfs:/story.js is missing or broken.");
            plat_target(1); plat_rect(0, 0, 320, 240, RGB(30, 10, 16)); if (plat_input()->down & K_START) break;
        }
    } else title_loop();
    js_shutdown(); plat_exit(); return 0;
}
