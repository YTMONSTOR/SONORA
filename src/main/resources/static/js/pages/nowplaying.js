import { html, el } from "../util.js";
import { openNP } from "../player.js";

export default async function nowplaying({ route }) {
  const root = el(html`<div class="page"><div class="empty" style="padding-top:12vh"><h1 class="h1">Nothing is playing</h1>
    <p class="meta">Choose an album or a song and the full-screen player opens here.</p><a class="btn btn--primary" href="/">Browse music</a></div></div>`);
  return { el: root, title: "Now playing", mounted: () => openNP({ lyrics: !!route.lyrics }) };
}
