// SONORA boot sequence.
import { store, bus } from "./store.js";
import { engine } from "./audio.js";
import { initRouter, render } from "./router.js";
import { initPlayer } from "./player.js";
import { initPointerFx } from "./motion.js";
import { avatar } from "./util.js";

function renderNav(user) {
  const link = document.getElementById("nav-profile");
  const av = document.getElementById("nav-avatar");
  document.getElementById("nav-profile-label").textContent = user ? "Profile" : "Sign in";
  link.setAttribute("href", user ? "/profile" : "/login");
  av.outerHTML = user
    ? String(avatar(user, 26)).replace('class="avatar"', 'class="rail__avatar avatar" id="nav-avatar"')
    : `<span class="rail__avatar avatar" id="nav-avatar" style="--h:270"><svg style="width:16px;height:16px"><use href="#i-user"/></svg></span>`;
  document.getElementById("nav-admin").classList.toggle("hidden", user?.role !== "ADMIN");
}

async function boot() {
  const started = performance.now();
  bus.on("user", renderNav);
  const applyPrefs = (st) => { document.body.dataset.lyrics = st.lyricsSize || "large"; };
  bus.on("settings", applyPrefs); bus.on("user", () => applyPrefs(store.settings));
  applyPrefs(store.settings);
  await store.boot().catch(() => store.setUser(null));
  initRouter();
  initPlayer();
  initPointerFx();
  engine.restore();
  await render(true);
  // keep the loader up just long enough to read as intentional, never longer
  const wait = Math.max(0, 700 - (performance.now() - started));
  setTimeout(() => document.getElementById("loader").classList.add("done"), wait);
}

boot();
