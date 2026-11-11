package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "artists")
public class Artist {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 120)
    private String slug;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(length = 80)
    private String genre;
    @Column(length = 1200)
    private String bio;
    @Column(length = 300)
    private String imageUrl;
    @Column(length = 300)
    private String bannerUrl;
    @Column(length = 9)
    private String accentColor = "#8b5cf6";
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getSlug() { return slug; }
    public void setSlug(String v) { slug = v; }
    public String getName() { return name; }
    public void setName(String v) { name = v; }
    public String getGenre() { return genre; }
    public void setGenre(String v) { genre = v; }
    public String getBio() { return bio; }
    public void setBio(String v) { bio = v; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String v) { imageUrl = v; }
    public String getBannerUrl() { return bannerUrl; }
    public void setBannerUrl(String v) { bannerUrl = v; }
    public String getAccentColor() { return accentColor; }
    public void setAccentColor(String v) { accentColor = v; }
    public Instant getCreatedAt() { return createdAt; }
}
