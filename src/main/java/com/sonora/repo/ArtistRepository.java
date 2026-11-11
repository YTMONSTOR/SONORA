package com.sonora.repo;

import com.sonora.domain.Artist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ArtistRepository extends JpaRepository<Artist, Long> {
    Optional<Artist> findBySlug(String slug);
    Optional<Artist> findByNameIgnoreCase(String name);
    List<Artist> findByNameContainingIgnoreCaseOrGenreContainingIgnoreCase(String name, String genre);
    List<Artist> findAllByOrderByNameAsc();
}
