package com.sonora.repo;

import com.sonora.domain.Playlist;
import com.sonora.domain.PlaylistTrack;
import com.sonora.domain.Track;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface PlaylistTrackRepository extends JpaRepository<PlaylistTrack, Long> {
    @Query("select pt from PlaylistTrack pt join fetch pt.track t join fetch t.album join fetch t.artist " +
           "where pt.playlist = :p order by pt.position asc")
    List<PlaylistTrack> findItems(@Param("p") Playlist p);

    long countByPlaylist(Playlist p);

    @Modifying
    @Query("delete from PlaylistTrack pt where pt.track = :t")
    void deleteByTrack(@Param("t") Track t);
}
