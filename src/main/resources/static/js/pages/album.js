import { api } from "../api.js";
import { html, el, icon, coverArt, fmtLong, plural } from "../util.js";
import { trackList, albumCard, section, playTracks, toast } from "../components.js";
import { engine } from "../audio.js";

export default async function album({ params }) {
  const d = await api.get(`/api/albums/${encodeURIComponent(params.slug)}`);
  const a = d.album;
  const source = { label: a.title, href: `/album/${a.slug}` };
  const root = el(html`<div class="page">
    <header class="collection">
      <div class="collection__glow" aria-hidden="true"></div>
      <div class="collection__art">${coverArt(a.coverUrl, a.id * 47, `${a.title} cover`)}</div>
      <div class="collection__info">
        <span class="collection__kind">Album, ${a.year}</span>
        <h1 class="collection__title">${a.title}</h1>
        <div class="meta"><a href="/artist/${a.artist.slug}">${a.artist.name}</a>, ${plural(d.tracks.length, "song")}, ${fmtLong(d.durationSec)}</div>
        <div class="collection__actions">
          <button class="play-orb play-orb--lg magnetic" data-act="play" aria-label="Play ${a.title}">${icon("play")}</button>
          <button class="btn btn--ghost" data-act="shuffle">${icon("shuffle")}Shuffle</button>
        </div>
      </div>
    </header>
  </div>`);
  const list = section("Tracks", trackList(d.tracks, source, { compact: true }));
  root.appendChild(list);
  if (d.moreByArtist.length) root.appendChild(section(`More from ${a.artist.name}`, el(html`<div class="shelf">${d.moreByArtist.map((x) => albumCard(x, { sub: String(x.year) }))}</div>`)));

  const img = root.querySelector(".collection__art img");
  root.querySelector('[data-act="play"]').onclick = () => {
    if (engine.source?.href === source.href && engine.current) engine.toggle();
    else playTracks(d.tracks, 0, source, img);
  };
  root.querySelector('[data-act="shuffle"]').onclick = () => {
    if (!d.tracks.length) return toast("This album has no tracks yet");
    if (!engine.shuffle) engine.toggleShuffle();
    playTracks(d.tracks, Math.floor(Math.random() * d.tracks.length), source, img);
  };
  return { el: root, title: a.title, accent: a.palette[1] };
}
