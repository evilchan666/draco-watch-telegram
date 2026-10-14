package org.omega.dracowatch;

import android.content.Context;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.util.*;

/** Private durable staged media, surviving rotation/process restart and app updates. */
final class AttachmentStore {
    static final long TOTAL_CAP=64L*1024*1024;
    static final class Item {
        final String id,name,mime; final long duration; final File file;
        Item(String id,String name,String mime,long duration,File file){this.id=id;this.name=name;this.mime=mime;this.duration=duration;this.file=file;}
        JSONObject descriptor()throws Exception{JSONObject out=new JSONObject();out.put("id",id);out.put("name",name);out.put("mimeType",mime);out.put("sizeBytes",file.length());out.put("durationMs",duration);return out;}
        JSONObject transfer()throws Exception{long size=file.length();if(size<=0||size>DracoClient.MEDIA_CAP)throw new IOException("The attachment is missing or too large.");
            byte[] bytes=new byte[(int)size];try(DataInputStream input=new DataInputStream(new FileInputStream(file))){input.readFully(bytes);}
            JSONObject out=new JSONObject();out.put("type",mime.startsWith("image/")?"image":"file");out.put("mimeType",mime);out.put("fileName",name);out.put("sizeBytes",size);if(duration>0)out.put("durationMs",duration);out.put("content",Base64.encodeToString(bytes,Base64.NO_WRAP));return out;}
    }
    private final Context context; private final File root; private final LinkedHashMap<String,Item> items=new LinkedHashMap<>();
    AttachmentStore(Context context){this.context=context;root=new File(context.getFilesDir(),"staged-media");root.mkdirs();
        try{JSONArray array=new JSONArray(context.getSharedPreferences("media",Context.MODE_PRIVATE).getString("items","[]"));for(int i=0;i<array.length();i++){JSONObject value=array.getJSONObject(i);String id=value.getString("id");if(!id.matches("[a-f0-9-]{36}"))continue;File file=new File(root,id);if(file.isFile()&&file.length()>0&&file.length()<=DracoClient.MEDIA_CAP)items.put(id,new Item(id,value.getString("name"),value.getString("mimeType"),value.optLong("durationMs"),file));}}
        catch(Exception ignored){}save();}
    synchronized Item add(File source,String name,String mime,long duration)throws Exception{long size=source.length(),used=0;for(Item value:items.values())used+=value.file.length();if(items.size()>=128||size+used>TOTAL_CAP)throw new IOException("Staged media is full. Remove an unsent attachment before choosing another.");
        String id=UUID.randomUUID().toString();File destination=new File(root,id);try(InputStream input=new FileInputStream(source);OutputStream output=new FileOutputStream(destination)){byte[] buffer=new byte[16384];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);}source.delete();Item item=new Item(id,name,mime,duration,destination);items.put(id,item);save();return item;}
    synchronized Item get(String id){return items.get(id);}
    synchronized void remove(String id){Item item=items.remove(id);if(item!=null)item.file.delete();save();}
    synchronized JSONArray descriptors(){JSONArray result=new JSONArray();for(Item item:items.values())try{result.put(item.descriptor());}catch(Exception ignored){}return result;}
    synchronized Item latest(){Item last=null;for(Item item:items.values())last=item;return last;}
    private void save(){JSONArray array=new JSONArray();for(Item item:items.values()){try{array.put(item.descriptor());}catch(Exception ignored){}}context.getSharedPreferences("media",Context.MODE_PRIVATE).edit().putString("items",array.toString()).commit();}
}
