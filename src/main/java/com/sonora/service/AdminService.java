package com.sonora.service;

import com.sonora.domain.*;
import com.sonora.dto.Dtos.*;
import com.sonora.dto.Mapper;
import com.sonora.repo.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class AdminService {
    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private final UserRepository users;
    private final ArtistRepository artists;
    private final AlbumRepository albums;
    private final TrackRepository tracks;
    private final PlaylistRepository playlists;
    private final PlaylistTrackRepository playlistTracks;
    private final TrackLikeRepository likes;
    private final PlayEventRepository plays;
    private final StorageService storage;
    private final CurrentUser currentUser;
    private final Mapper map;

    public AdminService(UserRepository users, ArtistRepository artists, AlbumRepository albums, TrackRepository tracks,
                        PlaylistRepository playlists, PlaylistTrackRepository playlistTracks, TrackLikeRepository likes,
                        PlayEventRepository plays, StorageService storage, CurrentUser currentUser, Mapper map) {
        this.users = users;
        this.artists = artists;
        this.albums = albums;
        this.tracks = tracks;
        this.playlists = playlists;
        this.playlistTracks = playlistTracks;
        this.likes = likes;
        this.plays = plays;
        this.storage = storage;
        this.currentUser = currentUser;
        this.map = map;
    }

    @Transactional(readOnly = true)
    public AdminStats stats() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate first = today.minusDays(13);
        Map<LocalDate, Long> buckets = new TreeMap<>();
        for (int i = 0; i < 14; i++) buckets.put(first.plusDays(i), 0L);
        for (Instant t : plays.findTimesSince(first.atStartOfDay().toInstant(ZoneOffset.UTC))) {
            buckets.merge(LocalDate.ofInstant(t, ZoneOffset.UTC), 1L, Long::sum);
        }
        List<DayCount> byDay = buckets.entrySet().stream().map(e -> new DayCount(e.getKey().toString(), e.getValue())).toList();
        long totalPlays = tracks.findAll().stream().mapToLong(Track::getPlays).sum();
        return new AdminStats(users.count(), tracks.count(), albums.count(), artists.count(), playlists.count(),
                totalPlays, byDay, map.tracks(tracks.findAllByOrderByPlaysDesc(PageRequest.of(0, 5))));
    }

    @Transactional(readOnly = true)
    public List<AdminUser> users() {
        return users.findAllByOrderByCreatedAtDesc().stream().map(u -> new AdminUser(u.getId(), u.getUsername(),
                u.getDisplayName(), u.getEmail(), u.getRole().name(), u.isEnabled(), u.getCreatedAt().toString(),
                playlists.countByOwner(u), likes.countByUser(u))).toList();
    }

    @Transactional
    public AdminUser updateUser(Long id, RoleChange r) {
        User me = currentUser.require();
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        if (u.getId().equals(me.getId())) throw ApiException.bad("You can't change your own role or access");
        if (r.role() != null) {
            try { u.setRole(Role.valueOf(r.role().toUpperCase(Locale.ROOT))); }
            catch (IllegalArgumentException e) { throw ApiException.bad("Unknown role"); }
        }
        if (r.enabled() != null) u.setEnabled(r.enabled());
        return new AdminUser(u.getId(), u.getUsername(), u.getDisplayName(), u.getEmail(), u.getRole().name(),
                u.isEnabled(), u.getCreatedAt().toString(), playlists.countByOwner(u), likes.countByUser(u));
    }

    @Transactional(readOnly = true)
    public List<TrackDto> tracks() { return map.tracks(tracks.findAllByOrderByCreatedAtDesc()); }

    @Transactional
    public TrackDto updateTrack(Long id, TrackUpdate r) {
        Track t = tracks.findById(id).orElseThrow(() -> ApiException.notFound("Track"));
        if (r.title() != null && !r.title().isBlank()) t.setTitle(LibraryService.trim(r.title(), 160));
        if (r.lyrics() != null) t.setLyrics(r.lyrics().isBlank() ? null : LibraryService.trim(r.lyrics(), 20000));
        if (r.trackNo() != null && r.trackNo() > 0) t.setTrackNo(r.trackNo());
        return map.track(tracks.findAllWithRefs(List.of(t.getId())).get(0));
    }

    @Transactional
    public void deleteTrack(Long id) {
        Track t = tracks.findById(id).orElseThrow(() -> ApiException.notFound("Track"));
        Album album = t.getAlbum();
        playlistTracks.deleteByTrack(t);
        likes.deleteByTrack(t);
        plays.deleteByTrack(t);
        String audio = t.getAudioUrl();
        tracks.delete(t);
        tracks.flush();
        if (!audio.startsWith("/media/seed/")) storage.deleteQuietly(audio);
        if (tracks.countByAlbum(album) == 0) albums.delete(album);
    }

    @Transactional
    public TrackDto upload(String title, String artistName, String albumTitle, Integer year, Integer trackNo,
                           Integer durationSec, String lyrics, String genre, String colorMain, String colorAccent,
                           MultipartFile audio, MultipartFile cover) {
        if (title == null || title.isBlank()) throw ApiException.bad("Track title is required");
        if (artistName == null || artistName.isBlank()) throw ApiException.bad("Artist name is required");
        if (audio == null || audio.isEmpty()) throw ApiException.bad("Choose an audio file");
        String albumName = albumTitle == null || albumTitle.isBlank() ? title.trim() + " — Single" : albumTitle.trim();

        Artist artist = artists.findByNameIgnoreCase(artistName.trim()).orElseGet(() -> {
            Artist a = new Artist();
            a.setName(LibraryService.trim(artistName, 120));
            a.setSlug(Slugs.unique(artistName, s -> artists.findBySlug(s).isPresent()));
            a.setGenre(genre == null || genre.isBlank() ? null : LibraryService.trim(genre, 80));
            if (valid(colorMain)) a.setAccentColor(colorMain);
            return artists.save(a);
        });

        Album album = albums.findByArtistOrderByReleaseYearDesc(artist).stream()
                .filter(a -> a.getTitle().equalsIgnoreCase(albumName)).findFirst().orElseGet(() -> {
                    Album a = new Album();
                    a.setTitle(LibraryService.trim(albumName, 140));
                    a.setSlug(Slugs.unique(artist.getName() + " " + albumName, s -> albums.findBySlug(s).isPresent()));
                    a.setArtist(artist);
                    a.setReleaseYear(year == null ? Year.now().getValue() : year);
                    return albums.save(a);
                });
        if (cover != null && !cover.isEmpty()) {
            String url = storage.save(cover, "covers", StorageService.IMAGE);
            album.setCoverUrl(url);
            album.setCoverSmallUrl(url);
            if (artist.getImageUrl() == null) artist.setImageUrl(url);
        }
        if (valid(colorMain)) album.setColorMain(colorMain);
        if (valid(colorAccent)) album.setColorAccent(colorAccent);

        Track t = new Track();
        t.setTitle(LibraryService.trim(title, 160));
        t.setArtist(artist);
        t.setAlbum(album);
        t.setTrackNo(trackNo == null || trackNo < 1 ? (int) tracks.countByAlbum(album) + 1 : trackNo);
        t.setDurationSec(durationSec == null || durationSec < 0 ? 0 : durationSec);
        t.setLyrics(lyrics == null || lyrics.isBlank() ? null : LibraryService.trim(lyrics, 20000));
        t.setAudioUrl(storage.save(audio, "audio", StorageService.AUDIO));
        tracks.save(t);
        return map.track(t);
    }

    private static boolean valid(String hex) { return hex != null && HEX.matcher(hex).matches(); }
}
