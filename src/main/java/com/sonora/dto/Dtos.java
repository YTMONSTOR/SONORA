package com.sonora.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/** JSON shapes returned by the REST API. */
public final class Dtos {
    private Dtos() {}

    public record ArtistRef(Long id, String slug, String name) {}
    public record AlbumRef(Long id, String slug, String title, String coverUrl, String coverSmallUrl, List<String> palette) {}

    public record UserDto(Long id, String username, String displayName, String email, String bio,
                          String role, int avatarHue, JsonNode settings, String memberSince) {}

    public record ArtistDto(Long id, String slug, String name, String genre, String bio,
                            String imageUrl, String bannerUrl, String accentColor) {}

    public record AlbumDto(Long id, String slug, String title, int year, String coverUrl, String coverSmallUrl,
                           List<String> palette, ArtistRef artist) {}

    public record TrackDto(Long id, String title, int durationSec, int trackNo, int bpm, String audioUrl,
                           long plays, boolean hasLyrics, AlbumRef album, ArtistRef artist) {}

    public record PlaylistDto(Long id, String name, String description, String ownerUsername, String ownerName,
                              boolean isPublic, int coverHue, int trackCount, int durationSec, List<String> covers) {}

    public record PlaylistItemDto(Long itemId, TrackDto track) {}

    public record PlaylistDetail(PlaylistDto playlist, boolean editable, List<PlaylistItemDto> items) {}

    public record AlbumDetail(AlbumDto album, List<TrackDto> tracks, int durationSec, List<AlbumDto> moreByArtist) {}

    public record ArtistDetail(ArtistDto artist, List<TrackDto> topTracks, List<AlbumDto> albums, long totalPlays) {}

    public record HomeDto(AlbumDto featured, List<TrackDto> featuredTracks, List<AlbumDto> albums,
                          List<TrackDto> trending, List<ArtistDto> artists, List<PlaylistDto> playlists,
                          List<TrackDto> recent) {}

    public record SearchDto(String query, List<TrackDto> tracks, List<AlbumDto> albums,
                            List<ArtistDto> artists, List<PlaylistDto> playlists) {}

    public record LibraryDto(List<TrackDto> liked, List<PlaylistDto> playlists, List<TrackDto> recent,
                             List<AlbumDto> albums) {}

    public record ProfileDto(UserDto user, long likes, long playlists, long plays, long minutesListened,
                             List<ArtistDto> topArtists, List<PlaylistDto> publicPlaylists) {}

    public record LyricsDto(Long trackId, String lrc) {}

    public record DayCount(String day, long plays) {}

    public record AdminStats(long users, long tracks, long albums, long artists, long playlists, long totalPlays,
                             List<DayCount> playsByDay, List<TrackDto> topTracks) {}

    public record AdminUser(Long id, String username, String displayName, String email, String role,
                            boolean enabled, String createdAt, long playlists, long likes) {}

    // ---- requests ----
    public record LoginRequest(String username, String password) {}
    public record RegisterRequest(String username, String email, String password, String displayName) {}
    public record ProfileUpdate(String displayName, String email, String bio, Integer avatarHue) {}
    public record PasswordChange(String currentPassword, String newPassword) {}
    public record PlaylistUpsert(String name, String description, Boolean isPublic, Integer coverHue) {}
    public record AddTrack(Long trackId) {}
    public record Reorder(List<Long> itemIds) {}
    public record RoleChange(String role, Boolean enabled) {}
    public record TrackUpdate(String title, String lyrics, Integer trackNo) {}
    public record Message(String message) {}
    public record AiLyricsRequest(String language, String text, Boolean save) {}
    public record AiLyricsResult(String lrc, int lines, String mode, String language, boolean saved) {}
    public record AiStatus(boolean enabled, String model) {}
}
