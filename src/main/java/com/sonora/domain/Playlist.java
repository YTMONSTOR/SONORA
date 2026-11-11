package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "playlists")
public class Playlist {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(length = 400)
    private String description;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User owner;
    private boolean publicPlaylist = true;
    private int coverHue = 270;
    @OneToMany(mappedBy = "playlist", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<PlaylistTrack> items = new ArrayList<>();
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { name = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { description = v; }
    public User getOwner() { return owner; }
    public void setOwner(User v) { owner = v; }
    public boolean isPublicPlaylist() { return publicPlaylist; }
    public void setPublicPlaylist(boolean v) { publicPlaylist = v; }
    public int getCoverHue() { return coverHue; }
    public void setCoverHue(int v) { coverHue = v; }
    public List<PlaylistTrack> getItems() { return items; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void touch() { updatedAt = Instant.now(); }
}
