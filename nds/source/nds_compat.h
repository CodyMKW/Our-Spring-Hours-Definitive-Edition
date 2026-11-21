/* Force-included into every file: newlib for the (FPU-less) ARM9 doesn't define every <fenv.h> rounding mode QuickJS references. */
#include <fenv.h>
#ifndef FE_DOWNWARD
#define FE_DOWNWARD 0x400
#endif
#ifndef FE_UPWARD
#define FE_UPWARD 0x800
#endif
#ifndef FE_TONEAREST
#define FE_TONEAREST 0
#endif
