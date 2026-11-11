package com.sonora.repo;

import com.sonora.domain.Album;
import com.sonora.domain.Artist;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AlbumRepository extends JpaRepository<Album, Long> {
    @EntityGraph(attributePaths = "artist")
    Optional<Album> findBySlug(String slug);
    @EntityGraph(attributePaths = "artist")
    List<Album> findAllByOrderByReleaseYearDescCreatedAtDesc();
    @EntityGraph(attributePaths = "artist")
    List<Album> findByArtistOrderByReleaseYearDesc(Artist artist);
    @EntityGraph(attributePaths = "artist")
    List<Album> findByTitleContainingIgnoreCase(String q);
}
