package com.sonora.api;

import com.sonora.dto.Dtos.*;
import com.sonora.service.LibraryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class LibraryController {
    private final LibraryService library;

    public LibraryController(LibraryService library) { this.library = library; }

    @GetMapping("/library")
    public LibraryDto library() { return library.library(); }

    @GetMapping("/me/likes")
    public List<Long> likes() { return library.likedIds(); }

    @PutMapping("/tracks/{id}/like")
    public Map<String, Boolean> like(@PathVariable Long id) { return Map.of("liked", library.setLike(id, true)); }

    @DeleteMapping("/tracks/{id}/like")
    public Map<String, Boolean> unlike(@PathVariable Long id) { return Map.of("liked", library.setLike(id, false)); }

    @GetMapping("/me/playlists")
    public List<PlaylistDto> mine() { return library.mine(); }

    @GetMapping("/playlists/{id}")
    public PlaylistDetail playlist(@PathVariable Long id) { return library.playlist(id); }

    @PostMapping("/playlists")
    @ResponseStatus(HttpStatus.CREATED)
    public PlaylistDetail create(@RequestBody PlaylistUpsert r) { return library.create(r); }

    @PatchMapping("/playlists/{id}")
    public PlaylistDetail update(@PathVariable Long id, @RequestBody PlaylistUpsert r) { return library.update(id, r); }

    @DeleteMapping("/playlists/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { library.delete(id); }

    @PostMapping("/playlists/{id}/tracks")
    public PlaylistDetail add(@PathVariable Long id, @RequestBody AddTrack r) { return library.addTrack(id, r.trackId()); }

    @DeleteMapping("/playlists/{id}/items/{itemId}")
    public PlaylistDetail remove(@PathVariable Long id, @PathVariable Long itemId) { return library.removeItem(id, itemId); }

    @PutMapping("/playlists/{id}/order")
    public PlaylistDetail reorder(@PathVariable Long id, @RequestBody Reorder r) { return library.reorder(id, r.itemIds()); }
}
