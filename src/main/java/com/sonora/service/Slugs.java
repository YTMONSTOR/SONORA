package com.sonora.service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.function.Predicate;

public final class Slugs {
    private Slugs() {}

    public static String of(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        n = n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return n.isEmpty() ? "item" : n;
    }

    /** Returns a slug that doesn't collide with existing ones. */
    public static String unique(String s, Predicate<String> exists) {
        String base = of(s), slug = base;
        for (int i = 2; exists.test(slug); i++) slug = base + "-" + i;
        return slug;
    }
}
