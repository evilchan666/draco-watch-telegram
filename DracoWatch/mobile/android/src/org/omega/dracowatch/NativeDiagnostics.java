package org.omega.dracowatch;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Private bounded metadata only. Never accepts arbitrary bodies, paths, URLs or error messages. */
final class NativeDiagnostics {
    private static final int LIMIT = 96;
    private final File file;
    private final JSONArray events = new JSONArray();

    interface CrashJournal { void record(Throwable failure); }

    /** Logging is best-effort; even an Error in it must not swallow Android's crash handling. */
    static Thread.UncaughtExceptionHandler crashForwarder(CrashJournal journal, Thread.UncaughtExceptionHandler previous) {
        return (thread, failure) -> {
            try { if (journal != null) journal.record(failure); }
            catch (Throwable ignored) { }
            finally {
                if (previous != null) previous.uncaughtException(thread, failure);
                else { android.os.Process.killProcess(android.os.Process.myPid()); System.exit(10); }
            }
        };
    }

    NativeDiagnostics(Context context) {
        file = new File(context.getFilesDir(), "native-diagnostics.json");
        try {
            if (file.length() > 0 && file.length() <= 524288) {
                byte[] data = new byte[(int)file.length()];
                try (FileInputStream input = new FileInputStream(file)) {
                    int offset = 0, count;
                    while (offset < data.length && (count = input.read(data, offset, data.length - offset)) > 0) offset += count;
                    JSONArray saved = new JSONArray(new String(data, 0, offset, StandardCharsets.UTF_8));
                    for (int i = Math.max(0, saved.length() - LIMIT); i < saved.length(); i++) {
                        JSONObject event = saved.optJSONObject(i);
                        if (event != null) events.put(sanitize(event, false));
                    }
                }
            }
        } catch (Exception ignored) { }
    }

    static JSONObject sanitize(JSONObject supplied, boolean timestamp) {
        JSONObject safe = new JSONObject();
        try {
            safe.put("at", timestamp ? System.currentTimeMillis() : Math.max(0, supplied.optLong("at")));
            for (String key : new String[]{"component", "event", "state", "code", "level", "phase", "source", "errorName", "errorCode"}) {
                String value = supplied.optString(key);
                if (value.matches("[A-Za-z0-9_.:-]{1,64}")) safe.put(key, value);
            }
            for (String key : new String[]{"agent", "sessionId", "runId", "callId", "messageId", "requestId", "correlationId", "playbackId"}) {
                String value = supplied.optString(key);
                if (value.matches("[A-Za-z0-9_.:@-]{1,1200}")) safe.put(key, value);
            }
            String basename = supplied.optString("file").replace('\\', '/');
            if (basename.contains("/")) basename = basename.substring(basename.lastIndexOf('/') + 1);
            if (basename.matches("[A-Za-z0-9_.-]{1,100}")) safe.put("file", basename);
            for (String key : new String[]{"fontScale", "appScale"}) {
                double value = supplied.optDouble(key, Double.NaN);
                if (!Double.isNaN(value) && !Double.isInfinite(value) && value >= .5 && value <= 3) safe.put(key, value);
            }
            for (String key : new String[]{"durationMs", "positionMs", "elapsedMs", "bytes", "status", "generation", "width", "height", "line", "column", "count", "queued"}) {
                Object value = supplied.opt(key);
                if (value instanceof Number) {
                    long number = ((Number)value).longValue();
                    if (number >= 0 && number <= 9007199254740991L) safe.put(key, number);
                }
            }
            for (String key : new String[]{"connected", "native", "manual"}) if (supplied.opt(key) instanceof Boolean) safe.put(key, supplied.optBoolean(key));
        } catch (Exception ignored) { }
        return safe;
    }

    synchronized void record(JSONObject supplied) {
        if (supplied == null) return;
        JSONArray next = new JSONArray();
        for (int i = Math.max(0, events.length() - LIMIT + 1); i < events.length(); i++) next.put(events.opt(i));
        next.put(sanitize(supplied, true));
        while (events.length() > 0) events.remove(events.length() - 1);
        for (int i = 0; i < next.length(); i++) events.put(next.opt(i));
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.write(events.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) { }
    }

    void record(String event, String state) {
        JSONObject value = new JSONObject();
        try { value.put("component", "android"); value.put("event", event); value.put("state", state); } catch (Exception ignored) { }
        record(value);
    }

    void crash(Throwable failure) {
        JSONObject value = new JSONObject();
        try {
            value.put("component", "android"); value.put("event", "uncaught"); value.put("state", "fatal");
            value.put("errorName", failure == null ? "UnknownError" : failure.getClass().getSimpleName());
            if (failure != null && failure.getStackTrace().length > 0) {
                StackTraceElement frame = failure.getStackTrace()[0];
                value.put("file", frame.getFileName()); value.put("line", Math.max(0, frame.getLineNumber()));
            }
        } catch (Exception ignored) { }
        record(value);
    }

    synchronized String export() {
        JSONObject value = new JSONObject();
        try { value.put("schema", "draco.native-diagnostics.v1"); value.put("events", new JSONArray(events.toString())); value.put("bounded", LIMIT); value.put("privateMetadataOnly", true); } catch (Exception ignored) { }
        return value.toString();
    }
}
