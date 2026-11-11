import { api } from "../api.js";
import { html, el, icon, fmtNum } from "../util.js";
import { trackList, albumCard, section, playTracks } from "../components.js";
import { engine } from "../audio.js";
import { reducedMotion } from "../motion.js";

export default async function artist({ params }) {
  const d = await api.get(`/api/artists/${encodeURIComponent(params.slug)}`);
  const a = d.artist;
  const source = { label: a.name, href: `/artist/${a.slug}` };
  const root = el(html`<div class="page page--flush">
    <header class="artist-hero">
      <div class="artist-hero__bg" style="background-image:url('${a.bannerUrl || a.imageUrl || "/assets/placeholder.svg"}')"></div>
      <div class="artist-hero__content">
        <div class="artist-hero__portrait">${a.imageUrl ? html`<img src="${a.imageUrl}" alt="">` : ""}</div>
        <span class="collection__kind">${a.genre || "Artist"}</span>
        <h1 class="collection__title">${a.name}</h1>
        <div class="meta">${fmtNum(d.totalPlays)} plays across ${d.albums.length === 1 ? "1 album" : `${d.albums.length} albums`}</div>
        <div class="collection__actions">
          <button class="play-orb play-orb--lg magnetic" data-act="play" aria-label="Play ${a.name}">${icon("play")}</button>
        </div>
      </div>
    </header>
  </div>`);
  const body = el(`<div class="two-col"></div>`);
  const left = el(`<div></div>`);
  left.appendChild(section("Popular", trackList(d.topTracks, source, { ranked: true })));
  body.appendChild(left);
  if (a.bio) body.appendChild(el(html`<aside class="section reveal"><div class="section__head"><h2 class="h2">About</h2></div><p class="prose">${a.bio}</p></aside>`));
  root.appendChild(body);
  if (d.albums.length) root.appendChild(section("Discography", el(html`<div class="grid">${d.albums.map((x) => albumCard(x, { sub: String(x.year) }))}</div>`)));

  root.querySelector('[data-act="play"]').onclick = () => {
    if (engine.source?.href === source.href && engine.current) engine.toggle();
    else playTracks(d.topTracks, 0, source, null);
  };

  // gentle parallax on the banner
  const bg = root.querySelector(".artist-hero__bg");
  const onScroll = () => { if (!reducedMotion()) bg.style.transform = `translate3d(0, ${scrollY * 0.25}px, 0) scale(1.08)`; };
  addEventListener("scroll", onScroll, { passive: true });
  return { el: root, title: a.name, accent: a.accentColor, destroy: () => removeEventListener("scroll", onScroll) };
}
