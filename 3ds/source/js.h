#ifndef JS_H
#define JS_H
#include <stdbool.h>
bool js_boot(void);                         /* start QuickJS, load romfs story.js, Rt.init() */
void js_shutdown(void);
char *js_str(const char *expr);             /* evaluate an expression, return its string value (malloc'd, "" on error) */
int js_int(const char *expr);
void js_run(const char *expr);              /* evaluate, ignore result */
/* splitting helpers for the Flat.* record format */
int split(char *s, char sep, char **out, int max);   /* in-place split, returns count (empty string => 0 items) */
#endif
