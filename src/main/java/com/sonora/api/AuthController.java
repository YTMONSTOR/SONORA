package com.sonora.api;

import com.sonora.domain.User;
import com.sonora.dto.Dtos.*;
import com.sonora.service.AccountService;
import com.sonora.service.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authManager;
    private final SecurityContextRepository contextRepository;
    private final AccountService accounts;

    public AuthController(AuthenticationManager authManager, SecurityContextRepository contextRepository,
                          AccountService accounts) {
        this.authManager = authManager;
        this.contextRepository = contextRepository;
        this.accounts = accounts;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        return Collections.singletonMap("user", accounts.me());
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest r, HttpServletRequest req, HttpServletResponse res) {
        if (r.username() == null || r.password() == null) throw ApiException.bad("Enter your username and password");
        signIn(r.username().trim(), r.password(), req, res);
        return me();
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> register(@RequestBody RegisterRequest r, HttpServletRequest req, HttpServletResponse res) {
        User u = accounts.register(r);
        signIn(u.getUsername(), r.password(), req, res);
        return me();
    }

    @PostMapping("/logout")
    public Message logout(HttpServletRequest req) {
        HttpSession s = req.getSession(false);
        if (s != null) s.invalidate();
        SecurityContextHolder.clearContext();
        return new Message("Signed out");
    }

    private void signIn(String username, String password, HttpServletRequest req, HttpServletResponse res) {
        Authentication auth;
        try {
            auth = authManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(username, password));
        } catch (DisabledException e) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This account has been disabled");
        } catch (AuthenticationException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "That username and password don't match");
        }
        if (req.getSession(false) != null) req.changeSessionId(); // prevent session fixation
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
        contextRepository.saveContext(ctx, req, res);
    }
}
