package com.sonora.repo;

import com.sonora.domain.Playlist;
import com.sonora.domain.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    @EntityGraph(attributePaths = "owner")
    List<Playlist> findByOwnerOrderByUpdatedAtDesc(User owner);
    @EntityGraph(attributePaths = "owner")
    List<Playlist> findByPublicPlaylistTrueAndNameContainingIgnoreCase(String q);
    @EntityGraph(attributePaths = "owner")
    List<Playlist> findTop8ByPublicPlaylistTrueOrderByUpdatedAtDesc();
    long countByOwner(User owner);
}
