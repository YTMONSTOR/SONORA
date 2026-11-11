package com.sonora.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Serves the single-page app shell for every client-side route so deep links and refreshes work. */
@Controller
public class SpaController {
    @GetMapping({"/", "/search", "/library", "/library/**", "/artist/**", "/album/**", "/playlist/**",
            "/now-playing", "/lyrics", "/profile", "/u/**", "/settings", "/admin", "/admin/**", "/login", "/register"})
    public String spa() {
        return "forward:/index.html";
    }
}
