package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "track_likes", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "track_id"}))
public class TrackLike {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Track track;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public TrackLike() {}
    public TrackLike(User user, Track track) { this.user = user; this.track = track; }
    public Long getId() { return id; }
    public User getUser() { return user; }
    public Track getTrack() { return track; }
    public Instant getCreatedAt() { return createdAt; }
}
