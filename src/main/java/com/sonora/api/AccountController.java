package com.sonora.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.sonora.dto.Dtos.*;
import com.sonora.service.AccountService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AccountController {
    private final AccountService accounts;

    public AccountController(AccountService accounts) { this.accounts = accounts; }

    @GetMapping("/me/profile")
    public ProfileDto myProfile() { return accounts.profile(null); }

    @GetMapping("/users/{username}")
    public ProfileDto profile(@PathVariable String username) { return accounts.profile(username); }

    @PatchMapping("/me/profile")
    public UserDto update(@RequestBody ProfileUpdate r) { return accounts.updateProfile(r); }

    @PutMapping("/me/settings")
    public UserDto settings(@RequestBody JsonNode settings) { return accounts.saveSettings(settings); }

    @PostMapping("/me/password")
    public Message password(@RequestBody PasswordChange r) {
        accounts.changePassword(r);
        return new Message("Password updated");
    }
}
