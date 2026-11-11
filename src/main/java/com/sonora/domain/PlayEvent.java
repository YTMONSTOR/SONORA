package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "play_events")
public class PlayEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Track track;
    @Column(nullable = false)
    private Instant playedAt = Instant.now();

    public PlayEvent() {}
    public PlayEvent(User user, Track track, Instant at) { this.user = user; this.track = track; this.playedAt = at; }
    public Long getId() { return id; }
    public User getUser() { return user; }
    public Track getTrack() { return track; }
    public Instant getPlayedAt() { return playedAt; }
}
