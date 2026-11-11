package com.sonora.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sonora.domain.*;
import com.sonora.dto.Dtos.*;
import org.springframework.stereotype.Component;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Component
public class Mapper {
    private static final DateTimeFormatter MONTH_YEAR = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH)
            .withZone(ZoneOffset.UTC);
    private final ObjectMapper json;

    public Mapper(ObjectMapper json) { this.json = json; }

    public ArtistRef ref(Artist a) { return new ArtistRef(a.getId(), a.getSlug(), a.getName()); }

    public List<String> palette(Album a) { return List.of(a.getColorBase(), a.getColorMain(), a.getColorAccent()); }

    public AlbumRef ref(Album a) {
        return new AlbumRef(a.getId(), a.getSlug(), a.getTitle(), a.getCoverUrl(), a.getCoverSmallUrl(), palette(a));
    }

    public UserDto user(User u) {
        JsonNode settings;
        try { settings = json.readTree(u.getSettingsJson() == null ? "{}" : u.getSettingsJson()); }
        catch (Exception e) { settings = json.createObjectNode(); }
        return new UserDto(u.getId(), u.getUsername(), u.getDisplayName(), u.getEmail(), u.getBio(),
                u.getRole().name(), u.getAvatarHue(), settings, MONTH_YEAR.format(u.getCreatedAt()));
    }

    public ArtistDto artist(Artist a) {
        return new ArtistDto(a.getId(), a.getSlug(), a.getName(), a.getGenre(), a.getBio(),
                a.getImageUrl(), a.getBannerUrl(), a.getAccentColor());
    }

    public AlbumDto album(Album a) {
        return new AlbumDto(a.getId(), a.getSlug(), a.getTitle(), a.getReleaseYear(), a.getCoverUrl(),
                a.getCoverSmallUrl(), palette(a), ref(a.getArtist()));
    }

    public TrackDto track(Track t) {
        return new TrackDto(t.getId(), t.getTitle(), t.getDurationSec(), t.getTrackNo(), t.getBpm(), t.getAudioUrl(),
                t.getPlays(), t.getLyrics() != null && !t.getLyrics().isBlank(), ref(t.getAlbum()), ref(t.getArtist()));
    }

    public List<TrackDto> tracks(List<Track> ts) { return ts.stream().map(this::track).toList(); }
    public List<AlbumDto> albums(List<Album> as) { return as.stream().map(this::album).toList(); }

    public PlaylistDto playlist(Playlist p, List<PlaylistTrack> items) {
        int dur = items.stream().mapToInt(i -> i.getTrack().getDurationSec()).sum();
        List<String> covers = items.stream().map(i -> i.getTrack().getAlbum().getCoverSmallUrl())
                .distinct().limit(4).toList();
        return new PlaylistDto(p.getId(), p.getName(), p.getDescription(), p.getOwner().getUsername(),
                p.getOwner().getDisplayName(), p.isPublicPlaylist(), p.getCoverHue(), items.size(), dur, covers);
    }
}
