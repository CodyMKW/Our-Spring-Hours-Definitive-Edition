#include <nds.h>
#include <stdio.h>
int main(void) {
    videoSetMode(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG);
    int bg = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    u16 *fb = bgGetGfxPtr(bg);
    for (int y = 0; y < 192; y++) for (int x = 0; x < 256; x++) fb[y * 256 + x] = RGB15(x >> 3, y >> 3, 20) | BIT(15);
    u32 f = 0;
    while (1) { swiWaitForVBlank(); f++; fb[f % 256 + 96 * 256] = RGB15(31, 31, 31) | BIT(15); }
}
