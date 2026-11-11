package com.sonora.service;

import com.sonora.domain.*;
import com.sonora.dto.Dtos.*;
import com.sonora.dto.Mapper;
import com.sonora.repo.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class LibraryService {
    private final TrackRepository tracks;
    private final TrackLikeRepository likes;
    private final PlaylistRepository playlists;
    private final PlaylistTrackRepository items;
    private final CatalogService catalog;
    private final CurrentUser currentUser;
    private final Mapper map;

    public LibraryService(TrackRepository tracks, TrackLikeRepository likes, PlaylistRepository playlists,
                          PlaylistTrackRepository items, CatalogService catalog, CurrentUser currentUser, Mapper map) {
        this.tracks = tracks;
        this.likes = likes;
        this.playlists = playlists;
        this.items = items;
        this.catalog = catalog;
        this.currentUser = currentUser;
        this.map = map;
    }

    @Transactional(readOnly = true)
    public LibraryDto library() {
        User u = currentUser.require();
        List<TrackLike> likedRows = likes.findForUser(u);
        List<TrackDto> liked = likedRows.stream().map(l -> map.track(l.getTrack())).toList();
        Map<Long, AlbumDto> albums = new LinkedHashMap<>();
        for (TrackLike l : likedRows) albums.computeIfAbsent(l.getTrack().getAlbum().getId(), k -> map.album(l.getTrack().getAlbum()));
        List<AlbumDto> albumList = new ArrayList<>(albums.values());
        return new LibraryDto(liked, myPlaylists(u), catalog.recentFor(u), albumList);
    }

    List<PlaylistDto> myPlaylists(User u) {
        return playlists.findByOwnerOrderByUpdatedAtDesc(u).stream().map(p -> map.playlist(p, items.findItems(p))).toList();
    }

    @Transactional(readOnly = true)
    public List<Long> likedIds() {
        return currentUser.find().map(likes::findTrackIds).orElse(List.of());
    }

    @Transactional
    public boolean setLike(Long trackId, boolean liked) {
        User u = currentUser.require();
        Track t = tracks.findById(trackId).orElseThrow(() -> ApiException.notFound("Track"));
        Optional<TrackLike> existing = likes.findByUserAndTrack(u, t);
        if (liked && existing.isEmpty()) likes.save(new TrackLike(u, t));
        if (!liked) existing.ifPresent(likes::delete);
        return liked;
    }

    @Transactional(readOnly = true)
    public List<PlaylistDto> mine() { return myPlaylists(currentUser.require()); }

    @Transactional(readOnly = true)
    public PlaylistDetail playlist(Long id) {
        Playlist p = playlists.findById(id).orElseThrow(() -> ApiException.notFound("Playlist"));
        Optional<User> me = currentUser.find();
        boolean owner = me.map(u -> u.getId().equals(p.getOwner().getId())).orElse(false);
        if (!p.isPublicPlaylist() && !owner) throw ApiException.notFound("Playlist");
        List<PlaylistTrack> list = items.findItems(p);
        return new PlaylistDetail(map.playlist(p, list), owner,
                list.stream().map(i -> new PlaylistItemDto(i.getId(), map.track(i.getTrack()))).toList());
    }

    @Transactional
    public PlaylistDetail create(PlaylistUpsert req) {
        User u = currentUser.require();
        Playlist p = new Playlist();
        p.setOwner(u);
        apply(p, req);
        if (req.coverHue() == null) p.setCoverHue(new Random().nextInt(360));
        playlists.save(p);
        return playlist(p.getId());
    }

    @Transactional
    public PlaylistDetail update(Long id, PlaylistUpsert req) {
        Playlist p = owned(id);
        apply(p, req);
        p.touch();
        return playlist(id);
    }

    private void apply(Playlist p, PlaylistUpsert req) {
        if (req.name() != null) {
            String name = req.name().trim();
            if (name.isEmpty() || name.length() > 100) throw ApiException.bad("Give the playlist a name up to 100 characters");
            p.setName(name);
        }
        if (p.getName() == null) throw ApiException.bad("Give the playlist a name");
        if (req.description() != null) p.setDescription(req.description().trim().isEmpty() ? null : trim(req.description(), 400));
        if (req.isPublic() != null) p.setPublicPlaylist(req.isPublic());
        if (req.coverHue() != null) p.setCoverHue(Math.floorMod(req.coverHue(), 360));
    }

    @Transactional
    public void delete(Long id) { playlists.delete(owned(id)); }

    @Transactional
    public PlaylistDetail addTrack(Long id, Long trackId) {
        Playlist p = owned(id);
        Track t = tracks.findById(trackId).orElseThrow(() -> ApiException.notFound("Track"));
        PlaylistTrack pt = new PlaylistTrack();
        pt.setPlaylist(p);
        pt.setTrack(t);
        pt.setPosition((int) items.countByPlaylist(p));
        p.getItems().add(pt);
        p.touch();
        items.save(pt);
        return playlist(id);
    }

    @Transactional
    public PlaylistDetail removeItem(Long id, Long itemId) {
        Playlist p = owned(id);
        p.getItems().removeIf(i -> i.getId().equals(itemId));
        int pos = 0;
        for (PlaylistTrack i : p.getItems()) i.setPosition(pos++);
        p.touch();
        return playlist(id);
    }

    @Transactional
    public PlaylistDetail reorder(Long id, List<Long> itemIds) {
        Playlist p = owned(id);
        Map<Long, PlaylistTrack> byId = new HashMap<>();
        p.getItems().forEach(i -> byId.put(i.getId(), i));
        if (itemIds == null || itemIds.size() != byId.size() || !byId.keySet().containsAll(itemIds))
            throw ApiException.bad("Reorder must include every item exactly once");
        for (int i = 0; i < itemIds.size(); i++) byId.get(itemIds.get(i)).setPosition(i);
        p.touch();
        return playlist(id);
    }

    private Playlist owned(Long id) {
        User u = currentUser.require();
        Playlist p = playlists.findById(id).orElseThrow(() -> ApiException.notFound("Playlist"));
        if (!p.getOwner().getId().equals(u.getId())) throw ApiException.forbidden();
        return p;
    }

    static String trim(String s, int max) {
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
