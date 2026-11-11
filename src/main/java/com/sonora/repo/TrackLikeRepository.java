package com.sonora.repo;

import com.sonora.domain.Track;
import com.sonora.domain.TrackLike;
import com.sonora.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TrackLikeRepository extends JpaRepository<TrackLike, Long> {
    Optional<TrackLike> findByUserAndTrack(User user, Track track);

    @Query("select l from TrackLike l join fetch l.track t join fetch t.album join fetch t.artist " +
           "where l.user = :u order by l.createdAt desc")
    List<TrackLike> findForUser(@Param("u") User u);

    @Query("select l.track.id from TrackLike l where l.user = :u")
    List<Long> findTrackIds(@Param("u") User u);

    long countByUser(User u);

    @Modifying
    @Query("delete from TrackLike l where l.track = :t")
    void deleteByTrack(@Param("t") Track t);
}
