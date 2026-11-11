package com.sonora.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 40)
    private String username;
    @Column(nullable = false, unique = true, length = 160)
    private String email;
    @Column(nullable = false, length = 100)
    private String passwordHash;
    @Column(nullable = false, length = 80)
    private String displayName;
    @Column(length = 400)
    private String bio;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    private Role role = Role.USER;
    /** Hue (0-360) used for the generated avatar gradient. */
    private int avatarHue = 270;
    /** Client preferences (quality, motion, lyrics size) as a small JSON document. */
    @Column(length = 2000)
    private String settingsJson = "{}";
    private boolean enabled = true;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String v) { username = v; }
    public String getEmail() { return email; }
    public void setEmail(String v) { email = v; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String v) { passwordHash = v; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { displayName = v; }
    public String getBio() { return bio; }
    public void setBio(String v) { bio = v; }
    public Role getRole() { return role; }
    public void setRole(Role v) { role = v; }
    public int getAvatarHue() { return avatarHue; }
    public void setAvatarHue(int v) { avatarHue = v; }
    public String getSettingsJson() { return settingsJson; }
    public void setSettingsJson(String v) { settingsJson = v; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean v) { enabled = v; }
    public Instant getCreatedAt() { return createdAt; }
}
