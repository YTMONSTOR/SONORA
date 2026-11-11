package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "playlist_tracks")
public class PlaylistTrack {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Playlist playlist;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Track track;
    @Column(name = "sort_order")
    private int position;
    @Column(nullable = false)
    private Instant addedAt = Instant.now();

    public Long getId() { return id; }
    public Playlist getPlaylist() { return playlist; }
    public void setPlaylist(Playlist v) { playlist = v; }
    public Track getTrack() { return track; }
    public void setTrack(Track v) { track = v; }
    public int getPosition() { return position; }
    public void setPosition(int v) { position = v; }
    public Instant getAddedAt() { return addedAt; }
}
