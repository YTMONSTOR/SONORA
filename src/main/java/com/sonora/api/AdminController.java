package com.sonora.api;

import com.sonora.dto.Dtos.*;
import com.sonora.service.AdminService;
import com.sonora.service.AiLyricsService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService admin;
    private final AiLyricsService ai;

    public AdminController(AdminService admin, AiLyricsService ai) { this.admin = admin; this.ai = ai; }

    @GetMapping("/ai/status")
    public AiStatus aiStatus() { return ai.status(); }

    /** Generates synced lyrics with AI. If "text" holds plain lyrics, only the timing is generated. */
    @PostMapping("/tracks/{id}/lyrics/ai")
    public AiLyricsResult aiLyrics(@PathVariable Long id, @RequestBody(required = false) AiLyricsRequest r) {
        return ai.generate(id, r);
    }

    @GetMapping("/stats")
    public AdminStats stats() { return admin.stats(); }

    @GetMapping("/users")
    public List<AdminUser> users() { return admin.users(); }

    @PatchMapping("/users/{id}")
    public AdminUser updateUser(@PathVariable Long id, @RequestBody RoleChange r) { return admin.updateUser(id, r); }

    @GetMapping("/tracks")
    public List<TrackDto> tracks() { return admin.tracks(); }

    @PatchMapping("/tracks/{id}")
    public TrackDto updateTrack(@PathVariable Long id, @RequestBody TrackUpdate r) { return admin.updateTrack(id, r); }

    @DeleteMapping("/tracks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTrack(@PathVariable Long id) { admin.deleteTrack(id); }

    @PostMapping(value = "/tracks", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public TrackDto upload(@RequestParam String title,
                           @RequestParam String artistName,
                           @RequestParam(required = false) String albumTitle,
                           @RequestParam(required = false) Integer year,
                           @RequestParam(required = false) Integer trackNo,
                           @RequestParam(required = false) Integer durationSec,
                           @RequestParam(required = false) String lyrics,
                           @RequestParam(required = false) String genre,
                           @RequestParam(required = false) String colorMain,
                           @RequestParam(required = false) String colorAccent,
                           @RequestParam("audio") MultipartFile audio,
                           @RequestParam(value = "cover", required = false) MultipartFile cover) {
        return admin.upload(title, artistName, albumTitle, year, trackNo, durationSec, lyrics, genre,
                colorMain, colorAccent, audio, cover);
    }
}
