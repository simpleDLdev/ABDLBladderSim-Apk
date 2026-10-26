package dev.simpledl.bladdersim.alarm;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Persists scheduled alarms in SharedPreferences so they survive reboot / time change / process death. */
public final class AlarmStore {
    private static final String PREFS = "bs_native_alarms";
    private static final String PREFIX = "a_";

    public static final class Item {
        public int id;
        public long at;
        public String title;
        public String body;
        public String channel = ""; // v9 optional channel override ("sound-no-vibrate" | "vibrate-only" | "bs-silent")
        public String kind; // "alarm" (setAlarmClock + full-screen) | "reminder" (exact while idle)

        JSONObject toJson() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("id", id); o.put("at", at); o.put("title", title); o.put("body", body); o.put("kind", kind); o.put("channel", channel == null ? "" : channel);
            return o;
        }

        static Item fromJson(String s) {
            try {
                JSONObject o = new JSONObject(s);
                Item i = new Item();
                i.id = o.getInt("id"); i.at = o.getLong("at");
                i.title = o.optString("title", "Bladder Sim"); i.body = o.optString("body", "");
                i.kind = o.optString("kind", "alarm");
                i.channel = o.optString("channel", "");
                return i;
            } catch (JSONException e) { return null; }
        }

        public boolean isAlarm() { return !"reminder".equals(kind); }
    }

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    public static void put(Context c, Item i) {
        try { prefs(c).edit().putString(PREFIX + i.id, i.toJson().toString()).apply(); } catch (JSONException ignored) {}
    }

    public static Item get(Context c, int id) {
        String s = prefs(c).getString(PREFIX + id, null);
        return s == null ? null : Item.fromJson(s);
    }

    public static void remove(Context c, int id) { prefs(c).edit().remove(PREFIX + id).commit(); }

    public static List<Item> all(Context c) {
        List<Item> out = new ArrayList<>();
        for (Map.Entry<String, ?> e : prefs(c).getAll().entrySet()) {
            if (!e.getKey().startsWith(PREFIX) || !(e.getValue() instanceof String)) continue;
            Item i = Item.fromJson((String) e.getValue());
            if (i != null) out.add(i);
        }
        return out;
    }

    public static void clear(Context c) {
        SharedPreferences.Editor ed = prefs(c).edit();
        for (String k : prefs(c).getAll().keySet()) if (k.startsWith(PREFIX)) ed.remove(k);
        ed.commit();
    }
}
