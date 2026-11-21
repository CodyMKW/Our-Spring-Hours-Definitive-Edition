/* js.c — QuickJS host. The story (story.js) expects a tiny "browser": localStorage is routed to plat_store_*. */
#include "js.h"
#include "plat.h"
#include "quickjs.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static JSRuntime *rt;
static JSContext *ctx;

static void keyname(const char *k, char *out, size_t n) {   /* "osh-de:slot:3" -> "osh-de_slot_3.json" */
    size_t j = 0;
    for (; *k && j + 6 < n; k++) out[j++] = (*k == ':' || *k == '/' || *k == '\\') ? '_' : *k;
    strcpy(out + j, ".json");
}
static JSValue n_get(JSContext *c, JSValueConst t, int argc, JSValueConst *argv) {
    const char *k = JS_ToCString(c, argv[0]); if (!k) return JS_UNDEFINED;
    char nm[160]; keyname(k, nm, sizeof nm); JS_FreeCString(c, k);
    char *d; size_t len;
    if (!plat_store_read(nm, &d, &len)) return JS_UNDEFINED;
    JSValue v = JS_NewStringLen(c, d, len); free(d); return v;
}
static JSValue n_set(JSContext *c, JSValueConst t, int argc, JSValueConst *argv) {
    const char *k = JS_ToCString(c, argv[0]); const char *v = JS_ToCString(c, argv[1]);
    if (k && v) { char nm[160]; keyname(k, nm, sizeof nm); plat_store_write(nm, v, strlen(v)); }
    if (k) JS_FreeCString(c, k); if (v) JS_FreeCString(c, v);
    return JS_UNDEFINED;
}
static JSValue n_del(JSContext *c, JSValueConst t, int argc, JSValueConst *argv) {
    const char *k = JS_ToCString(c, argv[0]);
    if (k) { char nm[160]; keyname(k, nm, sizeof nm); plat_store_remove(nm); JS_FreeCString(c, k); }
    return JS_UNDEFINED;
}
static JSValue n_log(JSContext *c, JSValueConst t, int argc, JSValueConst *argv) {
    const char *s = JS_ToCString(c, argv[0]); if (s) { plat_log("[js] %s", s); JS_FreeCString(c, s); } return JS_UNDEFINED;
}

static void report(void) {
    JSValue ex = JS_GetException(ctx); const char *s = JS_ToCString(ctx, ex);
    plat_log("JS error: %s", s ? s : "?");
    if (s) JS_FreeCString(ctx, s);
    JSValue st = JS_GetPropertyStr(ctx, ex, "stack");
    if (!JS_IsUndefined(st)) { const char *q = JS_ToCString(ctx, st); if (q) { plat_log("%s", q); JS_FreeCString(ctx, q); } }
    JS_FreeValue(ctx, st); JS_FreeValue(ctx, ex);
}

bool js_boot(void) {
    plat_log("js: new runtime"); rt = JS_NewRuntime(); if (!rt) return false; plat_log("js: runtime ok");
    JS_SetMemoryLimit(rt, 28u << 20); 
#ifdef OSH_DS
    JS_SetMaxStackSize(rt, 256 * 1024);
#else
    JS_SetMaxStackSize(rt, 512 * 1024);
#endif

    ctx = JS_NewContext(rt); if (!ctx) return false; plat_log("js: context ok");
    JSValue g = JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx, g, "__store_get", JS_NewCFunction(ctx, n_get, "__store_get", 1));
    JS_SetPropertyStr(ctx, g, "__store_set", JS_NewCFunction(ctx, n_set, "__store_set", 2));
    JS_SetPropertyStr(ctx, g, "__store_del", JS_NewCFunction(ctx, n_del, "__store_del", 1));
    JS_SetPropertyStr(ctx, g, "__log", JS_NewCFunction(ctx, n_log, "__log", 1));
    JS_FreeValue(ctx, g);
    char *src; size_t len;
    if (!plat_asset_read("story.js", &src, &len)) { plat_log("story.js missing"); return false; }
    plat_log("js: story read %d", (int)len); JSValue r = JS_Eval(ctx, src, len, "story.js", JS_EVAL_TYPE_GLOBAL); plat_log("js: eval done");
    free(src);
    if (JS_IsException(r)) { report(); return false; }
    JS_FreeValue(ctx, r);
    js_run("Rt.init()");
    return true;
}
void js_shutdown(void) { if (ctx) JS_FreeContext(ctx); if (rt) JS_FreeRuntime(rt); ctx = NULL; rt = NULL; }

char *js_str(const char *expr) {
    JSValue r = JS_Eval(ctx, expr, strlen(expr), "<host>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(r)) { report(); return strdup(""); }
    const char *s = JS_ToCString(ctx, r); char *out = strdup(s ? s : "");
    if (s) JS_FreeCString(ctx, s);
    JS_FreeValue(ctx, r);
    return out;
}
int js_int(const char *expr) { char *s = js_str(expr); int v = atoi(s); free(s); return v; }
void js_run(const char *expr) { free(js_str(expr)); }

int split(char *s, char sep, char **out, int max) {
    if (!*s) return 0;
    int n = 0; out[n++] = s;
    for (; *s; s++) if (*s == sep && n < max) { *s = 0; out[n++] = s + 1; }
    return n;
}
