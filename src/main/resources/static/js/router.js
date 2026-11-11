// Client-side router: persistent player, cinematic page transitions, deep links.
import { pageIn, pageOut, observeReveals } from "./motion.js";
import { store } from "./store.js";

const view = document.getElementById("view");
const routes = [
  { re: /^\/$/, page: "home", nav: "home" },
  { re: /^\/search\/?$/, page: "search", nav: "search" },
  { re: /^\/library\/?$/, page: "library", nav: "library", auth: true },
  { re: /^\/artist\/([^/]+)\/?$/, page: "artist", keys: ["slug"] },
  { re: /^\/album\/([^/]+)\/?$/, page: "album", keys: ["slug"] },
  { re: /^\/playlist\/(\d+)\/?$/, page: "playlist", keys: ["id"] },
  { re: /^\/profile\/?$/, page: "profile", nav: "profile", auth: true },
  { re: /^\/u\/([^/]+)\/?$/, page: "profile", keys: ["username"] },
  { re: /^\/settings\/?$/, page: "settings", nav: "settings" },
  { re: /^\/admin\/?$/, page: "admin", nav: "admin", auth: true, admin: true },
  { re: /^\/login\/?$/, page: "auth", nav: "profile", mode: "login" },
  { re: /^\/register\/?$/, page: "auth", nav: "profile", mode: "register" },
  { re: /^\/now-playing\/?$/, page: "nowplaying" },
  { re: /^\/lyrics\/?$/, page: "nowplaying", lyrics: true },
];

let current = null, navToken = 0;
const scrollPos = new Map();
history.scrollRestoration = "manual";

export function navigate(url, { replace = false } = {}) {
  const u = new URL(url, location.href);
  if (u.origin !== location.origin) { location.href = url; return; }
  scrollPos.set(location.pathname + location.search, scrollY);
  if (u.pathname + u.search === location.pathname + location.search && !replace) return;
  history[replace ? "replaceState" : "pushState"]({}, "", u.pathname + u.search + u.hash);
  render(false);
}

export async function render(isPop) {
  const token = ++navToken;
  const path = location.pathname;
  const route = routes.find((r) => r.re.test(path));
  if (!route) return show(await import("./pages/notfound.js"), { path }, token, isPop, null);

  if (route.auth && !store.user) return navigate(`/login?next=${encodeURIComponent(path + location.search)}`, { replace: true });
  if (route.admin && store.user?.role !== "ADMIN") return navigate("/", { replace: true });

  const m = path.match(route.re);
  const params = {};
  (route.keys || []).forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
  const ctx = { path, params, query: new URLSearchParams(location.search), route };
  const mod = await import(`./pages/${route.page}.js`);
  if (token !== navToken) return;
  return show(mod, ctx, token, isPop, route.nav);
}

async function show(mod, ctx, token, isPop, nav) {
  const out = pageOut(view);
  let page;
  try {
    [page] = await Promise.all([mod.default(ctx), out]);
  } catch (e) {
    await out;
    const { errorState } = await import("./components.js");
    page = { el: errorState(e, () => render(true)), title: "Error" };
  }
  if (token !== navToken) { page?.destroy?.(); return; }
  if (page?.redirect) return navigate(page.redirect, { replace: true });
  current?.destroy?.();
  current = page;
  view.replaceChildren(page.el);
  document.title = page.title ? `${page.title} — SONORA` : "SONORA";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.body.classList.toggle("tinted", !!page.accent);
  if (page.accent) document.body.style.setProperty("--accent", page.accent); else document.body.style.removeProperty("--accent");
  const key = location.pathname + location.search;
  scrollTo({ top: isPop ? scrollPos.get(key) || 0 : 0, behavior: "instant" });
  observeReveals(view);
  page.mounted?.();
  pageIn(view);
  if (!isPop) view.focus({ preventScroll: true });
}

export function initRouter() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download") || a.dataset.external != null) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname.startsWith("/media/") || u.pathname.startsWith("/api/")) return;
    e.preventDefault();
    navigate(u.pathname + u.search + u.hash);
  });
  addEventListener("popstate", () => render(true));
}

export const refresh = () => render(true);
