package org.omega.dracowatch;

import org.json.*;

/** Bulk IO never consumes the reserved text/control workers. No route changes or retries. */
final class NativeIoPolicy {
    static boolean bulk(String method,String path,String json){
        if(!"POST".equals(method))return false;if("/v1/speech".equals(path))return true;if(!"/v1/message".equals(path))return false;
        try{JSONObject body=new JSONObject(json);JSONArray ids=body.optJSONArray("attachmentIds"),media=body.optJSONArray("attachments");return ids!=null&&ids.length()>0||media!=null&&media.length()>0;}
        catch(Exception invalid){return false;}
    }
}
