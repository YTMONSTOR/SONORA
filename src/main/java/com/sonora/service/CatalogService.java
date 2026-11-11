package com.sonora.service;

import com.sonora.domain.*;
import com.sonora.dto.Dtos.*;
import com.sonora.dto.Mapper;
import com.sonora.repo.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class CatalogService {
    private final ArtistRepository artists;
    private final AlbumRepository albums;
    private final TrackRepository tracks;
    private final PlaylistRepository playlists;
    private final PlaylistTrackRepository playlistTracks;
    private final PlayEventRepository plays;
    private final CurrentUser currentUser;
    private final Mapper map;

    public CatalogService(ArtistRepository artists, AlbumRepository albums, TrackRepository tracks,
                          PlaylistRepository playlists, PlaylistTrackRepository playlistTracks,
                          PlayEventRepository plays, CurrentUser currentUser, Mapper map) {
        this.artists = artists;
        this.albums = albums;
        this.tracks = tracks;
        this.playlists = playlists;
        this.playlistTracks = playlistTracks;
        this.plays = plays;
        this.currentUser = currentUser;
        this.map = map;
    }

    @Transactional(readOnly = true)
    public HomeDto home() {
        List<Album> all = albums.findAllByOrderByReleaseYearDescCreatedAtDesc();
        Album featured = all.isEmpty() ? null : all.get(0);
        List<TrackDto> featuredTracks = featured == null ? List.of() : map.tracks(tracks.findByAlbumOrderByTrackNoAsc(featured));
        List<TrackDto> trending = map.tracks(tracks.findAllByOrderByPlaysDesc(PageRequest.of(0, 10)));
        List<PlaylistDto> pls = playlists.findTop8ByPublicPlaylistTrueOrderByUpdatedAtDesc().stream()
                .map(p -> map.playlist(p, playlistTracks.findItems(p))).filter(p -> p.trackCount() > 0).toList();
        List<TrackDto> recent = currentUser.find().map(this::recentFor).orElse(List.of());
        return new HomeDto(featured == null ? null : map.album(featured), featuredTracks, map.albums(all), trending,
                artists.findAllByOrderByNameAsc().stream().map(map::artist).toList(), pls, recent);
    }

    List<TrackDto> recentFor(User u) {
        LinkedHashMap<Long, TrackDto> unique = new LinkedHashMap<>();
        for (PlayEvent e : plays.findRecent(u, PageRequest.of(0, 40))) {
            unique.putIfAbsent(e.getTrack().getId(), map.track(e.getTrack()));
            if (unique.size() >= 8) break;
        }
        return new ArrayList<>(unique.values());
    }

    @Transactional(readOnly = true)
    public SearchDto search(String raw) {
        String q = raw == null ? "" : raw.trim();
        if (q.isEmpty()) return new SearchDto("", List.of(), List.of(), List.of(), List.of());
        if (q.length() > 80) q = q.substring(0, 80);
        List<TrackDto> t = map.tracks(tracks.search(q).stream().limit(20).toList());
        List<AlbumDto> al = map.albums(albums.findByTitleContainingIgnoreCase(q));
        Set<Long> albumIds = new HashSet<>();
        al.forEach(a -> albumIds.add(a.id()));
        List<AlbumDto> merged = new ArrayList<>(al);
        // albums by matching artists also belong in the results
        List<Artist> ar = artists.findByNameContainingIgnoreCaseOrGenreContainingIgnoreCase(q, q);
        for (Artist a : ar)
            for (Album x : albums.findByArtistOrderByReleaseYearDesc(a))
                if (albumIds.add(x.getId())) merged.add(map.album(x));
        List<PlaylistDto> pl = playlists.findByPublicPlaylistTrueAndNameContainingIgnoreCase(q).stream()
                .map(p -> map.playlist(p, playlistTracks.findItems(p))).toList();
        return new SearchDto(q, t, merged, ar.stream().map(map::artist).toList(), pl);
    }

    @Transactional(readOnly = true)
    public ArtistDetail artist(String slug) {
        Artist a = artists.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Artist"));
        List<Track> ts = tracks.findByArtistOrderByPlaysDesc(a);
        long total = ts.stream().mapToLong(Track::getPlays).sum();
        return new ArtistDetail(map.artist(a), map.tracks(ts.stream().limit(10).toList()),
                map.albums(albums.findByArtistOrderByReleaseYearDesc(a)), total);
    }

    @Transactional(readOnly = true)
    public AlbumDetail album(String slug) {
        Album a = albums.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Album"));
        List<Track> ts = tracks.findByAlbumOrderByTrackNoAsc(a);
        List<AlbumDto> more = albums.findByArtistOrderByReleaseYearDesc(a.getArtist()).stream()
                .filter(x -> !x.getId().equals(a.getId())).map(map::album).toList();
        return new AlbumDetail(map.album(a), map.tracks(ts), ts.stream().mapToInt(Track::getDurationSec).sum(), more);
    }

    @Transactional(readOnly = true)
    public LyricsDto lyrics(Long trackId) {
        Track t = tracks.findById(trackId).orElseThrow(() -> ApiException.notFound("Track"));
        return new LyricsDto(t.getId(), t.getLyrics() == null ? "" : t.getLyrics());
    }

    @Transactional
    public void recordPlay(Long trackId) {
        Track t = tracks.findById(trackId).orElseThrow(() -> ApiException.notFound("Track"));
        tracks.incrementPlays(t.getId());
        plays.save(new PlayEvent(currentUser.find().orElse(null), t, java.time.Instant.now()));
    }
}
