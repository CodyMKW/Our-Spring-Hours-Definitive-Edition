#include "game.h"
#include "js.h"
#include <stdio.h>
void title_loop(void);

int main(int argc, char **argv) {
    if (!plat_init(argc, argv)) return 1;
    cfg_load(); plat_set_volume(cfg.music / 10.0f, cfg.sfx / 10.0f);
    if (!js_boot()) {
        while (ui_frame()) {
            plat_target(0); plat_rect(0, 0, 400, 240, RGB(40, 10, 20)); plat_text(200, 90, 22, RGB(255, 255, 255), T_CENTER, "Couldn't start the story");
            plat_text(200, 124, 14, RGB(255, 200, 200), T_CENTER, "romfs:/story.js is missing or broken.");
            plat_target(1); plat_rect(0, 0, 320, 240, RGB(30, 10, 16)); if (plat_input()->down & K_START) break;
        }
    } else title_loop();
    js_shutdown(); plat_exit(); return 0;
}
