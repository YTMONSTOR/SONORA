// Shared UI building blocks.
import { html, raw, el, icon, esc, fmtTime, coverArt, $$, plural } from "./util.js";
import { engine } from "./audio.js";
import { store, bus } from "./store.js";
import { api } from "./api.js";
import { navigate } from "./router.js";
import { flyTo } from "./motion.js";

// ---------- toasts ----------
export function toast(message, { error = false } = {}) {
  const root = document.getElementById("toasts");
  const t = el(html`<div class="toast${error ? " toast--error" : ""}">${message}</div>`);
  root.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, error ? 4200 : 2600);
}
bus.on("toast", (d) => toast(d.message, d));
bus.on("need-auth", (msg) => {
  toast(msg || "Sign in to continue");
  navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
});

// ---------- modal ----------
let modalClose = null;
export function modal({ title, body, actions = [], onOpen, wide = false }) {
  const root = document.getElementById("modal-root");
  modalClose?.(true);
  const box = el(html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ${wide ? raw('style="width:min(720px,100%)"') : ""}>
    <div class="modal__head"><h2 class="h2" id="modal-title">${title}</h2><button class="icon-btn icon-btn--sm" data-close aria-label="Close">${icon("close")}</button></div>
    <div class="modal__body"></div>
    ${actions.length ? raw(`<div class="modal__actions"></div>`) : ""}
  </div>`);
  const bodyEl = box.querySelector(".modal__body");
  if (body instanceof Node) bodyEl.appendChild(body);
  else if (body != null) bodyEl.innerHTML = String(body);
  const actionsEl = box.querySelector(".modal__actions");
  const lastFocus = document.activeElement;
  let resolve;
  const done = new Promise((r) => (resolve = r));
  const close = (instant = false, value = null) => {
    root.classList.remove("is-open");
    document.removeEventListener("keydown", onKey);
    modalClose = null;
    setTimeout(() => box.remove(), instant ? 0 : 450);
    lastFocus?.focus?.();
    resolve(value);
  };
  actions.forEach((a) => {
    const b = el(html`<button class="btn ${a.primary ? "btn--primary" : a.danger ? "btn--danger" : "btn--ghost"}" type="${a.submit ? "submit" : "button"}">${a.label}</button>`);
    b.addEventListener("click", async () => {
      if (!a.onClick) return close(false, a.value ?? null);
      b.disabled = true;
      try { const r = await a.onClick(bodyEl); if (r !== false) close(false, r ?? a.value ?? true); }
      catch (e) { toast(e.message, { error: true }); }
      finally { b.disabled = false; }
    });
    actionsEl.appendChild(b);
  });
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") trapFocus(e, box);
  };
  document.addEventListener("keydown", onKey);
  box.addEventListener("submit", (e) => {
    e.preventDefault();
    const primary = [...(actionsEl?.children || [])].find((b) => b.classList.contains("btn--primary"));
    primary?.click();
  });
  root.querySelector(".modal-backdrop").onclick = () => close();
  box.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  root.appendChild(box);
  requestAnimationFrame(() => {
    root.classList.add("is-open");
    (box.querySelector("input, textarea, select, .modal__body button") || box.querySelector("[data-close]"))?.focus();
  });
  modalClose = close;
  onOpen?.(bodyEl, close);
  return done;
}
function trapFocus(e, box) {
  const f = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", box).filter((x) => !x.disabled && x.offsetParent);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function confirmDialog(title, message, label = "Delete") {
  return modal({ title, body: html`<p class="meta" style="font-size:1rem;margin:0">${message}</p>`, actions: [
    { label: "Cancel", value: false }, { label, danger: true, value: true },
  ] });
}

// ---------- context menu ----------
let openMenu = null;
export function menu(anchor, items) {
  closeMenu();
  const m = el(`<div class="menu" role="menu"></div>`);
  items.filter(Boolean).forEach((it) => {
    const b = el(html`<button role="menuitem">${icon(it.icon)}<span>${it.label}</span></button>`);
    b.onclick = () => { closeMenu(); it.onClick(); };
    m.appendChild(b);
  });
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = Math.min(r.right - mw, innerWidth - mw - 12); left = Math.max(12, left);
  let top = r.bottom + 6; if (top + mh > innerHeight - 12) top = Math.max(12, r.top - mh - 6);
  Object.assign(m.style, { left: left + "px", top: top + "px" });
  m.querySelector("button")?.focus();
  const off = (e) => { if (!m.contains(e.target)) closeMenu(); };
  const key = (e) => {
    if (e.key === "Escape") { closeMenu(); anchor.focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const bs = $$("button", m), i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length].focus();
    }
  };
  setTimeout(() => document.addEventListener("pointerdown", off), 0);
  document.addEventListener("keydown", key);
  openMenu = () => { m.remove(); document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", key); };
}
export function closeMenu() { openMenu?.(); openMenu = null; }
addEventListener("scroll", closeMenu, { passive: true });

// ---------- like button ----------
export function likeButton(trackId, size = "sm") {
  const on = store.isLiked(trackId);
  return html`<button class="icon-btn icon-btn--${size} like-btn${on ? " is-on" : ""}" data-like="${trackId}" aria-pressed="${on}" aria-label="${on ? "Remove from liked songs" : "Save to liked songs"}">${icon("heart")}</button>`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-like]");
  if (!b) return;
  e.stopPropagation();
  const id = +b.dataset.like;
  try {
    const liked = await store.toggleLike(id);
    if (liked != null) toast(liked ? "Saved to liked songs" : "Removed from liked songs");
  } catch (err) { toast(err.message, { error: true }); }
});
bus.on("likes", () => {
  $$("[data-like]").forEach((b) => {
    const on = store.isLiked(+b.dataset.like);
    if (b.classList.contains("is-on") !== on) { b.classList.toggle("is-on", on); if (on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } }
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Remove from liked songs" : "Save to liked songs");
  });
});

// ---------- tracks ----------
const eq = raw(`<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>`);

export function trackRow(t, i, { showArt = true, number } = {}) {
  const current = engine.current?.id === t.id;
  return html`<div class="track${current ? " is-current" : ""}" data-id="${t.id}" data-i="${i}">
    <button class="track__play" aria-label="Play ${t.title} by ${t.artist.name}"></button>
    <span class="track__n"><span class="num">${number ?? i + 1}</span>${eq}</span>
    <span class="track__art">${showArt ? coverArt(t.album.coverSmallUrl, t.album.id * 47) : ""}</span>
    <span class="track__main"><div class="track__title">${t.title}</div><div class="track__artist"><a href="/artist/${t.artist.slug}">${t.artist.name}</a></div></span>
    <span class="track__album"><a href="/album/${t.album.slug}">${t.album.title}</a></span>
    ${likeButton(t.id)}
    <span class="track__dur">${fmtTime(t.durationSec)}</span>
    <button class="icon-btn icon-btn--sm" data-more aria-label="More options for ${t.title}">${icon("more")}</button>
  </div>`;
}

/** Renders a list of tracks and wires up play / menus. extraMenu(t, i) can add items. */
export function trackList(tracks, source, { compact = false, ranked = false, extraMenu } = {}) {
  const wrap = el(html`<div class="tracks${compact ? " tracks--compact" : ""}${ranked ? " tracks--ranked" : ""}" role="list">${tracks.map((t, i) => trackRow(t, i))}</div>`);
  wrap.addEventListener("click", (e) => {
    const row = e.target.closest(".track");
    if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest("[data-more]")) { trackMenu(e.target.closest("[data-more]"), tracks[i], extraMenu?.(tracks[i], i)); return; }
    if (e.target.closest(".track__play")) {
      if (engine.current?.id === tracks[i].id && sameSource(source)) engine.toggle();
      else playTracks(tracks, i, source, row.querySelector(".track__art img"));
    }
  });
  return wrap;
}
const sameSource = (s) => engine.source?.href === s?.href;

export function trackMenu(anchor, t, extra = []) {
  menu(anchor, [
    { icon: "play", label: "Play next", onClick: () => { engine.playNext(t); toast("Playing next"); } },
    { icon: "queue", label: "Add to queue", onClick: () => { engine.addToQueue(t); toast("Added to queue"); } },
    { icon: "plus", label: "Add to playlist", onClick: () => addToPlaylist(t) },
    { icon: "note", label: "Go to album", onClick: () => navigate(`/album/${t.album.slug}`) },
    { icon: "user", label: "Go to artist", onClick: () => navigate(`/artist/${t.artist.slug}`) },
    ...(extra || []),
  ]);
}

export async function playTracks(tracks, index, source, imgEl) {
  const rect = imgEl?.getBoundingClientRect?.();
  const src = tracks[index]?.album?.coverUrl;
  engine.playList(tracks, index, source);
  if (rect && src) flyTo(rect, src, document.querySelector(".dock__art"));
}

bus.on("track", (t) => {
  $$(".track").forEach((r) => r.classList.toggle("is-current", +r.dataset.id === t?.id));
});

// ---------- playlists ----------
export async function addToPlaylist(track) {
  if (!store.user) return bus.emit("need-auth", "Sign in to build playlists");
  let mine = [];
  try { mine = await api.get("/api/me/playlists"); } catch (e) { return toast(e.message, { error: true }); }
  const body = el(html`<div class="picker">
    <button data-new>${raw(`<span class="mini-art" style="display:grid;place-items:center;background:var(--graphite-3)">`)}${icon("plus")}${raw("</span>")}<span><b>New playlist</b></span></button>
    ${mine.map((p) => html`<button data-id="${p.id}"><span class="mini-art">${p.covers[0] ? coverArt(p.covers[0]) : coverArt(null, p.coverHue)}</span><span><b>${p.name}</b><br><span class="meta">${plural(p.trackCount, "song")}</span></span></button>`)}
  </div>`);
  modal({ title: `Add “${track.title}” to…`, body, onOpen: (b, close) => {
    b.addEventListener("click", async (e) => {
      const btn = e.target.closest("button"); if (!btn) return;
      try {
        let id = btn.dataset.id;
        if (btn.hasAttribute("data-new")) {
          const p = await api.post("/api/playlists", { name: track.title + " mix" });
          id = p.playlist.id;
        }
        const res = await api.post(`/api/playlists/${id}/tracks`, { trackId: track.id });
        close(); toast(`Added to ${res.playlist.name}`);
        bus.emit("playlists");
      } catch (err) { toast(err.message, { error: true }); }
    });
  } });
}

export function playlistForm(p = {}) {
  return el(html`<form class="form">
    <div class="field"><label for="pl-name">Name</label><input class="input" id="pl-name" name="name" maxlength="100" required value="${p.name || ""}" placeholder="Late night signals"></div>
    <div class="field"><label for="pl-desc">Description</label><textarea class="textarea" id="pl-desc" name="description" maxlength="400" placeholder="What's this playlist for?">${p.description || ""}</textarea></div>
    <label class="switch"><input type="checkbox" name="isPublic" ${p.isPublic === false ? "" : "checked"}><span class="switch__track"></span><span>Show on my profile and in search</span></label>
  </form>`);
}
export const readPlaylistForm = (b) => {
  const f = b.querySelector("form");
  return { name: f.name.value.trim(), description: f.description.value, isPublic: f.isPublic.checked };
};

// ---------- cards ----------
export function albumCard(a, { sub } = {}) {
  return html`<article class="card">
    <div class="card__art">${coverArt(a.coverSmallUrl, a.id * 47, "")}
      <div class="card__play"><button class="play-orb" data-play-album="${a.slug}" aria-label="Play ${a.title}">${icon("play")}</button></div></div>
    <div><a class="card__title card__link" href="/album/${a.slug}">${a.title}</a>
    <div class="card__sub">${sub ?? html`<a href="/artist/${a.artist.slug}">${a.artist.name}</a>`}</div></div>
  </article>`;
}

export function artistCard(a) {
  return html`<article class="card card--artist">
    <div class="card__art">${coverArt(a.imageUrl, 300, "")}</div>
    <div><a class="card__title card__link" href="/artist/${a.slug}">${a.name}</a><div class="card__sub">${a.genre || "Artist"}</div></div>
  </article>`;
}

export function playlistArt(p) {
  if (p.covers?.length >= 4) return html`<div class="mosaic">${p.covers.slice(0, 4).map((c) => html`<img src="${c}" alt="" loading="lazy">`)}</div>`;
  if (p.covers?.length) return coverArt(p.covers[0]);
  return coverArt(null, p.coverHue);
}

export function playlistCard(p) {
  return html`<article class="card">
    <div class="card__art">${playlistArt(p)}
      ${p.trackCount ? html`<div class="card__play"><button class="play-orb" data-play-playlist="${p.id}" aria-label="Play ${p.name}">${icon("play")}</button></div>` : ""}</div>
    <div><a class="card__title card__link" href="/playlist/${p.id}">${p.name}</a><div class="card__sub">${plural(p.trackCount, "song")} by ${p.ownerName}</div></div>
  </article>`;
}

// play buttons on cards fetch their tracks on demand
document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-play-album]"), p = e.target.closest("[data-play-playlist]");
  if (!a && !p) return;
  e.preventDefault(); e.stopPropagation();
  const img = (a || p).closest(".card")?.querySelector(".card__art img");
  try {
    if (a) {
      const d = await api.get(`/api/albums/${a.dataset.playAlbum}`);
      playTracks(d.tracks, 0, { label: d.album.title, href: `/album/${d.album.slug}` }, img);
    } else {
      const d = await api.get(`/api/playlists/${p.dataset.playPlaylist}`);
      playTracks(d.items.map((x) => x.track), 0, { label: d.playlist.name, href: `/playlist/${d.playlist.id}` }, img);
    }
  } catch (err) { toast(err.message, { error: true }); }
});

export function section(title, content, { link, cls = "" } = {}) {
  const s = el(html`<section class="section reveal ${cls}"><div class="section__head"><h2 class="h2">${title}</h2>${link ? html`<a class="section__link" href="${link.href}">${link.label}</a>` : ""}</div></section>`);
  s.appendChild(typeof content === "string" || content?.v ? el(`<div>${content}</div>`) : content);
  return s;
}

export function errorState(err, retry) {
  const box = el(html`<div class="page"><div class="empty"><h1 class="h2">${err.status === 404 ? "We couldn't find that" : "This page didn't load"}</h1>
    <p class="meta">${err.message}</p><div style="display:flex;gap:10px"><a class="btn" href="/">Go home</a>${retry ? raw('<button class="btn btn--primary" data-retry>Try again</button>') : ""}</div></div></div>`);
  box.querySelector("[data-retry]")?.addEventListener("click", retry);
  return box;
}

export { esc };
