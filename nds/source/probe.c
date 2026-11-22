/* Liveness probes: which of our startup steps makes the emulator power the console off? (built only with -DPROBE=n) */
#ifdef PROBE_ONLY
#include <nds.h>
#include <nds/arm9/exceptions.h>
#include <stdlib.h>
volatile unsigned pdbg[8];
static void busy(void) { for (volatile unsigned i = 0; i < 40000000u; i++) { if ((i & 0xFFFFF) == 0) pdbg[3] = i >> 20; } pdbg[2] = 77; }
static void run_on_stack(void (*fn)(void), void *top) {
    asm volatile("mov r4, sp\n\tmov sp, %0\n\tblx %1\n\tmov sp, r4" :: "r"(top), "r"(fn) : "r4", "r0", "r1", "r2", "r3", "r12", "lr", "memory", "cc");
}
static void exc(void) { pdbg[5] = 99; while (1) swiWaitForVBlank(); }
int main(void) {
    pdbg[0] = 1;
#if PROBE == 1
    busy();                                  /* nothing else */
#elif PROBE == 2
    char *stk = malloc(320 * 1024); pdbg[1] = stk ? 1 : 2;
    run_on_stack(busy, stk + 320 * 1024 - 64);
#elif PROBE == 3
    setExceptionHandler(exc); busy();
#elif PROBE == 4
    pdbg[1] = 5; nitroFSInit(NULL); busy();
#endif
    pdbg[4] = 1;
    while (1) swiWaitForVBlank();
}

#endif
