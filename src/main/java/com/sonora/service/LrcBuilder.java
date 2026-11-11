package com.sonora.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Turns word-level timestamps from a speech-to-text model into synchronized LRC lyrics.
 * Two modes:
 *  - transcribe: lines are built from the recognised words (split on pauses and length);
 *  - align: the user's own lyrics are matched to the recognised words, so the text stays exactly
 *    as written and only the timing comes from the AI.
 * Plain Java on purpose (no Spring), so it is easy to test.
 */
public final class LrcBuilder {
    private LrcBuilder() {}

    public record Word(String text, double start, double end) {}
    public record Line(double start, double end, String text) {}

    /** Typical phrases Whisper invents on music or silence (mostly from video subtitles in its training data). */
    private static final String[] HALLUCINATIONS = {
            "субтитр", "продолжениеследует", "редакторсубтитров", "корректор", "dimatorzok", "amaraorg",
            "спасибозапросмотр", "подписывайтесьнаканал", "thanksforwatching", "thankyouforwatching",
            "subtitlesby", "pleasesubscribe", "ставьтелайки"
    };

    // ---------------------------------------------------------------------------------------------
    // transcribe mode

    public static List<Line> linesFromWords(List<Word> words) {
        List<Line> out = new ArrayList<>();
        List<Word> cur = new ArrayList<>();
        for (Word w : words) {
            if (w.text() == null || w.text().isBlank()) continue;
            if (!cur.isEmpty()) {
                Word prev = cur.get(cur.size() - 1);
                double gap = w.start() - prev.end();
                int n = cur.size();
                boolean breakHere = gap > 0.45 || (n >= 7 && gap > 0.12) || n >= 11 || endsSentence(prev.text());
                if (breakHere) { flush(cur, out); cur = new ArrayList<>(); }
            }
            cur.add(w);
        }
        flush(cur, out);
        return out;
    }

    private static boolean endsSentence(String t) {
        String s = t.trim();
        return s.endsWith(".") || s.endsWith("!") || s.endsWith("?");
    }

    private static void flush(List<Word> cur, List<Line> out) {
        if (cur.isEmpty()) return;
        StringBuilder sb = new StringBuilder();
        for (Word w : cur) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(w.text().trim());
        }
        String text = capitalize(sb.toString().replaceAll("\\s+([,.!?;:])", "$1").replaceAll("[.,;:]+$", ""));
        if (isHallucination(text)) return;
        out.add(new Line(cur.get(0).start(), cur.get(cur.size() - 1).end(), text));
    }

    public static boolean isHallucination(String text) {
        String n = norm(text.replace(" ", ""));
        for (String h : HALLUCINATIONS) if (n.contains(h)) return true;
        return false;
    }

    // ---------------------------------------------------------------------------------------------
    // align mode

    /** Lyric text without any [mm:ss] tags or metadata; blank lines removed. */
    public static List<String> plainLines(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        for (String raw : text.split("\\r?\\n")) {
            String l = raw.replaceAll("\\[[^\\]]*\\]", "").trim();
            if (l.isEmpty() || l.matches("^[♪♫\\s.]+$")) continue;
            out.add(l);
        }
        return out;
    }

    public static List<Line> align(List<String> lyricLines, List<Word> words) {
        // flatten lyric lines into normalised tokens, remembering which line each token belongs to
        List<String> a = new ArrayList<>();
        List<Integer> lineOf = new ArrayList<>();
        List<Integer> posInLine = new ArrayList<>();
        for (int li = 0; li < lyricLines.size(); li++) {
            int p = 0;
            for (String tok : lyricLines.get(li).split("\\s+")) {
                String n = norm(tok);
                if (n.isEmpty()) continue;
                a.add(n); lineOf.add(li); posInLine.add(p++);
            }
        }
        List<String> b = new ArrayList<>();
        List<Word> bw = new ArrayList<>();
        for (Word w : words) {
            String n = norm(w.text());
            if (!n.isEmpty()) { b.add(n); bw.add(w); }
        }
        int n = a.size(), m = b.size();
        double[] start = new double[lyricLines.size()], end = new double[lyricLines.size()];
        Arrays.fill(start, Double.NaN);
        Arrays.fill(end, Double.NaN);

        if (n > 0 && m > 0) {
            // Needleman–Wunsch global alignment of lyric tokens against recognised words
            final int GAP = -1;
            int[][] score = new int[n + 1][m + 1];
            byte[][] dir = new byte[n + 1][m + 1]; // 0 diag, 1 up (skip lyric token), 2 left (skip recognised word)
            for (int i = 1; i <= n; i++) { score[i][0] = i * GAP; dir[i][0] = 1; }
            for (int j = 1; j <= m; j++) { score[0][j] = j * GAP; dir[0][j] = 2; }
            for (int i = 1; i <= n; i++) {
                for (int j = 1; j <= m; j++) {
                    int d = score[i - 1][j - 1] + sim(a.get(i - 1), b.get(j - 1));
                    int u = score[i - 1][j] + GAP, l = score[i][j - 1] + GAP;
                    if (d >= u && d >= l) { score[i][j] = d; dir[i][j] = 0; }
                    else if (u >= l) { score[i][j] = u; dir[i][j] = 1; }
                    else { score[i][j] = l; dir[i][j] = 2; }
                }
            }
            int i = n, j = m;
            while (i > 0 && j > 0) {
                if (dir[i][j] == 0) {
                    if (sim(a.get(i - 1), b.get(j - 1)) > 0) {
                        int li = lineOf.get(i - 1);
                        Word w = bw.get(j - 1);
                        // estimate where the line begins even if its first words were not recognised
                        double est = w.start() - posInLine.get(i - 1) * 0.28;
                        if (Double.isNaN(start[li]) || est < start[li]) start[li] = est;
                        if (Double.isNaN(end[li]) || w.end() > end[li]) end[li] = w.end();
                    }
                    i--; j--;
                } else if (dir[i][j] == 1) i--;
                else j--;
            }
        }

        // lines nobody matched. Between two known lines: spread evenly. Before the first / after the last known line
        // (typically lines the AI missed over the intro): step back / forward by the song's typical line spacing,
        // instead of piling them onto the first word the AI happened to hear.
        int L = lyricLines.size();
        double spacing = typicalSpacing(start);
        for (int k = 0; k < L; k++) {
            if (!Double.isNaN(start[k])) continue;
            int p = k - 1; while (p >= 0 && Double.isNaN(start[p])) p--;
            int q = k + 1; while (q < L && Double.isNaN(start[q])) q++;
            if (p >= 0 && q < L) start[k] = start[p] + (start[q] - start[p]) * (k - p) / (double) (q - p);
            else if (q < L) start[k] = Math.max(0, start[q] - (q - k) * spacing);
            else if (p >= 0) start[k] = start[p] + (k - p) * spacing;
            else start[k] = (m > 0 ? bw.get(0).start() : 0) + k * spacing;
        }
        // keep lines strictly in order
        List<Line> out = new ArrayList<>();
        double prev = -1;
        for (int k = 0; k < L; k++) {
            double s = Math.max(0, Math.max(start[k], prev + 0.2));
            double e = Double.isNaN(end[k]) || end[k] < s ? s + 2.0 : end[k];
            out.add(new Line(s, e, lyricLines.get(k)));
            prev = s;
        }
        return out;
    }

    /** Median gap between consecutive recognised lines, clamped to a sane range. */
    private static double typicalSpacing(double[] start) {
        List<Double> gaps = new ArrayList<>();
        double prev = Double.NaN;
        for (double s : start) {
            if (Double.isNaN(s)) { prev = Double.NaN; continue; }
            if (!Double.isNaN(prev) && s > prev) gaps.add(s - prev);
            prev = s;
        }
        if (gaps.isEmpty()) return 3.5;
        gaps.sort(null);
        return Math.max(1.5, Math.min(8.0, gaps.get(gaps.size() / 2)));
    }

    private static int sim(String x, String y) {
        if (x.equals(y)) return 3;
        int max = Math.max(x.length(), y.length());
        if (max <= 2) return -2;
        double ratio = 1.0 - (double) levenshtein(x, y) / max;
        return ratio >= 0.6 ? 1 : -2;
    }

    static int levenshtein(String s, String t) {
        int[] prev = new int[t.length() + 1], cur = new int[t.length() + 1];
        for (int j = 0; j <= t.length(); j++) prev[j] = j;
        for (int i = 1; i <= s.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= t.length(); j++) {
                int c = s.charAt(i - 1) == t.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + c);
            }
            int[] tmp = prev; prev = cur; cur = tmp;
        }
        return prev[t.length()];
    }

    static String norm(String s) {
        return s.toLowerCase(Locale.ROOT).replace('ё', 'е').replaceAll("[^\\p{L}\\p{N}]+", "");
    }

    // ---------------------------------------------------------------------------------------------
    // output

    /** Renders LRC, adding a ♪ marker for the intro and for long instrumental breaks. */
    public static String toLrc(String title, List<Line> lines) {
        StringBuilder sb = new StringBuilder();
        if (title != null && !title.isBlank()) sb.append("[ti:").append(title.replace("]", "")).append("]\n");
        sb.append("[re:SONORA AI lyrics]\n");
        if (lines.isEmpty()) return sb.toString();
        if (lines.get(0).start() > 5) sb.append("[00:00.00]♪\n");
        Line prev = null;
        for (Line l : lines) {
            if (prev != null && l.start() - prev.end() > 10) sb.append('[').append(ts(prev.end() + 1)).append("]♪\n");
            sb.append('[').append(ts(l.start())).append(']').append(l.text()).append('\n');
            prev = l;
        }
        return sb.toString();
    }

    static String ts(double sec) {
        if (sec < 0) sec = 0;
        int cs = (int) Math.round(sec * 100);
        return String.format(Locale.ROOT, "%02d:%02d.%02d", cs / 6000, (cs / 100) % 60, cs % 100);
    }

    private static String capitalize(String s) {
        if (s.isEmpty()) return s;
        int cp = s.codePointAt(0);
        return new StringBuilder().appendCodePoint(Character.toUpperCase(cp)).append(s.substring(Character.charCount(cp))).toString();
    }
}
