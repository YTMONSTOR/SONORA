import { api } from "../api.js";
import { html, el, icon } from "../util.js";
import { trackList, albumCard, artistCard, playlistCard, section, playTracks, toast } from "../components.js";
import { engine } from "../audio.js";
import { flyTo, tween, reducedMotion } from "../motion.js";
import { store } from "../store.js";

export default async function home() {
  const d = await api.get("/api/home");
  const f = d.featured;
  const root = el(`<div></div>`);
  const disposers = [];

  // ---------- hero ----------
  const hero = el(html`<section class="hero" aria-label="Featured">
    <div class="hero__shade"></div>
    <div class="hero__content">
      <h1 class="hero__title"><span class="chrome-text">Sound,</span><span class="chrome-text">sculpted.</span></h1>
      <p class="lede">Original music in real-time 3D. The record spins to the beat, the light follows the bass, and the lyrics move with every line.</p>
      ${f ? html`<div class="hero__now">
        <button class="play-orb play-orb--lg magnetic" id="hero-play" aria-label="Play ${f.title}">${icon("play")}</button>
        <div class="hero__track"><b>${f.title}</b><span class="meta"><a href="/artist/${f.artist.slug}">${f.artist.name}</a>, ${f.year}</span></div>
        <a class="btn btn--ghost" href="/album/${f.slug}">View album</a>
      </div>` : html`<p class="meta">The catalogue is empty. An admin can upload the first track from the admin dashboard.</p>`}
    </div>
    <div class="hero__hint" aria-hidden="true">Drag the record</div>
  </section>`);
  root.appendChild(hero);

  const page = el(`<div class="page"></div>`);
  root.appendChild(page);

  // ---------- 3D discovery ----------
  if (d.albums.length) {
    const disc = el(html`<section class="section reveal" aria-labelledby="disc-h">
      <div class="section__head"><div><h2 class="h2" id="disc-h">Albums</h2><p class="meta" style="margin:6px 0 0">Drag or swipe to browse. Select the centre record to play it.</p></div></div>
      <div class="discovery" id="discovery">
        <div class="discovery__caption" aria-live="polite"><b id="disc-title"></b><span class="meta" id="disc-sub"></span></div>
        <div class="discovery__nav">
          <button class="icon-btn" id="disc-prev" aria-label="Previous album">${icon("left")}</button>
          <button class="icon-btn" id="disc-play" aria-label="Play this album">${icon("play")}</button>
          <button class="icon-btn" id="disc-next" aria-label="Next album">${icon("right")}</button>
        </div>
      </div>
    </section>`);
    page.appendChild(disc);
  }

  if (d.recent?.length) page.appendChild(section("Jump back in", trackList(d.recent, { label: "Recently played", href: "/library" }, { compact: true }), { link: { href: "/library", label: "Your library" } }));
  if (d.trending.length) page.appendChild(section("Trending now", trackList(d.trending, { label: "Trending now", href: "/" }, { ranked: true })));
  if (d.artists.length) page.appendChild(section("Artists", el(html`<div class="shelf">${d.artists.map(artistCard)}</div>`)));
  if (d.playlists.length) page.appendChild(section("Playlists", el(html`<div class="shelf">${d.playlists.map(playlistCard)}</div>`), store.user ? { link: { href: "/library", label: "Your playlists" } } : {}));
  if (!store.user) {
    page.appendChild(el(html`<section class="section reveal"><div class="panel" style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between">
      <div><h2 class="h2">Keep what you love</h2><p class="meta" style="margin:8px 0 0">Create an account to like songs, build playlists and pick up where you left off.</p></div>
      <div style="display:flex;gap:10px"><a class="btn btn--ghost" href="/login">Sign in</a><a class="btn btn--primary magnetic" href="/register">Create account</a></div></div></section>`));
  }

  const playFeatured = () => d.featuredTracks.length && playTracks(d.featuredTracks, 0, { label: f.title, href: `/album/${f.slug}` }, null);

  return {
    el: root,
    title: null,
    accent: f?.palette?.[1],
    async mounted() {
      hero.querySelector("#hero-play")?.addEventListener("click", (e) => {
        if (engine.current && d.featuredTracks.some((t) => t.id === engine.current.id)) engine.toggle();
        else { playFeatured(); flyTo(e.currentTarget.getBoundingClientRect(), f.coverUrl, document.querySelector(".dock__art")); }
      });

      // the one orchestrated entrance: headline lines rise out of a blur, then the supporting copy
      if (!reducedMotion()) {
        const lines = hero.querySelectorAll(".hero__title span");
        tween(lines, { opacity: 0, y: 60, filter: "blur(18px)" }, { opacity: 1, y: 0, filter: "blur(0px)" }, { duration: 1.4, stagger: 0.12, delay: 0.35 });
        tween(hero.querySelectorAll(".lede, .hero__now"), { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, { duration: 1.1, stagger: 0.1, delay: 0.9 });
      }

      const { createHero } = await import("../three/hero.js");
      const h = await createHero(hero, { album: engine.current?.album || f });
      if (h) disposers.push(() => h.dispose());
      else fallbackHero(hero, f);

      const box = root.querySelector("#discovery");
      if (box) await mountDiscovery(box, d.albums, disposers);
    },
    destroy() { disposers.forEach((fn) => fn()); },
  };
}

function fallbackHero(hero, f) {
  const stage = el(`<div class="fallback-stage" aria-hidden="true"><div class="vinyl-css"></div></div>`);
  if (f?.coverUrl) stage.firstElementChild.style.setProperty("--label", `url("${f.coverUrl}")`);
  hero.prepend(stage);
  hero.classList.add("no-3d");
}

async function mountDiscovery(box, albums, disposers) {
  const title = box.querySelector("#disc-title"), sub = box.querySelector("#disc-sub");
  let focused = albums[0];
  const caption = (a) => { focused = a; title.textContent = a.title; sub.textContent = `${a.artist.name}, ${a.year}`; };
  caption(albums[Math.min(1, albums.length - 1)]);

  const playAlbum = async (a, rect) => {
    try {
      const d = await api.get(`/api/albums/${a.slug}`);
      engine.playList(d.tracks, 0, { label: d.album.title, href: `/album/${d.album.slug}` });
      if (rect && a.coverUrl) flyTo(rect, a.coverUrl, document.querySelector(".dock__art"));
      toast(`Playing ${a.title}`);
    } catch (e) { toast(e.message, { error: true }); }
  };

  const { createDiscovery } = await import("../three/discovery.js");
  const scene = await createDiscovery(box, { albums, onFocus: caption, onSelect: playAlbum });
  if (!scene) {
    // no WebGL: a plain shelf keeps every album reachable
    box.replaceWith(el(html`<div class="shelf">${albums.map((a) => albumCard(a))}</div>`));
    return;
  }
  disposers.push(() => scene.dispose());
  box.querySelector("#disc-prev").onclick = () => scene.step(-1);
  box.querySelector("#disc-next").onclick = () => scene.step(1);
  box.querySelector("#disc-play").onclick = () => scene.selectFocused();
  box.tabIndex = 0;
  box.setAttribute("aria-label", "Album browser. Use left and right arrow keys to browse, Enter to play.");
  box.addEventListener("keydown", (e) => {
    if (e.target !== box) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); scene.step(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); scene.step(1); }
    if (e.key === "Enter") { e.preventDefault(); scene.selectFocused(); }
  });
  // screen-reader friendly list of the same albums
  const list = el(html`<ul class="sr-only">${albums.map((a) => html`<li><a href="/album/${a.slug}">${a.title} by ${a.artist.name}</a></li>`)}</ul>`);
  box.appendChild(list);
}
