import { api } from "../api.js";
import { html, el, icon, avatar, fmtNum } from "../util.js";
import { artistCard, playlistCard, section, modal, toast } from "../components.js";
import { store } from "../store.js";
import { navigate, refresh } from "../router.js";
import { engine } from "../audio.js";

export default async function profile({ params }) {
  const d = await api.get(params.username ? `/api/users/${encodeURIComponent(params.username)}` : "/api/me/profile");
  const u = d.user;
  const self = store.user?.id === u.id;
  const root = el(html`<div class="page">
    <header class="collection collection--profile">
      <div class="collection__glow" aria-hidden="true"></div>
      <div>${avatar(u, 168)}</div>
      <div class="collection__info">
        <span class="collection__kind">${u.role === "ADMIN" ? "Administrator" : "Listener"}, member since ${u.memberSince}</span>
        <h1 class="collection__title">${u.displayName}</h1>
        <div class="meta">@${u.username}</div>
        ${u.bio ? html`<p class="prose" style="margin:0">${u.bio}</p>` : ""}
        ${self ? html`<div class="collection__actions">
          <button class="btn" data-act="edit">${icon("edit")}Edit profile</button>
          <button class="btn btn--ghost" data-act="password">Change password</button>
          <button class="btn btn--ghost" data-act="logout">${icon("logout")}Sign out</button></div>` : ""}
      </div>
    </header>
    <section class="section reveal"><div class="stats">
      <div class="stat"><b>${fmtNum(d.plays)}</b><span>Plays</span></div>
      <div class="stat"><b>${fmtNum(d.minutesListened)}</b><span>Minutes listened</span></div>
      <div class="stat"><b>${fmtNum(d.likes)}</b><span>Liked songs</span></div>
      <div class="stat"><b>${fmtNum(d.playlists)}</b><span>Playlists</span></div>
    </div></section>
  </div>`);
  if (d.topArtists.length) root.appendChild(section(self ? "Your top artists" : "Top artists", el(html`<div class="shelf">${d.topArtists.map(artistCard)}</div>`)));
  if (d.publicPlaylists.length) root.appendChild(section(self ? "Your playlists" : "Playlists", el(html`<div class="grid">${d.publicPlaylists.map(playlistCard)}</div>`)));

  root.querySelector('[data-act="edit"]')?.addEventListener("click", () => {
    const body = el(html`<form class="form">
      <div class="field"><label for="p-dn">Display name</label><input class="input" id="p-dn" name="displayName" maxlength="80" required value="${u.displayName}"></div>
      <div class="field"><label for="p-em">Email</label><input class="input" id="p-em" name="email" type="email" required value="${u.email || ""}"></div>
      <div class="field"><label for="p-bio">Bio</label><textarea class="textarea" id="p-bio" name="bio" maxlength="400">${u.bio || ""}</textarea></div>
      <div class="field"><label for="p-hue">Avatar colour</label><div style="display:flex;gap:16px;align-items:center"><span id="p-prev">${avatar(u, 48)}</span><input class="range" id="p-hue" name="avatarHue" type="range" min="0" max="359" value="${u.avatarHue}"></div></div>
    </form>`);
    const hue = body.querySelector("#p-hue"), prev = body.querySelector("#p-prev .avatar");
    hue.oninput = () => prev.style.setProperty("--h", hue.value);
    modal({ title: "Edit profile", body, actions: [{ label: "Cancel" }, { label: "Save changes", primary: true, onClick: async (b) => {
      const f = b.querySelector("form");
      const user = await api.patch("/api/me/profile", { displayName: f.displayName.value, email: f.email.value, bio: f.bio.value, avatarHue: +f.avatarHue.value });
      store.setUser(user); toast("Profile saved"); refresh();
    } }] });
  });
  root.querySelector('[data-act="password"]')?.addEventListener("click", () => modal({
    title: "Change password",
    body: el(html`<form class="form"><div class="field"><label for="pw-c">Current password</label><input class="input" id="pw-c" name="cur" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="pw-n">New password</label><input class="input" id="pw-n" name="next" type="password" autocomplete="new-password" minlength="8" required><span class="hint">At least 8 characters.</span></div></form>`),
    actions: [{ label: "Cancel" }, { label: "Update password", primary: true, onClick: async (b) => {
      const f = b.querySelector("form");
      await api.post("/api/me/password", { currentPassword: f.cur.value, newPassword: f.next.value }); toast("Password updated");
    } }],
  }));
  root.querySelector('[data-act="logout"]')?.addEventListener("click", async () => {
    try { await api.post("/api/auth/logout"); } catch { /* session already gone */ }
    engine.pause(); store.setUser(null); store.likes = new Set(); toast("Signed out"); navigate("/");
  });
  return { el: root, title: u.displayName, accent: `hsl(${u.avatarHue} 80% 60%)` };
}
