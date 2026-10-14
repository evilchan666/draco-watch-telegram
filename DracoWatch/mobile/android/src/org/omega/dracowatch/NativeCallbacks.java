package org.omega.dracowatch;

import java.util.*;
import org.json.JSONObject;

/** Cosmetic progress is bounded/coalesced; original terminal callbacks are never discarded. */
final class NativeCallbacks {
    static final class Event {
        final String callback,json,progressKey,supersedes,script;
        Event(String callback,String json,String progressKey){this(callback,json,progressKey,null);}
        Event(String callback,String json,String progressKey,String supersedes){this.callback=callback;this.json=json;this.progressKey=progressKey;this.supersedes=supersedes;
            // Snapshot encoding can be large; construct on its IO worker, not in main-thread dispatch.
            String encoded=JSONObject.quote(json).replace("\u2028","\\u2028").replace("\u2029","\\u2029");
            script="if(typeof window."+callback+"==='function')window."+callback+"(JSON.parse("+encoded+"));";}
    }
    private static final class Progress {final long time;final int percent;Progress(long time,int percent){this.time=time;this.percent=percent;}}
    private final ArrayDeque<Event> pending=new ArrayDeque<>();
    private final LinkedHashMap<String,Event> queuedProgress=new LinkedHashMap<>();
    private final LinkedHashMap<String,Progress> emittedProgress=new LinkedHashMap<>();
    synchronized boolean shouldEmit(String key,long now,long bytes,long total){
        if(key==null)return true;int percent=total>0?(int)Math.min(100,100L*bytes/total):-1;
        Progress before=emittedProgress.get(key);
        if(before!=null&&now-before.time<150&&!(total>0&&bytes>=total)&&!(percent>=0&&percent-before.percent>=5))return false;
        emittedProgress.remove(key);if(emittedProgress.size()>=64)emittedProgress.remove(emittedProgress.keySet().iterator().next());
        emittedProgress.put(key,new Progress(now,percent));return true;
    }
    synchronized void offer(Event event){
        if(event.supersedes!=null){Iterator<Map.Entry<String,Event>> progress=queuedProgress.entrySet().iterator();while(progress.hasNext()){Map.Entry<String,Event> old=progress.next();if(old.getKey().startsWith(event.supersedes)){pending.remove(old.getValue());progress.remove();}}}
        if(event.progressKey!=null){Event earlier=queuedProgress.remove(event.progressKey);if(earlier!=null)pending.remove(earlier);
            if(queuedProgress.size()>=32){String oldest=queuedProgress.keySet().iterator().next();pending.remove(queuedProgress.remove(oldest));}
            queuedProgress.put(event.progressKey,event);}
        pending.addLast(event);
    }
    synchronized Event poll(){Iterator<Event> events=pending.iterator();while(events.hasNext()){Event event=events.next();if(event.progressKey==null){events.remove();return event;}}
        Event event=pending.pollFirst();if(event!=null&&event.progressKey!=null&&queuedProgress.get(event.progressKey)==event)queuedProgress.remove(event.progressKey);return event;}
    synchronized int size(){return pending.size();}
}
