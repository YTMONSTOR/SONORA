package com.sonora.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sonora.domain.Track;
import com.sonora.dto.Dtos.AiLyricsRequest;
import com.sonora.dto.Dtos.AiLyricsResult;
import com.sonora.dto.Dtos.AiStatus;
import com.sonora.repo.TrackRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Generates synchronized lyrics with OpenAI's speech-to-text API (whisper-1, word timestamps).
 * Works with any OpenAI-compatible endpoint via sonora.openai.base-url.
 */
@Service
public class AiLyricsService {
    private static final Logger log = LoggerFactory.getLogger(AiLyricsService.class);
    private static final long MAX_BYTES = 25L * 1024 * 1024; // OpenAI upload limit
    private static final Set<String> SUPPORTED = Set.of("mp3", "mp4", "m4a", "wav", "webm", "ogg", "oga", "flac", "mpga", "mpeg");
    private static final Map<String, String> MIME = Map.of("mp3", "audio/mpeg", "m4a", "audio/mp4", "mp4", "audio/mp4",
            "wav", "audio/wav", "ogg", "audio/ogg", "oga", "audio/ogg", "flac", "audio/flac", "webm", "audio/webm");

    private final TrackRepository tracks;
    private final StorageService storage;
    private final ObjectMapper json;
    private final HttpClient http;
    private final String apiKey, baseUrl, model;

    public AiLyricsService(TrackRepository tracks, StorageService storage, ObjectMapper json,
                           @Value("${sonora.openai.api-key:}") String apiKey,
                           @Value("${sonora.openai.base-url:https://api.openai.com/v1}") String baseUrl,
                           @Value("${sonora.openai.model:whisper-1}") String model) {
        this.tracks = tracks;
        this.storage = storage;
        this.json = json;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.model = model;
        // HTTP/1.1: large multipart uploads over HTTP/2 are more prone to resets behind VPNs and proxies
        this.http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(20)).build();
    }

    public AiStatus status() { return new AiStatus(!apiKey.isEmpty(), model); }

    /** Not transactional on purpose: the API call can take a while and must not hold a DB connection. */
    public AiLyricsResult generate(Long trackId, AiLyricsRequest req) {
        if (apiKey.isEmpty())
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI lyrics are off. Set OPENAI_API_KEY and restart SONORA.");
        Track t = tracks.findById(trackId).orElseThrow(() -> ApiException.notFound("Track"));
        Path file = storage.resolve(t.getAudioUrl());
        if (file == null || !Files.isRegularFile(file)) throw ApiException.bad("The audio file for this track is missing");
        String ext = StorageService.extension(file.getFileName().toString());
        if (!SUPPORTED.contains(ext)) throw ApiException.bad("OpenAI can't read ." + ext + " files. Upload this track as MP3.");
        long size;
        try { size = Files.size(file); } catch (IOException e) { throw ApiException.bad("Couldn't read the audio file"); }
        if (size > MAX_BYTES)
            throw ApiException.bad("This file is " + (size / 1024 / 1024) + " MB; OpenAI accepts up to 25 MB. Upload an MP3 version of the track.");

        List<String> known = LrcBuilder.plainLines(req == null ? null : req.text());
        String language = req == null || req.language() == null || req.language().isBlank() || "auto".equals(req.language())
                ? null : req.language().trim().toLowerCase();

        JsonNode res = transcribe(file, ext, language, known);
        List<LrcBuilder.Word> words = new ArrayList<>();
        for (JsonNode w : res.path("words")) words.add(new LrcBuilder.Word(w.path("word").asText(), w.path("start").asDouble(), w.path("end").asDouble()));
        if (words.isEmpty()) {
            // some compatible providers only return segments: treat each segment as one long "word"
            for (JsonNode s : res.path("segments")) words.add(new LrcBuilder.Word(s.path("text").asText(), s.path("start").asDouble(), s.path("end").asDouble()));
        }
        if (words.isEmpty()) throw ApiException.bad("The AI didn't hear any vocals in this track");

        boolean align = !known.isEmpty();
        List<LrcBuilder.Line> lines = align ? LrcBuilder.align(known, words) : LrcBuilder.linesFromWords(words);
        if (lines.isEmpty()) throw ApiException.bad("The AI didn't hear any vocals in this track");
        String lrc = LrcBuilder.toLrc(t.getTitle(), lines);

        boolean save = req != null && Boolean.TRUE.equals(req.save());
        if (save) tracks.updateLyrics(t.getId(), lrc);
        return new AiLyricsResult(lrc, lines.size(), align ? "align" : "transcribe", res.path("language").asText(language == null ? "" : language), save);
    }

    private JsonNode transcribe(Path file, String ext, String language, List<String> known) {
        String boundary = "----sonora" + UUID.randomUUID().toString().replace("-", "");
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        try {
            field(body, boundary, "model", model);
            field(body, boundary, "response_format", "verbose_json");
            field(body, boundary, "timestamp_granularities[]", "word");
            field(body, boundary, "timestamp_granularities[]", "segment");
            if (language != null) field(body, boundary, "language", language);
            if (!known.isEmpty()) {
                // the prompt steers spelling and vocabulary; only the last ~224 tokens are used, so keep it short
                String prompt = String.join(" ", known);
                field(body, boundary, "prompt", prompt.length() > 700 ? prompt.substring(0, 700) : prompt);
            }
            String filename = "track." + ("oga".equals(ext) ? "ogg" : ext);
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                    + "Content-Type: " + MIME.getOrDefault(ext, "application/octet-stream") + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(Files.readAllBytes(file));
            body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw ApiException.bad("Couldn't read the audio file");
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/audio/transcriptions"))
                .timeout(Duration.ofMinutes(4))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                .build();
        HttpResponse<String> res = null;
        for (int attempt = 1; res == null; attempt++) {
            try {
                res = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            } catch (IOException e) {
                log.warn("OpenAI request failed (attempt {}): {}", attempt, e.toString());
                if (attempt >= 3) throw new ApiException(HttpStatus.BAD_GATEWAY,
                        "Couldn't reach OpenAI: the connection was dropped. If a VPN, proxy or antivirus web filter is on, "
                        + "turn it off or switch server, then try again.");
                try { Thread.sleep(1500L * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        if (res == null) throw new ApiException(HttpStatus.BAD_GATEWAY, "The request to OpenAI was interrupted");

        if (res.statusCode() / 100 != 2) {
            String detail = "";
            try { detail = json.readTree(res.body()).path("error").path("message").asText(""); } catch (Exception ignored) { /* not JSON */ }
            log.warn("OpenAI transcription failed: HTTP {} {}", res.statusCode(), detail);
            String msg = switch (res.statusCode()) {
                case 401 -> "OpenAI rejected the API key. Check OPENAI_API_KEY.";
                case 429 -> "OpenAI says the account has no credit or hit its rate limit. Check billing at platform.openai.com.";
                case 413 -> "The file is too large for OpenAI (max 25 MB).";
                case 403 -> "OpenAI refused the request" + (detail.isEmpty() ? "." : ": " + detail);
                default -> "OpenAI couldn't process this track" + (detail.isEmpty() ? "." : ": " + detail);
            };
            throw new ApiException(HttpStatus.BAD_GATEWAY, msg);
        }
        try {
            return json.readTree(res.body());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "OpenAI returned an unexpected response");
        }
    }

    private static void field(ByteArrayOutputStream out, String boundary, String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n")
                .getBytes(StandardCharsets.UTF_8));
    }
}
