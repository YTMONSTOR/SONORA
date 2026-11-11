package com.sonora.api;

import com.sonora.dto.Dtos.*;
import com.sonora.service.CatalogService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CatalogController {
    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) { this.catalog = catalog; }

    @GetMapping("/home")
    public HomeDto home() { return catalog.home(); }

    @GetMapping("/search")
    public SearchDto search(@RequestParam(name = "q", defaultValue = "") String q) { return catalog.search(q); }

    @GetMapping("/artists/{slug}")
    public ArtistDetail artist(@PathVariable String slug) { return catalog.artist(slug); }

    @GetMapping("/albums/{slug}")
    public AlbumDetail album(@PathVariable String slug) { return catalog.album(slug); }

    @GetMapping("/tracks/{id}/lyrics")
    public LyricsDto lyrics(@PathVariable Long id) { return catalog.lyrics(id); }

    @PostMapping("/tracks/{id}/play")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void play(@PathVariable Long id) { catalog.recordPlay(id); }
}
