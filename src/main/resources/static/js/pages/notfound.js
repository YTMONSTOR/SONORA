import { html, el } from "../util.js";

export default async function notfound() {
  return { el: el(html`<div class="page"><div class="empty" style="padding-top:12vh"><h1 class="h1">This page is off the record</h1>
    <p class="meta">The link may be broken, or the page was removed.</p><a class="btn btn--primary" href="/">Go home</a></div></div>`), title: "Not found" };
}
