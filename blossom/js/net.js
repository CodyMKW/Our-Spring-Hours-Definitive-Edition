/* ============================================================================
   net.js — tiny two-player link used by Blossom Drop Versus (multiplayer.html).

   BD.Net.host()        -> Link   (emits "ready" with the room code)
   BD.Net.join(code)    -> Link   (emits "open" once connected)

   Link API
     link.on(event, fn)    events: "ready"(code) "open" "msg"(obj) "close" "error"(text)
     link.send(obj)        obj must be plain JSON
     link.close()
     link.code             the 5-letter room code
     link.kind             "peerjs" | "local"

   Transport: PeerJS (WebRTC data channel, brokered by the free public PeerJS
   cloud server — no server of ours). Peer ids are "bdrop-" + CODE.
   Add ?net=local to the page URL to use a BroadcastChannel instead — that links
   two tabs of the same browser with no network and is what the tests use.
   ========================================================================== */
(function (BD) {
  "use strict";
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";        // no I/O so codes are easy to read aloud
  const newCode = () => { let s = ""; for (let i = 0; i < 5; i++) s += ALPHA[(Math.random() * ALPHA.length) | 0]; return s; };
  const clean = (c) => String(c || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);

  class Link {
    constructor(kind) { this.kind = kind; this.h = {}; this.code = ""; this.isOpen = false; }
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return this; }
    emit(ev, a) { (this.h[ev] || []).slice().forEach(fn => { try { fn(a); } catch (e) { console.error(e); } }); }
  }

  /* ------------------------------------------------------------ PeerJS */
  class PeerLink extends Link {
    constructor() { super("peerjs"); this.peer = null; this.conn = null; }
    host(tries) {
      tries = tries || 0; this.code = newCode();
      try { this.peer = new window.Peer("bdrop-" + this.code, { debug: 0 }); } catch (e) { setTimeout(() => this.emit("error", "PeerJS failed to start."), 0); return this; }
      this.peer.on("open", () => this.emit("ready", this.code));
      this.peer.on("connection", (c) => { if (this.conn) { try { c.close(); } catch (e) { /* ignore */ } return; } this.attach(c); });
      this.peer.on("error", (e) => {
        if (e.type === "unavailable-id" && tries < 6) { try { this.peer.destroy(); } catch (er) { /* ignore */ } this.host(tries + 1); return; }
        this.emit("error", friendly(e));
      });
      this.peer.on("disconnected", () => { try { this.peer.reconnect(); } catch (e) { /* ignore */ } });
      return this;
    }
    join(code) {
      this.code = clean(code);
      try { this.peer = new window.Peer({ debug: 0 }); } catch (e) { setTimeout(() => this.emit("error", "PeerJS failed to start."), 0); return this; }
      this.peer.on("open", () => {
        const c = this.peer.connect("bdrop-" + this.code, { reliable: true, serialization: "json" });
        this.attach(c);
        this.timer = setTimeout(() => { if (!this.isOpen) this.emit("error", "Couldn't reach that room. Check the code, or ask your friend to create it again."); }, 14000);
      });
      this.peer.on("error", (e) => this.emit("error", friendly(e)));
      return this;
    }
    attach(c) {
      this.conn = c;
      c.on("open", () => { clearTimeout(this.timer); this.isOpen = true; this.emit("open"); });
      c.on("data", (d) => this.emit("msg", d));
      c.on("close", () => { this.isOpen = false; this.emit("close"); });
      c.on("error", (e) => this.emit("error", friendly(e)));
    }
    send(o) { if (this.conn && this.isOpen) { try { this.conn.send(o); } catch (e) { /* dropped */ } } }
    close() { try { this.conn && this.conn.close(); } catch (e) { /* ignore */ } try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ } this.isOpen = false; }
  }
  function friendly(e) {
    const t = e && e.type;
    if (t === "peer-unavailable") return "No room with that code. Check the letters and try again.";
    if (t === "network" || t === "server-error" || t === "socket-error" || t === "socket-closed") return "Couldn't reach the matchmaking server. Check your connection and try again.";
    if (t === "browser-incompatible") return "This browser doesn't support peer-to-peer connections.";
    return "Connection problem" + (t ? " (" + t + ")" : "") + ".";
  }

  /* ------------------------------------------------------------ local (BroadcastChannel) */
  class LocalLink extends Link {
    constructor() { super("local"); this.id = Math.random().toString(36).slice(2); this.role = ""; this.ch = null; }
    open(code, role) {
      this.code = code; this.role = role; this.ch = new BroadcastChannel("bdrop-local-" + code);
      this.ch.onmessage = (e) => {
        const m = e.data; if (!m || m.from === this.id) return;
        if (m.k === "hello" && this.role === "host" && !this.isOpen) { this.isOpen = true; this.peerId = m.from; this.ch.postMessage({ k: "welcome", from: this.id, to: m.from }); this.emit("open"); }
        else if (m.k === "welcome" && this.role === "guest" && m.to === this.id) { this.isOpen = true; this.peerId = m.from; this.emit("open"); }
        else if (m.k === "msg" && this.isOpen && m.from === this.peerId) this.emit("msg", m.d);
        else if (m.k === "bye" && m.from === this.peerId) { this.isOpen = false; this.emit("close"); }
      };
    }
    host() { const c = newCode(); this.open(c, "host"); setTimeout(() => this.emit("ready", c), 0); return this; }
    join(code) { this.open(clean(code), "guest"); this.ch.postMessage({ k: "hello", from: this.id }); setTimeout(() => { if (!this.isOpen) this.emit("error", "No room with that code (local mode)."); }, 1500); return this; }
    send(o) { if (this.ch && this.isOpen) this.ch.postMessage({ k: "msg", from: this.id, d: JSON.parse(JSON.stringify(o)) }); }
    close() { if (this.ch) { try { this.ch.postMessage({ k: "bye", from: this.id }); this.ch.close(); } catch (e) { /* ignore */ } } this.isOpen = false; }
  }

  const local = () => /[?&]net=local\b/.test(location.search);
  BD.Net = {
    clean,
    available: () => local() || typeof window.Peer === "function",
    host: () => (local() ? new LocalLink() : new PeerLink()).host(),
    join: (code) => (local() ? new LocalLink() : new PeerLink()).join(code),
    isLocal: local,
  };
})(window.BD);
