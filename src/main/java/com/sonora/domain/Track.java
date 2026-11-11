package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "tracks")
public class Track {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 160)
    private String title;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Album album;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Artist artist;
    private int trackNo = 1;
    private int durationSec;
    private int bpm;
    @Column(nullable = false, length = 300)
    private String audioUrl;
    /** Synchronized lyrics in LRC format ([mm:ss.xx]line). */
    @Column(length = 20000)
    private String lyrics;
    private long plays;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String v) { title = v; }
    public Album getAlbum() { return album; }
    public void setAlbum(Album v) { album = v; }
    public Artist getArtist() { return artist; }
    public void setArtist(Artist v) { artist = v; }
    public int getTrackNo() { return trackNo; }
    public void setTrackNo(int v) { trackNo = v; }
    public int getDurationSec() { return durationSec; }
    public void setDurationSec(int v) { durationSec = v; }
    public int getBpm() { return bpm; }
    public void setBpm(int v) { bpm = v; }
    public String getAudioUrl() { return audioUrl; }
    public void setAudioUrl(String v) { audioUrl = v; }
    public String getLyrics() { return lyrics; }
    public void setLyrics(String v) { lyrics = v; }
    public long getPlays() { return plays; }
    public void setPlays(long v) { plays = v; }
    public Instant getCreatedAt() { return createdAt; }
}
