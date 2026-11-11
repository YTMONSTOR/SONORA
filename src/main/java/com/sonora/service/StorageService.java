package com.sonora.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Stores media files on disk and exposes them under /media/**. */
@Service
public class StorageService {
    public static final Set<String> AUDIO = Set.of("mp3", "m4a", "aac", "ogg", "oga", "wav", "flac", "webm");
    public static final Set<String> IMAGE = Set.of("jpg", "jpeg", "png", "webp");

    private final Path root;

    public StorageService(@Value("${sonora.storage.path:./sonora-data}") String path) throws IOException {
        this.root = Path.of(path).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public Path root() { return root; }

    public String save(MultipartFile file, String folder, Set<String> allowed) {
        String ext = extension(file.getOriginalFilename());
        if (!allowed.contains(ext)) throw ApiException.bad("Unsupported file type ." + ext);
        String name = UUID.randomUUID() + "." + ext;
        try (InputStream in = file.getInputStream()) {
            Path dir = Files.createDirectories(root.resolve(folder));
            Files.copy(in, dir.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Could not store file");
        }
        return "/media/" + folder + "/" + name;
    }

    /** Copies a bundled classpath resource into storage (used by the demo seeder). */
    public String copy(Resource resource, String folder, String name) throws IOException {
        Path dir = Files.createDirectories(root.resolve(folder));
        Path target = dir.resolve(name);
        if (!Files.exists(target)) {
            try (InputStream in = resource.getInputStream()) {
                Files.copy(in, target);
            }
        }
        return "/media/" + folder + "/" + name;
    }

    /** Maps a /media/... URL back to its file on disk (null if it points outside storage). */
    public Path resolve(String url) {
        if (url == null || !url.startsWith("/media/")) return null;
        Path p = root.resolve(url.substring("/media/".length())).normalize();
        return p.startsWith(root) ? p : null;
    }

    public void deleteQuietly(String url) {
        if (url == null || !url.startsWith("/media/")) return;
        try {
            Path p = root.resolve(url.substring("/media/".length())).normalize();
            if (p.startsWith(root)) Files.deleteIfExists(p);
        } catch (IOException ignored) {
            // best effort
        }
    }

    public static String extension(String filename) {
        if (filename == null) return "";
        int i = filename.lastIndexOf('.');
        return i < 0 ? "" : filename.substring(i + 1).toLowerCase(Locale.ROOT);
    }
}
