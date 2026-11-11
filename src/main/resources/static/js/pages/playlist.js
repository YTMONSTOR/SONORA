import { api } from "../api.js";
import { html, el, icon, fmtLong, plural } from "../util.js";
import { trackList, section, playTracks, playlistArt, modal, playlistForm, readPlaylistForm, confirmDialog, toast } from "../components.js";
import { engine } from "../audio.js";
import { navigate, refresh } from "../router.js";
import { bus } from "../store.js";

export default async function playlist({ params }) {
  const d = await api.get(`/api/playlists/${params.id}`);
  const p = d.playlist;
  const tracks = d.items.map((i) => i.track);
  const source = { label: p.name, href: `/playlist/${p.id}` };
  const accent = `hsl(${p.coverHue} 80% 60%)`;
  const root = el(html`<div class="page">
    <header class="collection">
      <div class="collection__glow" aria-hidden="true"></div>
      <div class="collection__art">${playlistArt(p)}</div>
      <div class="collection__info">
        <span class="collection__kind">${p.isPublic ? "Playlist" : "Private playlist"}</span>
        <h1 class="collection__title">${p.name}</h1>
        ${p.description ? html`<p class="lede" style="font-size:1rem">${p.description}</p>` : ""}
        <div class="meta"><a href="/u/${p.ownerUsername}">${p.ownerName}</a>, ${plural(p.trackCount, "song")}${p.durationSec ? `, ${fmtLong(p.durationSec)}` : ""}</div>
        <div class="collection__actions">
          ${tracks.length ? html`<button class="play-orb play-orb--lg magnetic" data-act="play" aria-label="Play ${p.name}">${icon("play")}</button>` : ""}
          ${d.editable ? html`<button class="btn btn--ghost" data-act="edit">${icon("edit")}Edit details</button><button class="icon-btn" data-act="delete" aria-label="Delete playlist">${icon("trash")}</button>` : ""}
        </div>
      </div>
    </header>
  </div>`);

  if (tracks.length) {
    const extraMenu = d.editable ? (t, i) => [
      i > 0 && { icon: "up", label: "Move up", onClick: () => move(i, -1) },
      i < tracks.length - 1 && { icon: "down", label: "Move down", onClick: () => move(i, 1) },
      { icon: "trash", label: "Remove from this playlist", onClick: () => remove(i) },
    ].filter(Boolean) : undefined;
    root.appendChild(section("Songs", trackList(tracks, source, { extraMenu })));
  } else {
    root.appendChild(el(html`<section class="section"><div class="empty"><h2 class="h2">This playlist is empty</h2>
      <p class="meta">${d.editable ? "Find songs in search or on an album, then choose Add to playlist from the track menu." : "Nothing has been added yet."}</p>
      ${d.editable ? html`<a class="btn btn--primary" href="/search">Find songs</a>` : ""}</div></section>`));
  }

  async function move(i, dir) {
    const ids = d.items.map((x) => x.itemId);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    try { await api.put(`/api/playlists/${p.id}/order`, { itemIds: ids }); refresh(); } catch (e) { toast(e.message, { error: true }); }
  }
  async function remove(i) {
    try { await api.del(`/api/playlists/${p.id}/items/${d.items[i].itemId}`); toast(`Removed from ${p.name}`); refresh(); } catch (e) { toast(e.message, { error: true }); }
  }

  root.querySelector('[data-act="play"]')?.addEventListener("click", () => {
    if (engine.source?.href === source.href && engine.current) engine.toggle();
    else playTracks(tracks, 0, source, root.querySelector(".collection__art img"));
  });
  root.querySelector('[data-act="edit"]')?.addEventListener("click", () => modal({
    title: "Edit playlist", body: playlistForm(p),
    actions: [{ label: "Cancel" }, { label: "Save changes", primary: true, onClick: async (b) => {
      const v = readPlaylistForm(b);
      if (!v.name) throw new Error("Give the playlist a name");
      await api.patch(`/api/playlists/${p.id}`, v); toast("Playlist saved"); bus.emit("playlists"); refresh();
    } }],
  }));
  root.querySelector('[data-act="delete"]')?.addEventListener("click", async () => {
    if (!(await confirmDialog("Delete this playlist?", `“${p.name}” will be removed for everyone. Songs stay in the catalogue.`))) return;
    try { await api.del(`/api/playlists/${p.id}`); toast("Playlist deleted"); navigate("/library"); } catch (e) { toast(e.message, { error: true }); }
  });
  return { el: root, title: p.name, accent };
}
