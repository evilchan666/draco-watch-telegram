package org.omega.dracowatch;

import android.content.Context;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.*;
import javax.net.ssl.*;

/** Exact-leaf-pinned, same-origin native client. Credentials never enter WebView. */
final class DracoClient {
    static final int JSON_CAP = 6 * 1024 * 1024;
    static final int MEDIA_CAP = 8 * 1024 * 1024;
    static final int DOWNLOAD_CAP = 32 * 1024 * 1024;
    static final int APK_CAP = 64 * 1024 * 1024;
    static final Set<String> AGENTS = new HashSet<>(Arrays.asList("main","forge","atlas","aera-new","vvv","daedalus"));
    interface Progress { void update(long bytes, long total); }
    static final class Response {
        final int status; final JSONObject data;
        Response(int status, JSONObject data) { this.status=status; this.data=data; }
    }
    static final class Failure extends IOException {
        final boolean uncertain; final int status;
        Failure(String message, int status, boolean uncertain) { super(message); this.status=status; this.uncertain=uncertain; }
    }
    static final class Profile {
        final List<String> origins = new ArrayList<>(); final String token; final SSLContext tls;
        private volatile String healthyOrigin;
        Profile(JSONObject raw) throws Exception {
            origins.add(origin(raw.getString("url")));
            JSONArray alt=raw.optJSONArray("alternateUrls");
            if (alt!=null) { if(alt.length()>3)throw new IllegalArgumentException();
                for(int i=0;i<alt.length();i++){String value=origin(alt.getString(i));if(!origins.contains(value))origins.add(value);}}
            token=raw.getString("token"); if(!token.matches("[A-Za-z0-9_.~\\-]{32,512}"))throw new IllegalArgumentException();
            String pin=raw.getString("certificateSha256").replace(":","").toLowerCase(Locale.ROOT);
            if(!pin.matches("[a-f0-9]{64}"))throw new IllegalArgumentException();
            final byte[] expected=hex(pin);
            X509TrustManager trust=new X509TrustManager(){
                public void checkClientTrusted(X509Certificate[] c,String t)throws CertificateException{throw new CertificateException();}
                public void checkServerTrusted(X509Certificate[] c,String t)throws CertificateException{
                    try {if(c==null||c.length==0)throw new CertificateException();c[0].checkValidity();
                        if(!MessageDigest.isEqual(expected,MessageDigest.getInstance("SHA-256").digest(c[0].getEncoded())))throw new CertificateException();}
                    catch(Exception ex){throw new CertificateException("Unpaired certificate");}}
                public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}};
            tls=SSLContext.getInstance("TLS");tls.init(null,new TrustManager[]{trust},new SecureRandom());
        }
        // A successful fallback is the working route until another pinned origin succeeds.
        // Each request takes its own order: concurrent IO cannot reorder an in-flight POST.
        List<String> orderedOrigins(){String preferred=healthyOrigin;List<String> ordered=new ArrayList<>(origins);
            if(preferred!=null&&ordered.remove(preferred))ordered.add(0,preferred);return ordered;}
        void connected(String origin){if(origins.contains(origin))healthyOrigin=origin;}
        private static String origin(String value)throws Exception{
            URI uri=new URI(value);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getHost().isEmpty()
                ||uri.getRawUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null
                ||!(uri.getRawPath()==null||uri.getRawPath().isEmpty()||"/".equals(uri.getRawPath()))
                ||uri.getPort()==0||uri.getPort()<-1||uri.getPort()>65535)throw new IllegalArgumentException();
            return value.endsWith("/")?value.substring(0,value.length()-1):value;
        }
    }
    static Profile loadProfile(Context context){
        String stored=context.getSharedPreferences("pairing",Context.MODE_PRIVATE).getString("profile",null);
        try {if(stored!=null)return new Profile(new JSONObject(stored));
            try(InputStream input=context.getAssets().open("profile.json")){JSONObject raw=new JSONObject(readText(input,8192));Profile parsed=new Profile(raw);if(!context.getSharedPreferences("pairing",Context.MODE_PRIVATE).edit().putString("profile",raw.toString()).commit())throw new IOException();return parsed;}}
        catch(Exception ex){return null;}
    }
    static JSONObject decodePairing(String encoded)throws Exception{
        encoded=encoded.trim();if(encoded.startsWith("draco-watch:"))encoded=encoded.substring(12);
        if(encoded.length()<16||encoded.length()>12000||!encoded.matches("[A-Za-z0-9_\\-=]+"))throw new IllegalArgumentException();
        byte[] value=Base64.decode(encoded,Base64.URL_SAFE|Base64.NO_WRAP);
        if(value.length>8192)throw new IllegalArgumentException();JSONObject result=new JSONObject(new String(value,StandardCharsets.UTF_8));
        new Profile(result);return result;
    }
    static boolean permitted(String method,String path){
        if(path==null||path.length()>600||path.contains("#")||path.contains("..")||path.contains("\\")||path.contains("%"))return false;
        if("GET".equals(method))return path.equals("/v1/capabilities")||path.matches("/v1/capabilities\\?agent=(main|forge|atlas|aera-new|vvv|daedalus)")||path.equals("/v1/update")
            ||path.matches("/v1/(snapshot|history)\\?agent=(main|forge|atlas|aera-new|vvv|daedalus)(&[A-Za-z]+=[A-Za-z0-9_-]+)*");
        return "POST".equals(method)&&(path.equals("/v1/message")||path.equals("/v1/abort")||path.equals("/v1/speech"));
    }
    static boolean mediaPath(String path){
        if(path==null||path.length()>4096||path.contains("..")||path.contains("#")||path.contains("\\"))return false;
        if(path.matches("/v1/speech/[A-Za-z0-9_-]{1,180}"))return true;
        if(!path.startsWith("/v1/media?"))return false;
        try{android.net.Uri uri=android.net.Uri.parse(path);Set<String> keys=uri.getQueryParameterNames();
            if(!keys.equals(new HashSet<>(Arrays.asList("agent","sessionId","messageId","index"))))return false;
            for(String key:keys)if(uri.getQueryParameters(key).size()!=1)return false;
            return AGENTS.contains(uri.getQueryParameter("agent"))
                &&uri.getQueryParameter("sessionId").matches("[A-Za-z0-9_-]{1,256}")
                &&uri.getQueryParameter("messageId").matches("[A-Za-z0-9_.:-]{1,1024}")
                &&uri.getQueryParameter("index").matches("[0-9]{1,2}");
        }catch(Exception ex){return false;}
    }
    private static HttpsURLConnection open(Profile profile,String origin,String method,String path)throws Exception{
        HttpsURLConnection connection=(HttpsURLConnection)new URL(origin+path).openConnection();
        connection.setSSLSocketFactory(profile.tls.getSocketFactory()); // Normal hostname checks retained.
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(5000);connection.setReadTimeout("POST".equals(method)&&"/v1/speech".equals(path)?125000:18000);
        connection.setUseCaches(false);connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization","Bearer "+profile.token);connection.setRequestProperty("Cache-Control","no-store");
        connection.setRequestProperty("Accept","application/json");return connection;
    }
    static Response request(Profile profile,String method,String path,byte[] body,Progress progress)throws Exception{
        if(profile==null)throw new Failure("Phone pairing required.",0,false);
        if(!permitted(method,path))throw new Failure("Unsupported native request.",0,false);
        boolean write="POST".equals(method); if(body!=null&&body.length>12*1024*1024)throw new Failure("Attachments exceed the 8 MB transfer limit.",0,false);
        Exception last=null;
        for(String origin:profile.orderedOrigins()){HttpsURLConnection connection=null;boolean admitted=false;
            try {connection=open(profile,origin,method,path);
                if(write){connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
                    byte[] payload=body==null?new byte[0]:body;connection.setFixedLengthStreamingMode(payload.length);
                    try(OutputStream output=connection.getOutputStream()){admitted=true;for(int pos=0;pos<payload.length;pos+=16384){int count=Math.min(16384,payload.length-pos);output.write(payload,pos,count);if(progress!=null)progress.update(pos+count,payload.length);}}}
                int status=connection.getResponseCode();if(status>=300&&status<400)throw new Failure("Redirect refused. Delivery is unconfirmed for submitted messages.",status,write&&admitted);
                String contentType=connection.getContentType();if(contentType==null||!contentType.toLowerCase(Locale.ROOT).startsWith("application/json"))throw new Failure("Invalid server response.",status,write&&admitted);
                if(connection.getContentLengthLong()>JSON_CAP)throw new Failure("Server response is too large.",status,write&&admitted);
                InputStream input=status<400?connection.getInputStream():connection.getErrorStream();
                JSONObject value;try(InputStream stream=input){value=new JSONObject(readText(stream,JSON_CAP));}
                if(status>=200&&status<300)profile.connected(origin);
                return new Response(status,value);
            }catch(Failure failure){throw failure;}catch(Exception failure){
                if(write&&admitted)throw new Failure("Delivery is unconfirmed. Check this conversation before retrying.",0,true);
                last=failure;
            }finally{if(connection!=null)connection.disconnect();}}
        throw new Failure("Connection unavailable. Check Wi-Fi or Tailscale.",0,false);
    }
    static long download(Profile profile,String path,File destination,int cap,long expectedBytes,Progress progress)throws Exception{
        return download(profile,path,destination,cap,expectedBytes,progress,null);
    }
    static long download(Profile profile,String path,File destination,int cap,long expectedBytes,Progress progress,String[] type)throws Exception{
        if(profile==null)throw new Failure("Phone pairing required.",0,false);
        if(!mediaPath(path)&&!"/v1/update/apk".equals(path))throw new Failure("Unsafe download path.",0,false);
        Exception last=null;
        for(String origin:profile.orderedOrigins()){HttpsURLConnection connection=null;
            try{connection=open(profile,origin,"GET",path);connection.setRequestProperty("Accept","application/octet-stream");
                int status=connection.getResponseCode();if(status!=200)throw new Failure("Download unavailable.",status,false);
                if(type!=null&&type.length>0)type[0]=connection.getContentType();
                long total=connection.getContentLengthLong();if(total>cap||expectedBytes>cap||(expectedBytes>=0&&total>=0&&total!=expectedBytes))throw new Failure("Download size mismatch.",status,false);
                long read=0;try(InputStream input=connection.getInputStream();OutputStream output=new FileOutputStream(destination)){
                    byte[] buffer=new byte[16384];int count;while((count=input.read(buffer))!=-1){read+=count;if(read>cap)throw new Failure("Download exceeds limit.",status,false);output.write(buffer,0,count);if(progress!=null)progress.update(read,total);}}
                if(expectedBytes>=0&&read!=expectedBytes)throw new Failure("Incomplete download.",status,false);profile.connected(origin);return read;
            }catch(Failure failure){destination.delete();throw failure;}catch(Exception failure){last=failure;destination.delete();}
            finally{if(connection!=null)connection.disconnect();}}
        throw new Failure("Download connection unavailable.",0,false);
    }
    static String readText(InputStream input,int cap)throws Exception{
        if(input==null)throw new IOException();ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;
        while((count=input.read(buffer))!=-1){if(output.size()+count>cap)throw new IOException();output.write(buffer,0,count);}return new String(output.toByteArray(),StandardCharsets.UTF_8);
    }
    static byte[] hex(String value){byte[] out=new byte[value.length()/2];for(int i=0;i<out.length;i++)out[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);return out;}
    static String sha256(File file)throws Exception{MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream input=new FileInputStream(file)){byte[] bytes=new byte[16384];int count;while((count=input.read(bytes))!=-1)digest.update(bytes,0,count);}StringBuilder result=new StringBuilder();for(byte value:digest.digest())result.append(String.format(Locale.ROOT,"%02x",value&255));return result.toString();}
}
