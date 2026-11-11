package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "albums")
public class Album {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 140)
    private String slug;
    @Column(nullable = false, length = 140)
    private String title;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Artist artist;
    private int releaseYear;
    @Column(length = 300)
    private String coverUrl;
    @Column(length = 300)
    private String coverSmallUrl;
    @Column(length = 9) private String colorBase = "#120a24";
    @Column(length = 9) private String colorMain = "#8b5cf6";
    @Column(length = 9) private String colorAccent = "#a3ff5c";
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getSlug() { return slug; }
    public void setSlug(String v) { slug = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { title = v; }
    public Artist getArtist() { return artist; }
    public void setArtist(Artist v) { artist = v; }
    public int getReleaseYear() { return releaseYear; }
    public void setReleaseYear(int v) { releaseYear = v; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String v) { coverUrl = v; }
    public String getCoverSmallUrl() { return coverSmallUrl; }
    public void setCoverSmallUrl(String v) { coverSmallUrl = v; }
    public String getColorBase() { return colorBase; }
    public void setColorBase(String v) { colorBase = v; }
    public String getColorMain() { return colorMain; }
    public void setColorMain(String v) { colorMain = v; }
    public String getColorAccent() { return colorAccent; }
    public void setColorAccent(String v) { colorAccent = v; }
    public Instant getCreatedAt() { return createdAt; }
}
