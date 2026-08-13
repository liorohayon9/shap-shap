package com.lior.shapshap;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * A record of every armed alarm. AlarmManager forgets everything on reboot, so
 * this is what BootReceiver reads to put the alarms back.
 */
final class AlarmStore {

    private static final String PREFS = "shapshap.alarms";
    private static final String KEY = "armed";
    private static final String KEY_EVENTS = "events";

    /** Held down until it stopped — the reminder was actually dealt with. */
    static final String OUTCOME_DISMISSED = "dismissed";
    /** Rang out with nobody answering. */
    static final String OUTCOME_MISSED = "missed";

    /** Plenty for any realistic gap between an alarm firing and the app opening. */
    private static final int MAX_EVENTS = 100;

    static final class Entry {
        final int id;
        final String title;
        final long at;

        Entry(int id, String title, long at) {
            this.id = id;
            this.title = title;
            this.at = at;
        }
    }

    private AlarmStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static List<Entry> all(Context ctx) {
        List<Entry> out = new ArrayList<>();
        String raw = prefs(ctx).getString(KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                out.add(new Entry(o.getInt("id"), o.optString("title", "Reminder"), o.getLong("at")));
            }
        } catch (JSONException ignored) {
            // Corrupt store — better to lose the list than to crash on boot.
        }
        return out;
    }

    private static void write(Context ctx, List<Entry> entries) {
        JSONArray arr = new JSONArray();
        for (Entry e : entries) {
            try {
                JSONObject o = new JSONObject();
                o.put("id", e.id);
                o.put("title", e.title);
                o.put("at", e.at);
                arr.put(o);
            } catch (JSONException ignored) {
            }
        }
        prefs(ctx).edit().putString(KEY, arr.toString()).apply();
    }

    static void put(Context ctx, int id, String title, long at) {
        List<Entry> entries = all(ctx);
        entries.removeIf(e -> e.id == id);
        entries.add(new Entry(id, title, at));
        write(ctx, entries);
    }

    static void remove(Context ctx, int id) {
        List<Entry> entries = all(ctx);
        entries.removeIf(e -> e.id == id);
        write(ctx, entries);
    }

    /**
     * Records how an alarm ended. The alarm screen is native and the task list is
     * JavaScript, so without this the app cannot tell "he held the button" apart
     * from "it rang out unanswered" — both just look like a task whose time passed.
     */
    static void addEvent(Context ctx, int id, String outcome) {
        SharedPreferences p = prefs(ctx);
        try {
            JSONArray arr = new JSONArray(p.getString(KEY_EVENTS, "[]"));
            JSONObject o = new JSONObject();
            o.put("id", id);
            o.put("outcome", outcome);
            o.put("at", System.currentTimeMillis());
            arr.put(o);
            while (arr.length() > MAX_EVENTS) arr.remove(0);
            // commit, not apply: the process may be killed moments after dismissal.
            p.edit().putString(KEY_EVENTS, arr.toString()).commit();
        } catch (JSONException ignored) {
        }
    }

    /** Hands the pending events to the web layer and clears them in one step. */
    static String takeEvents(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String raw = p.getString(KEY_EVENTS, "[]");
        p.edit().putString(KEY_EVENTS, "[]").commit();
        return raw;
    }
}
