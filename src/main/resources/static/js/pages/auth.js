import { api } from "../api.js";
import { html, el } from "../util.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { toast } from "../components.js";

export default async function auth({ route, query }) {
  const login = route.mode === "login";
  const next = query.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (store.user) return { redirect: safeNext, el: el("<div></div>") };
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const root = el(html`<div class="auth">
    <div class="auth__visual" aria-hidden="true"><div class="fallback-stage"><div class="vinyl-css" style="margin:0;width:min(46vmin,420px)"></div></div></div>
    <div class="auth__card">
      <div><h1 class="h1">${login ? "Welcome back" : "Create your account"}</h1>
      <p class="meta" style="margin-top:12px;font-size:1rem">${login ? "Sign in to your library, playlists and listening history." : "Save songs, build playlists and pick up where you left off on any device."}</p></div>
      <form class="form" novalidate>
        ${login ? "" : html`<div class="form-row">
          <div class="field"><label for="f-dn">Display name</label><input class="input" id="f-dn" name="displayName" autocomplete="nickname" maxlength="80"></div>
          <div class="field"><label for="f-em">Email</label><input class="input" id="f-em" name="email" type="email" autocomplete="email" required></div></div>`}
        <div class="field"><label for="f-un">Username</label><input class="input" id="f-un" name="username" autocomplete="username" required minlength="3" maxlength="30" autocapitalize="none" spellcheck="false"></div>
        <div class="field"><label for="f-pw">Password</label><input class="input" id="f-pw" name="password" type="password" autocomplete="${login ? "current-password" : "new-password"}" required minlength="8">
          ${login ? "" : html`<span class="hint">At least 8 characters.</span>`}</div>
        <div class="error-text" id="f-err" role="alert"></div>
        <button class="btn btn--primary magnetic" type="submit" style="justify-self:start">${login ? "Sign in" : "Create account"}</button>
      </form>
      ${login && local ? html`<div class="demo-hint">Local demo accounts: <b>demo</b> / <b>sonora-demo</b> or <b>admin</b> / <b>sonora-admin</b>.</div>` : ""}
      <p class="auth__alt">${login ? html`New to SONORA? <a href="/register${next ? `?next=${encodeURIComponent(next)}` : ""}">Create an account</a>` : html`Already have an account? <a href="/login${next ? `?next=${encodeURIComponent(next)}` : ""}">Sign in</a>`}</p>
    </div>
  </div>`);
  const form = root.querySelector("form"), err = root.querySelector("#f-err"), btn = form.querySelector("button[type=submit]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const v = Object.fromEntries(new FormData(form));
    if (!v.username || !v.password) { err.textContent = "Enter your username and password."; return; }
    btn.disabled = true;
    try {
      const res = await api.post(login ? "/api/auth/login" : "/api/auth/register", v);
      store.setUser(res.user);
      await store.refreshLikes();
      toast(login ? `Welcome back, ${res.user.displayName}` : "Account created");
      navigate(safeNext, { replace: true });
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });
  return { el: root, title: login ? "Sign in" : "Create account", mounted: () => form.querySelector("input").focus({ preventScroll: true }) };
}
