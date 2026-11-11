import { api } from "../api.js";
import { html, el, icon, debounce, coverArt } from "../util.js";
import { trackList, albumCard, artistCard, playlistCard, section, playTracks } from "../components.js";
import { observeReveals } from "../motion.js";

export default async function search({ query }) {
  const initial = query.get("q") || "";
  const home = await api.get("/api/home");
  const root = el(html`<div class="page">
    <div class="page-head"><h1 class="h1">Search</h1></div>
    <form class="search-field" role="search" autocomplete="off">
      ${icon("search")}
      <label class="sr-only" for="q">Search songs, albums, artists and playlists</label>
      <input class="input" id="q" name="q" type="search" placeholder="Songs, albums, artists, playlists" value="${initial}" enterkeyhint="search">
    </form>
    <div id="results" aria-live="polite"></div>
  </div>`);
  const input = root.querySelector("#q"), results = root.querySelector("#results");
  let token = 0;

  function idle() {
    results.replaceChildren(
      section("Artists", el(html`<div class="shelf">${home.artists.map(artistCard)}</div>`)),
      section("Albums", el(html`<div class="grid">${home.albums.map((a) => albumCard(a))}</div>`)),
    );
    observeReveals(results);
  }

  async function run(q) {
    const my = ++token;
    const url = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    history.replaceState({}, "", url);
    if (!q) return idle();
    let r;
    try { r = await api.get(`/api/search?q=${encodeURIComponent(q)}`); }
    catch (e) { results.replaceChildren(el(html`<div class="empty"><p class="meta">${e.message}</p></div>`)); return; }
    if (my !== token) return;
    const blocks = [];
    const total = r.tracks.length + r.albums.length + r.artists.length + r.playlists.length;
    if (!total) {
      results.replaceChildren(el(html`<div class="empty"><h2 class="h2">Nothing matches “${q}”</h2><p class="meta">Check the spelling, or search for an artist or album name instead.</p></div>`));
      return;
    }
    const top = r.artists[0] ? { kind: "Artist", title: r.artists[0].name, href: `/artist/${r.artists[0].slug}`, img: r.artists[0].imageUrl, round: true }
      : r.tracks[0] ? { kind: "Song", title: r.tracks[0].title, href: `/album/${r.tracks[0].album.slug}`, img: r.tracks[0].album.coverSmallUrl, track: r.tracks[0] }
      : r.albums[0] ? { kind: "Album", title: r.albums[0].title, href: `/album/${r.albums[0].slug}`, img: r.albums[0].coverSmallUrl } : null;
    if (top) {
      const topEl = el(html`<div class="two-col">
        <section class="section"><div class="section__head"><h2 class="h2">Top result</h2></div>
          <div class="panel" style="display:grid;gap:18px;position:relative">
            <div style="width:120px;height:120px;overflow:hidden;border-radius:${top.round ? "50%" : "14px"}">${coverArt(top.img, 280)}</div>
            <div><a class="h2 card__link" href="${top.href}">${top.title}</a><div class="meta">${top.kind}</div></div>
            ${top.track ? html`<button class="play-orb" style="position:absolute;right:24px;bottom:24px;z-index:2" data-top aria-label="Play ${top.title}">${icon("play")}</button>` : ""}
          </div></section>
        <div id="songs"></div></div>`);
      if (r.tracks.length) topEl.querySelector("#songs").appendChild(section("Songs", trackList(r.tracks.slice(0, 5), { label: `Search: ${q}`, href: url }, { compact: true })));
      topEl.querySelector("[data-top]")?.addEventListener("click", () => playTracks(r.tracks, 0, { label: `Search: ${q}`, href: url }));
      blocks.push(topEl);
    }
    if (r.tracks.length > 5) blocks.push(section("More songs", trackList(r.tracks.slice(5), { label: `Search: ${q}`, href: url }, { compact: true })));
    if (r.artists.length) blocks.push(section("Artists", el(html`<div class="shelf">${r.artists.map(artistCard)}</div>`)));
    if (r.albums.length) blocks.push(section("Albums", el(html`<div class="grid">${r.albums.map((a) => albumCard(a))}</div>`)));
    if (r.playlists.length) blocks.push(section("Playlists", el(html`<div class="grid">${r.playlists.map(playlistCard)}</div>`)));
    results.replaceChildren(...blocks);
    observeReveals(results);
  }

  const debounced = debounce((v) => run(v.trim()), 220);
  input.addEventListener("input", () => debounced(input.value));
  root.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); run(input.value.trim()); });
  initial ? run(initial) : idle();
  return { el: root, title: "Search", mounted: () => { if (!matchMedia("(pointer: coarse)").matches) input.focus({ preventScroll: true }); } };
}
