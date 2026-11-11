package com.sonora.repo;

import com.sonora.domain.Album;
import com.sonora.domain.Artist;
import com.sonora.domain.Track;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface TrackRepository extends JpaRepository<Track, Long> {
    @EntityGraph(attributePaths = {"album", "artist"})
    List<Track> findByAlbumOrderByTrackNoAsc(Album album);

    @EntityGraph(attributePaths = {"album", "artist"})
    List<Track> findByArtistOrderByPlaysDesc(Artist artist);

    @EntityGraph(attributePaths = {"album", "artist"})
    List<Track> findAllByOrderByPlaysDesc(Pageable page);

    @EntityGraph(attributePaths = {"album", "artist"})
    List<Track> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"album", "artist"})
    @Query("select t from Track t where lower(t.title) like lower(concat('%', :q, '%')) " +
           "or lower(t.artist.name) like lower(concat('%', :q, '%')) " +
           "or lower(t.album.title) like lower(concat('%', :q, '%')) order by t.plays desc")
    List<Track> search(@Param("q") String q);

    @EntityGraph(attributePaths = {"album", "artist"})
    @Query("select t from Track t where t.id in :ids")
    List<Track> findAllWithRefs(@Param("ids") List<Long> ids);

    @Modifying
    @Query("update Track t set t.plays = t.plays + 1 where t.id = :id")
    int incrementPlays(@Param("id") Long id);

    long countByAlbum(Album album);

    @Transactional
    @Modifying
    @Query("update Track t set t.lyrics = :lyrics where t.id = :id")
    int updateLyrics(@Param("id") Long id, @Param("lyrics") String lyrics);
}
