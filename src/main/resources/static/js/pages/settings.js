import { html, el, raw } from "../util.js";
import { store } from "../store.js";
import { toast } from "../components.js";

const seg = (name, value, options) => html`<div class="segmented" role="group" data-seg="${name}">${options.map(([v, label]) =>
  html`<button type="button" data-v="${v}" aria-pressed="${v === value}">${label}</button>`)}</div>`;
const sw = (name, on, label) => html`<label class="switch"><input type="checkbox" data-sw="${name}" ${on ? raw("checked") : ""}><span class="switch__track"></span><span class="sr-only">${label}</span></label>`;

export default async function settings() {
  const s = store.settings;
  const root = el(html`<div class="page" style="max-width:920px">
    <div class="page-head"><h1 class="h1">Settings</h1></div>
    <section class="panel reveal"><div class="panel__head"><h2 class="h2">Visuals</h2></div>
      <div class="setting"><div class="setting__text"><b>3D quality</b><span class="meta">Auto picks the best level for this device. Off shows a lightweight 2D version.</span></div>
        ${seg("quality", s.quality, [["auto", "Auto"], ["high", "High"], ["medium", "Medium"], ["low", "Low"], ["off", "Off"]])}</div>
      <div class="setting"><div class="setting__text"><b>Motion</b><span class="meta">Reduced keeps scenes still and removes transitions. Auto follows your system setting.</span></div>
        ${seg("motion", s.motion, [["auto", "Auto"], ["reduced", "Reduced"], ["full", "Full"]])}</div>
      <div class="setting"><div class="setting__text"><b>Custom cursor</b><span class="meta">Desktop only.</span></div>${sw("cursor", s.cursor !== false, "Custom cursor")}</div>
    </section>
    <section class="panel reveal"><div class="panel__head"><h2 class="h2">Playback</h2></div>
      <div class="setting"><div class="setting__text"><b>Smooth transitions</b><span class="meta">Fade between songs instead of cutting.</span></div>${sw("crossfade", s.crossfade !== false, "Smooth transitions")}</div>
      <div class="setting"><div class="setting__text"><b>Lyrics size</b></div>${seg("lyricsSize", s.lyricsSize, [["large", "Large"], ["medium", "Medium"]])}</div>
    </section>
    <section class="panel reveal"><div class="panel__head"><h2 class="h2">Keyboard shortcuts</h2></div>
      <table class="table"><tbody>
        <tr><td>Space</td><td>Play or pause</td></tr><tr><td>Left / Right</td><td>Seek 5 seconds</td></tr>
        <tr><td>Shift + Left / Right</td><td>Previous or next track</td></tr><tr><td>F</td><td>Full-screen player</td></tr>
        <tr><td>L</td><td>Lyrics</td></tr><tr><td>Q</td><td>Queue</td></tr><tr><td>M</td><td>Mute</td></tr>
      </tbody></table>
    </section>
    <section class="panel reveal"><div class="panel__head"><h2 class="h2">Account</h2></div>
      ${store.user ? html`<div class="setting"><div class="setting__text"><b>${store.user.displayName}</b><span class="meta">Settings are saved to your account.</span></div><a class="btn" href="/profile">Open profile</a></div>`
        : html`<div class="setting"><div class="setting__text"><b>Not signed in</b><span class="meta">Settings are saved on this device only.</span></div><a class="btn btn--primary" href="/login">Sign in</a></div>`}
    </section>
  </div>`);
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-seg] button"); if (!b) return;
    const group = b.parentElement;
    group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    await store.saveSettings({ [group.dataset.seg]: b.dataset.v });
    if (group.dataset.seg === "quality") toast("3D quality updated. It applies to scenes as they open.");
    else toast("Saved");
  });
  root.addEventListener("change", async (e) => {
    const c = e.target.closest("[data-sw]"); if (!c) return;
    await store.saveSettings({ [c.dataset.sw]: c.checked }); toast("Saved");
  });
  return { el: root, title: "Settings" };
}
