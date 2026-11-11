// Tiny global state + event bus.
import { api } from "./api.js";

const listeners = new Map();
export const bus = {
  on(evt, fn) { (listeners.get(evt) || listeners.set(evt, new Set()).get(evt)).add(fn); return () => listeners.get(evt)?.delete(fn); },
  emit(evt, data) { listeners.get(evt)?.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
};

const DEFAULT_SETTINGS = { quality: "auto", motion: "auto", lyricsSize: "large", cursor: true, crossfade: true };

function localSettings() {
  try { return JSON.parse(localStorage.getItem("sonora.settings") || "{}"); } catch { return {}; }
}

export const store = {
  user: null,
  likes: new Set(),
  settings: { ...DEFAULT_SETTINGS, ...localSettings() },

  async boot() {
    const [me, likes] = await Promise.allSettled([api.get("/api/auth/me"), api.get("/api/me/likes")]);
    this.setUser(me.status === "fulfilled" ? me.value.user : null);
    this.likes = new Set(likes.status === "fulfilled" ? likes.value : []);
  },

  setUser(user) {
    this.user = user;
    if (user?.settings && Object.keys(user.settings).length) this.settings = { ...DEFAULT_SETTINGS, ...user.settings };
    bus.emit("user", user);
  },

  async refreshLikes() {
    try { this.likes = new Set(await api.get("/api/me/likes")); } catch { this.likes = new Set(); }
    bus.emit("likes");
  },

  isLiked: (id) => store.likes.has(id),

  async toggleLike(id) {
    if (!this.user) { bus.emit("need-auth", "Sign in to save songs to your library"); return null; }
    const liked = !this.likes.has(id);
    liked ? this.likes.add(id) : this.likes.delete(id);
    bus.emit("likes", { id, liked });
    try {
      liked ? await api.put(`/api/tracks/${id}/like`) : await api.del(`/api/tracks/${id}/like`);
    } catch (e) {
      liked ? this.likes.delete(id) : this.likes.add(id);
      bus.emit("likes", { id, liked: !liked });
      throw e;
    }
    return liked;
  },

  async saveSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    try { localStorage.setItem("sonora.settings", JSON.stringify(this.settings)); } catch { /* storage unavailable */ }
    bus.emit("settings", this.settings);
    if (this.user) {
      try { const u = await api.put("/api/me/settings", this.settings); this.user = u; } catch { /* keep local copy */ }
    }
  },
};
