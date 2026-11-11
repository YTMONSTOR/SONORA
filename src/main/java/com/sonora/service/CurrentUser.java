package com.sonora.service;

import com.sonora.domain.User;
import com.sonora.repo.UserRepository;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class CurrentUser {
    private final UserRepository users;

    public CurrentUser(UserRepository users) { this.users = users; }

    public Optional<User> find() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || a instanceof AnonymousAuthenticationToken) return Optional.empty();
        return users.findByUsernameIgnoreCase(a.getName());
    }

    public User require() { return find().orElseThrow(ApiException::unauthorized); }
}
