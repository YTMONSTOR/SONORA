package com.sonora.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sonora.domain.Role;
import com.sonora.domain.User;
import com.sonora.dto.Dtos.*;
import com.sonora.dto.Mapper;
import com.sonora.repo.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.regex.Pattern;

@Service
public class AccountService {
    private static final Pattern USERNAME = Pattern.compile("^[a-zA-Z0-9_.]{3,30}$");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final UserRepository users;
    private final TrackLikeRepository likes;
    private final PlaylistRepository playlists;
    private final PlayEventRepository plays;
    private final ArtistRepository artists;
    private final LibraryService library;
    private final PasswordEncoder encoder;
    private final CurrentUser currentUser;
    private final Mapper map;
    private final ObjectMapper json;

    public AccountService(UserRepository users, TrackLikeRepository likes, PlaylistRepository playlists,
                          PlayEventRepository plays, ArtistRepository artists, LibraryService library,
                          PasswordEncoder encoder, CurrentUser currentUser, Mapper map, ObjectMapper json) {
        this.users = users;
        this.likes = likes;
        this.playlists = playlists;
        this.plays = plays;
        this.artists = artists;
        this.library = library;
        this.encoder = encoder;
        this.currentUser = currentUser;
        this.map = map;
        this.json = json;
    }

    @Transactional
    public User register(RegisterRequest r) {
        String username = r.username() == null ? "" : r.username().trim();
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        if (!USERNAME.matcher(username).matches())
            throw ApiException.bad("Username must be 3–30 letters, numbers, dots or underscores");
        if (!EMAIL.matcher(email).matches()) throw ApiException.bad("Enter a valid email address");
        validatePassword(r.password());
        if (users.existsByUsernameIgnoreCase(username)) throw ApiException.bad("That username is taken");
        if (users.existsByEmailIgnoreCase(email)) throw ApiException.bad("An account with that email already exists");
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(r.password()));
        String dn = r.displayName() == null || r.displayName().isBlank() ? username : r.displayName().trim();
        u.setDisplayName(LibraryService.trim(dn, 80));
        u.setRole(Role.USER);
        u.setAvatarHue(new Random().nextInt(360));
        return users.save(u);
    }

    static void validatePassword(String p) {
        if (p == null || p.length() < 8) throw ApiException.bad("Password must be at least 8 characters");
        if (p.length() > 72) throw ApiException.bad("Password must be 72 characters or fewer");
    }

    @Transactional(readOnly = true)
    public UserDto me() { return currentUser.find().map(map::user).orElse(null); }

    @Transactional(readOnly = true)
    public ProfileDto profile(String username) {
        User u = username == null ? currentUser.require()
                : users.findByUsernameIgnoreCase(username).orElseThrow(() -> ApiException.notFound("User"));
        boolean self = currentUser.find().map(me -> me.getId().equals(u.getId())).orElse(false);
        List<ArtistDto> top = new ArrayList<>();
        for (Object[] row : plays.topArtistIds(u, PageRequest.of(0, 5))) {
            artists.findById((Long) row[0]).map(map::artist).ifPresent(top::add);
        }
        List<PlaylistDto> pls = library.myPlaylists(u).stream().filter(p -> self || p.isPublic()).toList();
        UserDto dto = map.user(u);
        if (!self) dto = new UserDto(dto.id(), dto.username(), dto.displayName(), null, dto.bio(), dto.role(),
                dto.avatarHue(), json.createObjectNode(), dto.memberSince());
        return new ProfileDto(dto, likes.countByUser(u), playlists.countByOwner(u), plays.countByUser(u),
                plays.sumSecondsForUser(u) / 60, top, pls);
    }

    @Transactional
    public UserDto updateProfile(ProfileUpdate r) {
        User u = currentUser.require();
        if (r.displayName() != null) {
            if (r.displayName().isBlank()) throw ApiException.bad("Display name can't be empty");
            u.setDisplayName(LibraryService.trim(r.displayName(), 80));
        }
        if (r.email() != null) {
            String email = r.email().trim().toLowerCase();
            if (!EMAIL.matcher(email).matches()) throw ApiException.bad("Enter a valid email address");
            users.findByEmailIgnoreCase(email).filter(o -> !o.getId().equals(u.getId())).ifPresent(o -> {
                throw ApiException.bad("An account with that email already exists");
            });
            u.setEmail(email);
        }
        if (r.bio() != null) u.setBio(r.bio().isBlank() ? null : LibraryService.trim(r.bio(), 400));
        if (r.avatarHue() != null) u.setAvatarHue(Math.floorMod(r.avatarHue(), 360));
        return map.user(u);
    }

    @Transactional
    public UserDto saveSettings(JsonNode settings) {
        User u = currentUser.require();
        if (settings == null || !settings.isObject()) throw ApiException.bad("Settings must be a JSON object");
        String raw = settings.toString();
        if (raw.length() > 2000) throw ApiException.bad("Settings are too large");
        u.setSettingsJson(raw);
        return map.user(u);
    }

    @Transactional
    public void changePassword(PasswordChange r) {
        User u = currentUser.require();
        if (r.currentPassword() == null || !encoder.matches(r.currentPassword(), u.getPasswordHash()))
            throw ApiException.bad("Your current password is incorrect");
        validatePassword(r.newPassword());
        u.setPasswordHash(encoder.encode(r.newPassword()));
    }

}
