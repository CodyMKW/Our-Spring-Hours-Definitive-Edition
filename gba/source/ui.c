#include "ui.h"
#include "sound.h"
int ui_bg_current = -1;
int ui_list_backdrop = -1;

void ui_frame_end(void) { vsync(); snd_tick(); input_poll(); weather_step(); fx_step(); }
void ui_fade(int out) {
    if (out) { REG_BLDCNT = 0x80 | 0x3F; for (int i = 0; i <= 16; i += 2) { REG_BLDY = i; vsync(); } gfx_faded = 1; }
}
void ui_show_bg(int bg) {
    if (ui_bg_current >= 0 && bg != ui_bg_current) ui_fade(1);
    bg_load(bg); ui_bg_current = bg;
}
void ui_message(const char *a, const char *b) {
    obj_enable(0); fb_fill(0, 0, W, H, RAMP(RAMP_DARK_WHITE));
    text_center(120, 60, a, RAMP_DARK_GOLD); text_center(120, 76, b, RAMP_DARK_WHITE); text_center(120, 140, "A: ok", RAMP_DARK_WHITE);
    vsync(); fb_flush(0, H);
    for (;;) { ui_frame_end(); if (keys_down & (KEY_A | KEY_B)) return; }
}
int ui_list(const char *title, const char *const *items, int n, int sel, int allow_back) {
    int top = 0, vis = ui_list_backdrop >= 0 ? 6 : 11, y0 = ui_list_backdrop >= 0 ? 78 : 22, dirty = 1;
    obj_enable(0);
    for (;;) {
        if (sel < top) top = sel; if (sel >= top + vis) top = sel - vis + 1;
        if (dirty) {
            if (ui_list_backdrop >= 0) {
                ui_show_bg(ui_list_backdrop);
                fb_fill(0, 70, W, H - 70, RAMP(RAMP_DARK_WHITE)); fb_fill(0, 70, W, 1, COL_ACCENT);
            } else { fb_fill(0, 0, W, H, RAMP(RAMP_DARK_WHITE)); fb_fill(0, 0, W, 1, COL_ACCENT); text_draw(8, 6, title, RAMP_DARK_GOLD, W); }
            for (int i = 0; i < vis && top + i < n; i++) {
                int y = y0 + i * 13, on = top + i == sel;
                if (on) fb_fill(4, y - 1, W - 8, 12, RAMP(RAMP_SEL));
                text_draw(10, y, items[top + i], on ? RAMP_SEL : RAMP_DARK_WHITE, W);
            }
            if (top > 0) text_draw(228, y0 - 10, "^", RAMP_DARK_GOLD, W);
            if (top + vis < n) text_draw(228, 150, "v", RAMP_DARK_GOLD, W);
            text_draw(8, 150, allow_back ? "A: ok   B: back" : "A: ok", RAMP_DARK_WHITE, W);
            if (ui_list_backdrop >= 0) { fb_fill(0, 8, W, 30, RAMP(RAMP_DARK_WHITE)); fb_fill(0, 8, W, 1, COL_ACCENT); fb_fill(0, 37, W, 1, COL_ACCENT); text_draw2x(120, 14, "Our Spring Hours", RAMP_DARK_GOLD); }
            fb_flush(0, H); dirty = 0;
        }
        ui_frame_end();
        if (keys_down & KEY_UP) { sel = (sel + n - 1) % n; dirty = 1; }
        if (keys_down & KEY_DOWN) { sel = (sel + 1) % n; dirty = 1; }
        if (keys_down & KEY_A) return sel;
        if ((keys_down & KEY_B) && allow_back) return -1;
    }
}
