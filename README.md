# SONORA

A music streaming platform with a real-time 3D interface.

- **Backend:** Java 17, Spring Boot 3.3, Spring Security and PostgreSQL.
- **Frontend:** a vanilla-JS single-page app with Three.js and GSAP. Music keeps playing while you move between pages.

## Run it (Windows)

You need **JDK 17 or newer** and **Maven**; IntelliJ IDEA bundles both. You also need **PostgreSQL** for the default setup.

### Option A: PostgreSQL (default)

1. Start PostgreSQL. Either run `docker compose up -d` in this folder, or install PostgreSQL and create the database:
   ```sql
   CREATE USER sonora WITH PASSWORD 'sonora';
   CREATE DATABASE sonora OWNER sonora;
   ```
2. In this folder, run:
   ```
   mvn spring-boot:run
   ```
   In IntelliJ, you can instead open the folder and run `SonoraApplication`.
3. Open http://localhost:8080

### Option B: no database setup (H2 file database)

```
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

### Demo accounts

These are created on first start:

| Username | Password       | Role  |
|----------|----------------|-------|
| `demo`   | `sonora-demo`  | Listener with playlists and likes |
| `admin`  | `sonora-admin` | Admin dashboard and uploads |

Change them with the `SONORA_ADMIN_PASSWORD` / `SONORA_DEMO_PASSWORD` environment variables before the first start if the app will be reachable by anyone else.

## AI lyrics (OpenAI)

SONORA can write synced lyrics for a track with OpenAI's speech-to-text (`whisper-1`, about $0.006 per minute of audio).

1. Create an API key at https://platform.openai.com/api-keys and add a little credit to the account.
2. Give SONORA the key, either as the `OPENAI_API_KEY` environment variable or in a file `config/application.properties` next to `pom.xml`:
   ```
   sonora.openai.api-key=sk-...
   ```
   The `config/` folder is git-ignored so the key isn't committed.
3. Restart SONORA. In **Admin → Upload**, keep "Generate synced lyrics with AI" on. In **Admin → Tracks → edit**, use "Generate with AI".

Paste plain lyrics (no timestamps) and the AI only adds the timing, keeping your text exactly. Leave the field empty and it writes the words down itself. Files must be 25 MB or smaller (OpenAI's limit).

Any OpenAI-compatible endpoint works too: set `OPENAI_BASE_URL` and `OPENAI_TRANSCRIBE_MODEL`.

## Configuration

| Variable | Default |
|---|---|
| `SONORA_DB_URL` | `jdbc:postgresql://localhost:5432/sonora` |
| `SONORA_DB_USER` / `SONORA_DB_PASSWORD` | `sonora` / `sonora` |
| `SONORA_STORAGE` | `./sonora-data` (uploaded audio and covers; demo media is copied here on first start) |
| `PORT` | `8080` |

## What's inside

- **Demo catalogue:** 3 artists, 4 albums and 8 tracks. All of it is original: synthesized music, original lyrics with LRC timestamps, and generative cover art. Nothing is copyrighted.
- **3D:** Three.js r170 loaded from jsDelivr, so the browser needs internet access. The scenes are:
  - **Hero:** a chrome vinyl monolith in a ring of live spectrum bars, with an iridescent disc, a glass torus-knot sculpture, headphones, floating records and particles.
  - **Album discovery:** sleeves on a curved arc. Hover lights a sleeve and slides its record out. Selecting the centre album pulls the record free and flies the cover into the player.
  - **Full-screen player:** a turntable whose tonearm drops onto the record while it plays.
- **Audio reactivity:** a Web Audio `AnalyserNode` reads the real frequencies of the playing track and drives every visual.
- **Quality tiers:** auto-detected from the device (cores, memory, screen) or chosen in Settings. Phones get fewer particles, no shadows and no glass transmission. Reduced motion is respected. Without WebGL there's a CSS fallback.
- **Synchronized lyrics:** parsed from LRC and synced every frame against `audio.currentTime` with a binary search. Click any line to seek to it.
- **Custom 3D model:** to use your own GLB headphones model, put it in `src/main/resources/static/assets/models/` and add this to `index.html`:
  `<meta name="sonora-model-headphones" content="/assets/models/your-model.glb">`

### Project layout

```
src/main/java/com/sonora/      domain · repo · service · api (REST) · config (security, seeding) · web (SPA routes)
src/main/resources/static/     index.html · css/sonora.css · js/ (router, audio engine, player, lyrics, pages/, three/)
src/main/resources/seed/       demo audio, lyrics, covers, artist images, catalog.json
```

### Security notes

- Sessions use HttpOnly cookies, with CSRF protection via the `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header.
- A strict Content-Security-Policy is applied. If you edit the import map in `index.html`, update its `sha256-…` hash in `SecurityConfig`.
