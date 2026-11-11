package com.sonora.repo;

import com.sonora.domain.PlayEvent;
import com.sonora.domain.Track;
import com.sonora.domain.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface PlayEventRepository extends JpaRepository<PlayEvent, Long> {
    @Query("select e from PlayEvent e join fetch e.track t join fetch t.album join fetch t.artist " +
           "where e.user = :u order by e.playedAt desc")
    List<PlayEvent> findRecent(@Param("u") User u, Pageable page);

    @Query("select e.playedAt from PlayEvent e where e.playedAt >= :since")
    List<Instant> findTimesSince(@Param("since") Instant since);

    long countByUser(User u);

    @Query("select coalesce(sum(e.track.durationSec), 0) from PlayEvent e where e.user = :u")
    long sumSecondsForUser(@Param("u") User u);

    @Query("select e.track.artist.id, count(e) from PlayEvent e where e.user = :u group by e.track.artist.id order by count(e) desc")
    List<Object[]> topArtistIds(@Param("u") User u, Pageable page);

    @Modifying
    @Query("delete from PlayEvent e where e.track = :t")
    void deleteByTrack(@Param("t") Track t);
}
