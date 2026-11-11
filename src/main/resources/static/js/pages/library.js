import { api } from "../api.js";
import { html, el, icon, raw } from "../util.js";
import { trackList, albumCard, playlistCard, modal, playlistForm, readPlaylistForm, toast } from "../components.js";
import { navigate } from "../router.js";
import { bus } from "../store.js";
import { observeReveals } from "../motion.js";

const TABS = [["playlists", "Playlists"], ["liked", "Liked songs"], ["albums", "Albums"], ["recent", "Recently played"]];

export default async function library({ query }) {
  let d = await api.get("/api/library");
  let tab = TABS.some(([k]) => k === query.get("tab")) ? query.get("tab") : "playlists";
  const root = el(html`<div class="page">
    <div class="page-head"><h1 class="h1">Your library</h1><button class="btn btn--primary magnetic" id="new-pl">${icon("plus")}New playlist</button></div>
    <div class="tabs" role="tablist">${TABS.map(([k, label]) => html`<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === tab}" aria-controls="lib-panel">${label}</button>`)}</div>
    <div id="lib-panel" role="tabpanel"></div>
  </div>`);
  const panel = root.querySelector("#lib-panel");

  const empty = (title, text, cta) => el(html`<div class="empty"><h2 class="h2">${title}</h2><p class="meta">${text}</p>${cta ? raw(cta) : ""}</div>`);

  function draw() {
    root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    let content;
    if (tab === "playlists") content = d.playlists.length ? el(html`<div class="grid">${d.playlists.map(playlistCard)}</div>`)
      : empty("Make your first playlist", "Collect songs for a mood, a drive or a night in.", "");
    if (tab === "liked") content = d.liked.length ? trackList(d.liked, { label: "Liked songs", href: "/library?tab=liked" })
      : empty("No liked songs yet", "Tap the heart on any song to keep it here.", `<a class="btn" href="/">Explore music</a>`);
    if (tab === "albums") content = d.albums.length ? el(html`<div class="grid">${d.albums.map((a) => albumCard(a))}</div>`)
      : empty("No albums yet", "Albums with songs you've liked appear here.", `<a class="btn" href="/search">Browse albums</a>`);
    if (tab === "recent") content = d.recent.length ? trackList(d.recent, { label: "Recently played", href: "/library?tab=recent" }, { compact: true })
      : empty("Nothing played yet", "Songs you listen to will show up here.", `<a class="btn" href="/">Start listening</a>`);
    panel.replaceChildren(content);
    observeReveals(panel);
  }
  root.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.dataset.tab; history.replaceState({}, "", `/library?tab=${tab}`); draw();
  });
  root.querySelector(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.stopPropagation();
    const i = TABS.findIndex(([k]) => k === tab), n = (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    tab = TABS[n][0]; draw(); root.querySelector(`[data-tab="${tab}"]`).focus();
  });
  root.querySelector("#new-pl").onclick = () => modal({
    title: "New playlist", body: playlistForm(),
    actions: [{ label: "Cancel" }, { label: "Create playlist", primary: true, onClick: async (b) => {
      const v = readPlaylistForm(b);
      if (!v.name) throw new Error("Give the playlist a name");
      const p = await api.post("/api/playlists", v);
      toast("Playlist created"); navigate(`/playlist/${p.playlist.id}`);
    } }],
  });

  const reload = async () => { try { d = await api.get("/api/library"); draw(); } catch { /* keep current */ } };
  const offs = [bus.on("playlists", reload), bus.on("likes", () => tab === "liked" && reload())];
  draw();
  return { el: root, title: "Library", destroy: () => offs.forEach((f) => f()) };
}
