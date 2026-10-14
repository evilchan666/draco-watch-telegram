package org.omega.dracowatch;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.*;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.text.InputType;
import android.util.Base64;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Phone client with bundled rendering, native permissions, pinned transport and durable update flow. */
public final class MonitorActivity extends Activity {
    private static final String ORIGIN="https://draco.local";
    private static final int PICK=40, MIC=41, NOTIFICATIONS=42, UNKNOWN_SOURCES=43;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService workers=Executors.newFixedThreadPool(3);
    private final ExecutorService interactiveWorkers=Executors.newFixedThreadPool(2);
    private final ExecutorService readWorkers=Executors.newSingleThreadExecutor();
    private final ExecutorService observationWorkers=Executors.newSingleThreadExecutor();
    private final AtomicBoolean refreshing=new AtomicBoolean(false);
    private final NativeCallbacks callbacks=new NativeCallbacks();
    private final HashSet<String> requestIds=new HashSet<>();
    private final Object attachmentLock=new Object();
    private volatile DracoClient.Profile profile;
    private volatile boolean active,destroyed;
    private volatile String latestAgent="main";
    private volatile long pairingRevision;
    private WebView web; private boolean loaded;
    private TelegramSurface telegram;
    private MediaRecorder recorder; private File recording;
    private long recordingStarted; private Runnable recordingLimit;
    private File attachment; private String attachmentName,attachmentMime; private long attachmentDuration;
    private volatile boolean transferring;
    private MediaPlayer player; private boolean playerPrepared; private float playbackRate=1f; private Dialog mediaDialog; private String playingId;
    private UpdateController updater; private AttachmentStore mediaStore; private String attachmentId;
    private boolean resumeInstall;
    private boolean pickerOpen;private String pickerAgent,recordingAgent;
    private boolean microphonePermissionPending,pendingMicrophoneStart;

    @Override public void onCreate(Bundle state){
        super.onCreate(state);playbackRate=validRate(getSharedPreferences("draco-audio",MODE_PRIVATE).getFloat("rate",1f));if(state!=null&&state.getBoolean("pickerOpen")){String recipient=state.getString("pickerAgent");if(DracoClient.AGENTS.contains(recipient)){pickerAgent=recipient;pickerOpen=true;}}prunePlayback();mediaStore=new AttachmentStore(this);profile=DracoClient.loadProfile(this);updater=new UpdateController(this,workers,this::deliver);
        FrameLayout surface=new FrameLayout(this);surface.setBackgroundColor(Color.BLACK);
        web=new WebView(this);web.setBackgroundColor(Color.BLACK);surface.addView(web,new FrameLayout.LayoutParams(-1,-1));
        telegram=new TelegramSurface(this,this::telegramAction);surface.addView(telegram,new FrameLayout.LayoutParams(-1,-1));telegram.setVisibility(View.GONE);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        surface.setOnApplyWindowInsetsListener((view,insets)->{
            int left,top,right,bottom;boolean keyboard=false;
            if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                android.graphics.Insets ime=insets.getInsets(WindowInsets.Type.ime());left=bars.left;top=bars.top;right=bars.right;bottom=Math.max(bars.bottom,ime.bottom);keyboard=insets.isVisible(WindowInsets.Type.ime());}
            else{left=insets.getSystemWindowInsetLeft();top=insets.getSystemWindowInsetTop();right=insets.getSystemWindowInsetRight();bottom=insets.getSystemWindowInsetBottom();}
            FrameLayout.LayoutParams params=(FrameLayout.LayoutParams)web.getLayoutParams();
            if(params.leftMargin!=left||params.topMargin!=top||params.rightMargin!=right||params.bottomMargin!=bottom){params.setMargins(left,top,right,bottom);web.setLayoutParams(params);}
            FrameLayout.LayoutParams nativeParams=(FrameLayout.LayoutParams)telegram.getLayoutParams();if(nativeParams.leftMargin!=left||nativeParams.topMargin!=top||nativeParams.rightMargin!=right||nativeParams.bottomMargin!=bottom){nativeParams.setMargins(left,top,right,bottom);telegram.setLayoutParams(nativeParams);}
            JSONObject value=new JSONObject();try{value.put("keyboardVisible",keyboard);value.put("bottom",bottom/getResources().getDisplayMetrics().density);}catch(Exception ignored){}
            deliver("onDracoInsets",value);return insets;});
        setContentView(surface);surface.requestApplyInsets();
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setBlockNetworkLoads(true);settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(false);settings.setDefaultFontSize(16);
        settings.setTextZoom(Math.max(85,Math.min(180,Math.round(100*getResources().getConfiguration().fontScale))));
        settings.setSupportMultipleWindows(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(false);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);WebView.setWebContentsDebuggingEnabled(false);
        web.setWebChromeClient(new WebChromeClient());web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !entry(request.getUrl());}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return asset(request.getUrl());}
            @Override public void onPageFinished(WebView view,String url){if(!url.equals(ORIGIN+"/index.html"))return;loaded=true;lifecycle(active);appInfo();
                drainCallbacks();if(profile==null)connection("unpaired","Pair this phone with your DRACO client.");
                else{refresh(latestAgent);if(!resumeInstall)updater.check(false);}receiveShare(getIntent());}});
        web.addJavascriptInterface(new Bridge(),"DracoNative");web.loadUrl(ORIGIN+"/index.html");
    }
    private boolean entry(Uri uri){return "https".equals(uri.getScheme())&&"draco.local".equals(uri.getHost())&&uri.getPort()==-1&&"/index.html".equals(uri.getPath())&&uri.getQuery()==null&&uri.getUserInfo()==null;}
    private WebResourceResponse asset(Uri uri){String path=uri.getPath();
        if(!"https".equals(uri.getScheme())||!"draco.local".equals(uri.getHost())||uri.getPort()!=-1||uri.getQuery()!=null||uri.getUserInfo()!=null
            ||!("/index.html".equals(path)||"/app.js".equals(path)||"/chamber.js".equals(path)||"/environment.js".equals(path)||"/environment-bubbles.js".equals(path)||"/client-state.js".equals(path)||"/reply-speech.js".equals(path)||"/styles.css".equals(path)))return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,new ByteArrayInputStream(new byte[0]));
        try{Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");
            headers.put("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");
            return new WebResourceResponse(path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":"text/html","UTF-8",200,"OK",headers,getAssets().open("www"+path));}
        catch(Exception ex){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,new ByteArrayInputStream(new byte[0]));}}

    private void telegramAction(String action,JSONObject data){
        if(!active||destroyed||!loaded)return;
        JSONObject event=new JSONObject();try{event.put("action",action);event.put("data",data==null?new JSONObject():data);}catch(Exception ignored){return;}
        deliver("onDracoTelegramAction",event);
    }
    private final class Bridge {
        @JavascriptInterface public void renderTelegram(String json){
            if(json==null||json.length()>3000000)return;
            try{JSONObject payload=new JSONObject(json);main.post(()->{if(!destroyed&&telegram!=null)telegram.render(payload);});}catch(JSONException ignored){}
        }
        @JavascriptInterface public void notifyTelegram(String text){main.post(()->{if(telegram!=null&&telegram.showing()&&text!=null&&text.length()<=2000)Toast.makeText(MonitorActivity.this,text,Toast.LENGTH_LONG).show();});}

        @JavascriptInterface public void refresh(String agent){main.post(()->MonitorActivity.this.refresh(agent));}
        @JavascriptInterface public void request(String id,String method,String path,String json){boolean bulk=NativeIoPolicy.bulk(method,path,json);main.post(()->requestJson(id,method,path,json,bulk));}
        @JavascriptInterface public void copyText(String text){main.post(()->{if(text!=null&&text.length()<65536)((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("DRACO message",text));});}
        @JavascriptInterface public void shareText(String text){main.post(()->{if(text!=null&&text.length()<65536)startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text),"Share message"));});}
        @JavascriptInterface public void openLink(String url){main.post(()->{try{Uri uri=Uri.parse(url);if(url.length()>4000||!("https".equals(uri.getScheme())||"http".equals(uri.getScheme()))||uri.getHost()==null||uri.getUserInfo()!=null)return;startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}});}
        @JavascriptInterface public void openSettings(){main.post(()->showSettings());}
        @JavascriptInterface public void hideKeyboard(){main.post(()->{android.view.inputmethod.InputMethodManager input=(android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);if(input!=null)input.hideSoftInputFromWindow(web.getWindowToken(),0);web.clearFocus();});}
        @JavascriptInterface public void chooseAttachment(){main.post(()->pickAttachment(latestAgent));}
        @JavascriptInterface public void chooseAttachment(String agent){main.post(()->pickAttachment(agent));}
        @JavascriptInterface public void startRecording(){main.post(()->beginRecording(latestAgent));}
        @JavascriptInterface public void startRecording(String agent){main.post(()->beginRecording(agent));}
        @JavascriptInterface public void stopRecording(){main.post(()->finishRecording(false));}
        @JavascriptInterface public void cancelAttachment(){main.post(()->clearAttachment());}
        @JavascriptInterface public void cancelAttachment(String id){main.post(()->{if(id!=null&&id.equals(attachmentId))clearAttachment();else if(id!=null){mediaStore.remove(id);JSONObject result=new JSONObject();try{result.put("id",id);result.put("state","cancelled");}catch(Exception ignored){}deliver("onDracoAttachment",result);}});}
        @JavascriptInterface public void uploadAttachment(String agent,String caption,String mode,String id){main.post(()->upload(agent,caption,mode,id));}
        @JavascriptInterface public void playMedia(String path,String id){main.post(()->play(path,id));}
        @JavascriptInterface public void releaseAttachment(String id){main.post(()->{if(id!=null)mediaStore.remove(id);});}
        @JavascriptInterface public String stagedAttachments(){return mediaStore.descriptors().toString();}
        @JavascriptInterface public void previewAttachment(String id){main.post(()->preview(id));}
        @JavascriptInterface public void setPlaybackRate(double rate){main.post(()->changePlaybackRate((float)rate));}
        @JavascriptInterface public void stopMedia(){main.post(()->stopPlayback());}
        @JavascriptInterface public void checkUpdates(){main.post(()->updater.check(true));}
        @JavascriptInterface public void installUpdate(){main.post(()->updater.install());}
        @JavascriptInterface public void uninstall(){main.post(()->requestUninstall());}
        @JavascriptInterface public void appSettings(){main.post(()->startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()))));}
        @JavascriptInterface public void setNotifications(boolean enabled){main.post(()->notifications(enabled));}
        @JavascriptInterface public String appInfo(){return info().toString();}
    }
    private JSONObject info(){JSONObject value=new JSONObject();try{value.put("packageName",getPackageName());value.put("versionName",getPackageManager().getPackageInfo(getPackageName(),0).versionName);value.put("versionCode",getPackageManager().getPackageInfo(getPackageName(),0).versionCode);
        value.put("notificationsEnabled",getSharedPreferences("phone",MODE_PRIVATE).getBoolean("notifications",false));value.put("fontScale",getResources().getConfiguration().fontScale);value.put("nativeMedia",true);value.put("playbackRate",playbackRate);value.put("cooperativeAudio",true);ActivityManager manager=(ActivityManager)getSystemService(ACTIVITY_SERVICE);value.put("lowMemoryDevice",manager.isLowRamDevice());value.put("memoryClass",manager.getMemoryClass());value.put("densityDpi",getResources().getDisplayMetrics().densityDpi);value.put("widthDp",getResources().getConfiguration().screenWidthDp);}catch(Exception ignored){}return value;}
    private void appInfo(){deliver("onDracoAppInfo",info());}
    private void refresh(String agent){if(!DracoClient.AGENTS.contains(agent)||!active||destroyed)return;latestAgent=agent;
        getSharedPreferences("phone",MODE_PRIVATE).edit().putString("agent",agent).apply();
        if(profile==null){connection("unpaired","Pair this phone with your DRACO client.");return;}if(!refreshing.compareAndSet(false,true))return;
        DracoClient.Profile selected=profile;long revision=pairingRevision;readLane("/v1/snapshot?agent="+agent).execute(()->{
            try{DracoClient.Response response=DracoClient.request(selected,"GET","/v1/snapshot?agent="+agent,null,null);
                if(response.status!=200)throw new DracoClient.Failure(response.status==401?"Phone pairing rejected.":"Live connection unavailable.",response.status,false);
                if(!response.data.has("agents")||!agent.equals(response.data.optString("selectedAgent")))throw new IOException();
                if(active&&revision==pairingRevision&&agent.equals(latestAgent))deliver("onDracoSnapshot",response.data);
            }catch(Exception ex){if(active&&revision==pairingRevision&&agent.equals(latestAgent))connection("offline",ex instanceof DracoClient.Failure?ex.getMessage():"Live connection unavailable.");}
            finally{refreshing.set(false);if(active&&(!agent.equals(latestAgent)||revision!=pairingRevision))main.post(()->refresh(latestAgent));}});
    }
    private void requestJson(String id,String method,String path,String json,boolean bulk){
        if(!active||destroyed||id==null||!id.matches("[A-Za-z0-9_-]{1,100}")||!DracoClient.permitted(method,path)){responseError(id,"Unsupported native request.",false);return;}
        if(json==null||json.length()>65536){responseError(id,"Message exceeds the client limit.",false);return;}
        int claim=claimRequest(id);if(claim!=0){responseError(id,claim==1?"The original request is still running. Delivery remains unconfirmed.":"The client is busy. Try again after another request finishes.",claim==1&&"POST".equals(method));return;}
        DracoClient.Profile selected=profile;long revision=pairingRevision;
        ExecutorService lane="GET".equals(method)?readLane(path):bulk?workers:interactiveWorkers;
        lane.execute(()->{try{byte[] body=null;if("POST".equals(method)){JSONObject request=new JSONObject(json);if(!request.has("idempotencyKey"))request.put("idempotencyKey",id);
                JSONArray ids=request.optJSONArray("attachmentIds");if(ids!=null){if(!"/v1/message".equals(path)||ids.length()>8)throw new IOException("Invalid attachment request.");JSONArray payloads=new JSONArray();long total=0;for(int i=0;i<ids.length();i++){AttachmentStore.Item item=mediaStore.get(ids.getString(i));if(item==null)throw new IOException("An attachment is missing. Choose it again.");total+=item.file.length();if(total>DracoClient.MEDIA_CAP)throw new IOException("Attachments exceed the 8 MB transfer limit.");payloads.put(item.transfer());}request.remove("attachmentIds");request.put("attachments",payloads);}
                body=request.toString().getBytes(StandardCharsets.UTF_8);}
            final long[] lastProgress={0};DracoClient.Response response=DracoClient.request(selected,method,path,body,"POST".equals(method)?(sent,total)->{long now=SystemClock.elapsedRealtime();if(total>65536&&(sent==total||now-lastProgress[0]>120)){lastProgress[0]=now;transfer(id,"uploading",sent,total);}}:null);if(revision!=pairingRevision){responseError(id,"Pairing changed. Check the original conversation for delivery.","POST".equals(method));return;}response(id,response);}
            catch(Exception ex){responseError(id,ex instanceof DracoClient.Failure?ex.getMessage():"Request unavailable.",ex instanceof DracoClient.Failure&&((DracoClient.Failure)ex).uncertain);}
            finally{releaseRequest(id);}});
    }
    private synchronized int claimRequest(String id){if(requestIds.contains(id))return 1;if(requestIds.size()>=8)return 2;requestIds.add(id);return 0;}
    private ExecutorService readLane(String path){return path.startsWith("/v1/snapshot?")?observationWorkers:readWorkers;}
    private synchronized void releaseRequest(String id){requestIds.remove(id);}
    private void response(String id,DracoClient.Response response){JSONObject value=new JSONObject();try{value.put("id",id);value.put("ok",response.status>=200&&response.status<300);value.put("status",response.status);value.put("data",response.data);if(response.status>=400)value.put("error",response.data.optString("error","Request declined."));}catch(Exception ignored){}deliver("onDracoResponse",value);}
    private void responseError(String id,String error,boolean uncertain){JSONObject value=new JSONObject();try{value.put("id",id);value.put("ok",false);value.put("status",0);value.put("error",error);value.put("unconfirmed",uncertain);value.put("uncertain",uncertain);}catch(Exception ignored){}deliver("onDracoResponse",value);}
    private void connection(String state,String message){JSONObject value=new JSONObject();try{value.put("state",state);value.put("message",message);}catch(Exception ignored){}deliver("onDracoConnection",value);}
    void deliver(String callback,JSONObject value){String progressKey=null;if("onDracoTransfer".equals(callback))progressKey=callback+":"+value.optString("id")+":"+value.optString("state");else if("onDracoUpdate".equals(callback)&&"downloading".equals(value.optString("state")))progressKey=callback+":"+value.optInt("versionCode")+":downloading";
        if(!callbacks.shouldEmit(progressKey,SystemClock.elapsedRealtime(),value.optLong("bytes"),value.optLong("total")))return;
        String supersedes=null;if("onDracoResponse".equals(callback)||"onDracoPlayback".equals(callback))supersedes="onDracoTransfer:"+value.optString("id")+":";else if("onDracoUpdate".equals(callback)&&progressKey==null)supersedes="onDracoUpdate:"+value.optInt("versionCode")+":";
        NativeCallbacks.Event event=new NativeCallbacks.Event(callback,value.toString(),progressKey,supersedes);main.post(()->{if(destroyed)return;if(loaded&&active)dispatch(event);else callbacks.offer(event);});}
    private void dispatch(NativeCallbacks.Event event){web.evaluateJavascript(event.script,null);}
    private void drainCallbacks(){if(!loaded||!active||destroyed)return;NativeCallbacks.Event event;while((event=callbacks.poll())!=null)dispatch(event);}
    private void lifecycle(boolean value){if(loaded&&!destroyed)web.evaluateJavascript("if(typeof window.onDracoLifecycle==='function')window.onDracoLifecycle({active:"+value+"});",null);}

    private void pickAttachment(String agent){if(!active||transferring||recorder!=null||pickerOpen||!DracoClient.AGENTS.contains(agent))return;pickerAgent=agent;pickerOpen=true;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("*/*");intent.addCategory(Intent.CATEGORY_OPENABLE);intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivityForResult(intent,PICK);}
    private void importUri(Uri uri,String agent){if(uri==null||transferring||!DracoClient.AGENTS.contains(agent))return;attachmentEvent(agent,"importing",null,null,0,0,null,null);
        workers.execute(()->{File temporary=null;try{String name="attachment",mime=getContentResolver().getType(uri);long stated=-1;
            try(android.database.Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){if(cursor!=null&&cursor.moveToFirst()){name=cursor.getString(0);if(!cursor.isNull(1))stated=cursor.getLong(1);}}
            if(stated>DracoClient.MEDIA_CAP||(mime!=null&&mime.startsWith("image/")&&stated>6*1024*1024))throw new IOException("Choose a file smaller than 8 MB, or an image smaller than 6 MB.");
            name=name==null?"attachment":name.replaceAll("[\\p{Cntrl}/\\\\]","_");if(name.length()>160)name=name.substring(0,160);
            mime=mime==null?"application/octet-stream":mime;if(!mime.matches("[A-Za-z0-9.+_-]+/[A-Za-z0-9.+_-]+"))mime="application/octet-stream";
            temporary=File.createTempFile("picked-",".media",getCacheDir());long count=0;
            try(InputStream input=getContentResolver().openInputStream(uri);OutputStream output=new FileOutputStream(temporary)){if(input==null)throw new IOException();byte[] buffer=new byte[16384];int read;while((read=input.read(buffer))!=-1){count+=read;if(count>DracoClient.MEDIA_CAP||(mime.startsWith("image/")&&count>6*1024*1024))throw new IOException("Choose a file smaller than 8 MB, or an image smaller than 6 MB.");output.write(buffer,0,read);}}
            if(count==0)throw new IOException("This file is empty.");String preview=thumbnail(temporary,mime);AttachmentStore.Item item;synchronized(attachmentLock){item=mediaStore.add(temporary,name,mime,0);attachment=item.file;attachmentId=item.id;attachmentName=name;attachmentMime=mime;attachmentDuration=0;}
            attachmentReady(item,preview,agent);
        }catch(Exception ex){if(temporary!=null)temporary.delete();attachmentEvent(agent,"error",null,null,0,0,null,ex instanceof IOException&&ex.getMessage()!=null?ex.getMessage():"The selected file could not be read.");}});
    }
    private String thumbnail(File file,String mime){if(!mime.startsWith("image/"))return null;try{BitmapFactory.Options probe=new BitmapFactory.Options();probe.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getPath(),probe);if(probe.outWidth<=0||probe.outHeight<=0)return null;probe.inJustDecodeBounds=false;probe.inSampleSize=Math.max(1,Math.max(probe.outWidth,probe.outHeight)/480);Bitmap image=BitmapFactory.decodeFile(file.getPath(),probe);if(image==null)return null;ByteArrayOutputStream output=new ByteArrayOutputStream();image.compress(Bitmap.CompressFormat.JPEG,75,output);image.recycle();if(output.size()>256000)return null;return "data:image/jpeg;base64,"+Base64.encodeToString(output.toByteArray(),Base64.NO_WRAP);}catch(Exception ex){return null;}}
    private void beginRecording(String agent){if(!active||transferring||recorder!=null||pickerOpen||microphonePermissionPending||!DracoClient.AGENTS.contains(agent))return;recordingAgent=agent;if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){microphonePermissionPending=true;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC);return;}
        stopPlayback();try{recording=File.createTempFile("voice-",".m4a",getCacheDir());recorder=new MediaRecorder();recorder.setAudioSource(MediaRecorder.AudioSource.MIC);recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);recorder.setAudioSamplingRate(44100);recorder.setAudioEncodingBitRate(96000);recorder.setMaxDuration(120000);recorder.setMaxFileSize(DracoClient.MEDIA_CAP);recorder.setOutputFile(recording.getPath());recorder.setOnInfoListener((value,what,extra)->{if(what==MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED||what==MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED)main.post(()->finishRecording(false));});recorder.prepare();recorder.start();recordingStarted=SystemClock.elapsedRealtime();attachmentEvent(agent,"recording","Voice message.m4a","audio/mp4",0,0,null,null);recordingLimit=()->finishRecording(false);main.postDelayed(recordingLimit,120000);}
        catch(Exception ex){finishRecording(true);attachmentEvent(agent,"error",null,null,0,0,null,"Microphone could not start. Check permission and other recording apps.");}}
    private void finishRecording(boolean cancel){if(recorder==null)return;if(recordingLimit!=null)main.removeCallbacks(recordingLimit);MediaRecorder selected=recorder;recorder=null;long duration=SystemClock.elapsedRealtime()-recordingStarted;
        try{selected.stop();}catch(Exception ex){cancel=true;}finally{selected.reset();selected.release();}
        String agent=recordingAgent;File file=recording;recording=null;if(cancel||file==null||duration<350||file.length()<128||file.length()>DracoClient.MEDIA_CAP){if(file!=null)file.delete();attachmentEvent(agent,"cancelled",null,null,0,0,null,null);return;}
        try{AttachmentStore.Item item;synchronized(attachmentLock){item=mediaStore.add(file,"Voice message.m4a","audio/mp4",duration);attachment=item.file;attachmentId=item.id;attachmentName=item.name;attachmentMime=item.mime;attachmentDuration=duration;}attachmentReady(item,null,agent);}catch(Exception ex){file.delete();attachmentEvent(agent,"error",null,null,0,0,null,"Voice recording could not be saved.");}}
    private void clearAttachment(){if(microphonePermissionPending||pendingMicrophoneStart){microphonePermissionPending=false;pendingMicrophoneStart=false;attachmentEvent(recordingAgent,"cancelled",null,null,0,0,null,null);return;}if(recorder!=null){finishRecording(true);return;}if(transferring)return;String removed; synchronized(attachmentLock){removed=attachmentId;if(removed!=null)mediaStore.remove(removed);attachment=null;attachmentId=null;attachmentName=null;attachmentMime=null;attachmentDuration=0;}JSONObject value=new JSONObject();try{value.put("state","cancelled");if(removed!=null)value.put("id",removed);}catch(Exception ignored){}deliver("onDracoAttachment",value);}
    private void attachmentEvent(String state,String name,String mime,long bytes,long duration,String preview,String error){attachmentEvent(null,state,name,mime,bytes,duration,preview,error);}
    private void attachmentEvent(String agent,String state,String name,String mime,long bytes,long duration,String preview,String error){JSONObject value=new JSONObject();try{value.put("state",state);if(agent!=null)value.put("agent",agent);if(name!=null)value.put("name",name);if(mime!=null){value.put("mime",mime);value.put("mimeType",mime);}value.put("bytes",bytes);value.put("sizeBytes",bytes);value.put("durationMs",duration);if(preview!=null)value.put("preview",preview);if(error!=null)value.put("error",error);}catch(Exception ignored){}deliver("onDracoAttachment",value);}
    private void attachmentReady(AttachmentStore.Item item,String preview,String agent){try{JSONObject value=item.descriptor();value.put("state","ready");value.put("agent",agent);if(preview!=null)value.put("preview",preview);deliver("onDracoAttachment",value);}catch(Exception ignored){attachmentEvent(agent,"error",null,null,0,0,null,"Attachment metadata could not be read.");}}
    private void transfer(String id,String state,long bytes,long total){JSONObject value=new JSONObject();try{value.put("id",id);value.put("state",state);value.put("bytes",bytes);value.put("total",total);value.put("progress",total>0?Math.min(100,Math.round(100.0*bytes/total)):0);}catch(Exception ignored){}deliver("onDracoTransfer",value);}
    private void upload(String agent,String caption,String mode,String id){responseError(id,"Use the explicit message action with attachmentIds and the current session identity.",false);}
    private long playGeneration;
    private void play(String path,String id){if(!DracoClient.mediaPath(path)||id==null||id.length()>1200){playback(id,"error","That media link is not available through the private client.");return;}stopPlayback();playingId=id;final long generation=playGeneration;playback(id,"loading",null);DracoClient.Profile selected=profile;workers.execute(()->{
        try{File file=new File(getCacheDir(),"playback-"+UUID.randomUUID()+".media");String[] mediaType={"application/octet-stream"};DracoClient.download(selected,path,file,DracoClient.DOWNLOAD_CAP,-1,(bytes,total)->transfer(id,"downloading",bytes,total),mediaType);
            main.post(()->{if(destroyed||!active||generation!=playGeneration||!id.equals(playingId)){file.delete();return;}playback(id,"downloaded",null);playLocal(file,mediaType[0],id);});
        }catch(Exception ex){main.post(()->{if(generation==playGeneration&&id.equals(playingId))finishPlayback("error","Media download unavailable.");});}});
    }
    private void preview(String id){AttachmentStore.Item item=mediaStore.get(id);if(item==null){playback(id,"error","This staged attachment is no longer available.");return;}stopPlayback();playingId=id;playLocal(item.file,item.mime,id);}
    private void playLocal(File file,String mediaType,String id){if(destroyed||!active||!id.equals(playingId))return;try{String mime=mediaType==null?"application/octet-stream":mediaType.split(";")[0];
        if(mime.startsWith("image/")){showImage(file,id);return;}if(mime.startsWith("video/")){showVideo(file,id);return;}if(!mime.startsWith("audio/")){openDocument(file,mime,id);return;}
        // Deliberate cooperative mixing: do not request, abandon, or duck audio focus.
        AudioAttributes attributes=new AudioAttributes.Builder().setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).setUsage(AudioAttributes.USAGE_MEDIA).build();
        playerPrepared=false;player=new MediaPlayer();player.setAudioAttributes(attributes);player.setDataSource(file.getPath());player.setOnPreparedListener(value->{if(player!=value||!active||!id.equals(playingId))return;playerPrepared=true;try{applyPlaybackRate(value);value.start();playback(id,"playing",null);}catch(Exception ex){finishPlayback("error","Pitch-preserving playback speed is unavailable. Choose 1x and deliberately replay.");}});player.setOnCompletionListener(value->{if(player==value&&id.equals(playingId))finishPlayback("ended",null);});player.setOnErrorListener((value,what,extra)->{if(player==value&&id.equals(playingId))finishPlayback("error","This media could not be played.");return true;});player.prepareAsync();
    }catch(Exception ex){finishPlayback("error","This media could not be opened.");}}
    private static float validRate(float rate){return rate==.5f||rate==.75f||rate==1f||rate==1.25f||rate==1.5f||rate==2f?rate:1f;}
    private void applyPlaybackRate(MediaPlayer value){value.setPlaybackParams(new PlaybackParams().allowDefaults().setAudioFallbackMode(PlaybackParams.AUDIO_FALLBACK_MODE_FAIL).setPitch(1f).setSpeed(playbackRate));}
    private void changePlaybackRate(float requested){if(validRate(requested)!=requested){playback(playingId,"rate-error","Unsupported playback speed.");return;}float previous=playbackRate;playbackRate=requested;
        try{if(player!=null&&playerPrepared&&player.isPlaying())applyPlaybackRate(player);getSharedPreferences("draco-audio",MODE_PRIVATE).edit().putFloat("rate",playbackRate).apply();appInfo();}
        catch(Exception ex){playbackRate=previous;try{if(player!=null&&playerPrepared&&player.isPlaying())applyPlaybackRate(player);}catch(Exception ignored){}playback(playingId,"rate-error","This device cannot apply that speed without changing pitch. Previous speed retained.");appInfo();}}
    private void showImage(File file,String id){BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getPath(),options);options.inSampleSize=Math.max(1,Math.max(options.outWidth,options.outHeight)/2048);options.inJustDecodeBounds=false;Bitmap image=BitmapFactory.decodeFile(file.getPath(),options);if(image==null){playback(id,"error","This image could not be opened.");return;}Dialog dialog=new Dialog(this,android.R.style.Theme_Material_NoActionBar_Fullscreen);FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);ImageView view=new ImageView(this);view.setImageBitmap(image);view.setScaleType(ImageView.ScaleType.FIT_CENTER);root.addView(view,new FrameLayout.LayoutParams(-1,-1));
        final float[] scale={1};ScaleGestureDetector detector=new ScaleGestureDetector(this,new ScaleGestureDetector.SimpleOnScaleGestureListener(){@Override public boolean onScale(ScaleGestureDetector value){scale[0]=Math.max(1,Math.min(6,scale[0]*value.getScaleFactor()));view.setScaleX(scale[0]);view.setScaleY(scale[0]);return true;}});view.setOnTouchListener((target,event)->{detector.onTouchEvent(event);return true;});Button close=new Button(this);close.setText("Close image");FrameLayout.LayoutParams params=new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.END);root.addView(close,params);close.setOnClickListener(v->dialog.dismiss());dialog.setContentView(root);dialog.setOnDismissListener(value->{image.recycle();if(dialog==mediaDialog){mediaDialog=null;playingId=null;}playback(id,"ended",null);});mediaDialog=dialog;dialog.show();playback(id,"viewing",null);}
    private void showVideo(File file,String id){Dialog dialog=new Dialog(this,android.R.style.Theme_Material_NoActionBar_Fullscreen);FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);VideoView video=new VideoView(this);FrameLayout.LayoutParams vp=new FrameLayout.LayoutParams(-1,-1,Gravity.CENTER);root.addView(video,vp);MediaController controls=new MediaController(this);controls.setAnchorView(video);video.setMediaController(controls);video.setVideoPath(file.getPath());video.setOnPreparedListener(value->{video.start();playback(id,"playing",null);});video.setOnCompletionListener(value->{dialog.dismiss();playback(id,"ended",null);});video.setOnErrorListener((value,what,extra)->{dialog.dismiss();playback(id,"error","Video playback failed.");return true;});Button close=new Button(this);close.setText("Close video");root.addView(close,new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.END));close.setOnClickListener(v->dialog.dismiss());dialog.setContentView(root);dialog.setOnDismissListener(value->{video.stopPlayback();if(dialog==mediaDialog){mediaDialog=null;playingId=null;}playback(id,"stopped",null);});mediaDialog=dialog;dialog.show();}
    private void openDocument(File file,String mime,String id){try{String name=file.getName().matches("[a-f0-9-]{36}")?"staged-"+file.getName():file.getName();Uri uri=Uri.parse("content://"+getPackageName()+".media/"+name);Intent open=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(open,"Open private attachment"));playback(id,"opened",null);}catch(Exception ex){playback(id,"error","No installed application can open this attachment.");}}
    private void stopPlayback(){finishPlayback("stopped",null);}
    private void finishPlayback(String state,String error){playGeneration++;String id=playingId;playingId=null;playerPrepared=false;if(player!=null){try{player.stop();}catch(Exception ignored){}player.release();player=null;}if(mediaDialog!=null){mediaDialog.dismiss();mediaDialog=null;}if(id!=null)playback(id,state,error);}
    private void playback(String id,String state,String error){JSONObject value=new JSONObject();try{value.put("id",id);value.put("state",state);value.put("playbackRate",playbackRate);value.put("pitch",1);value.put("cooperativeAudio",true);if(error!=null)value.put("error",error);if(player!=null&&"playing".equals(state))value.put("durationMs",player.getDuration());}catch(Exception ignored){}deliver("onDracoPlayback",value);}
    private void prunePlayback(){File[] files=getCacheDir().listFiles();if(files==null)return;long now=System.currentTimeMillis();for(File file:files)if(file.getName().startsWith("playback-")&&now-file.lastModified()>86400000L)file.delete();}
    private void receiveShare(Intent intent){if(intent==null||!Intent.ACTION_SEND.equals(intent.getAction()))return;String text=intent.getStringExtra(Intent.EXTRA_TEXT);if(text!=null){JSONObject value=new JSONObject();try{value.put("text",text.substring(0,Math.min(16000,text.length())));value.put("agent",latestAgent);}catch(Exception ignored){}deliver("onDracoShare",value);}Uri uri=intent.getParcelableExtra(Intent.EXTRA_STREAM);if(uri!=null)importUri(uri,latestAgent);intent.setAction(Intent.ACTION_MAIN);}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(loaded)receiveShare(intent);}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==PICK){pickerOpen=false;String agent=pickerAgent;pickerAgent=null;if(result==RESULT_OK&&data!=null){if(!DracoClient.AGENTS.contains(agent)){attachmentEvent("error",null,null,0,0,null,"Attachment selection expired. Choose it again from the intended conversation.");return;}ClipData clips=data.getClipData();if(clips!=null){if(clips.getItemCount()>8)attachmentEvent(agent,"error",null,null,0,0,null,"Choose at most 8 files at once.");else for(int i=0;i<clips.getItemCount();i++)importUri(clips.getItemAt(i).getUri(),agent);}else importUri(data.getData(),agent);}}if(request==UNKNOWN_SOURCES){resumeInstall=Build.VERSION.SDK_INT<26||getPackageManager().canRequestPackageInstalls();if(!resumeInstall)updater.event("permission","Android install permission was not enabled. Your existing app is unchanged.",0,0);}}
    @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);if(pickerOpen&&DracoClient.AGENTS.contains(pickerAgent)){state.putBoolean("pickerOpen",true);state.putString("pickerAgent",pickerAgent);}}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==MIC){boolean requested=microphonePermissionPending;microphonePermissionPending=false;if(requested&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED){pendingMicrophoneStart=true;resumeMicrophoneStart();}else if(requested){pendingMicrophoneStart=false;attachmentEvent(recordingAgent,"error",null,null,0,0,null,"Microphone permission was not granted.");}}if(request==NOTIFICATIONS){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)notifications(true);else deliver("onDracoAppInfo",info());}}
    private void resumeMicrophoneStart(){if(!active||!pendingMicrophoneStart||destroyed)return;pendingMicrophoneStart=false;if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)beginRecording(recordingAgent);else attachmentEvent(recordingAgent,"error",null,null,0,0,null,"Microphone permission is no longer available.");}
    private void notifications(boolean enabled){if(enabled&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATIONS);return;}
        getSharedPreferences("phone",MODE_PRIVATE).edit().putBoolean("notifications",enabled).apply();WatchJobService.schedule(this,enabled);appInfo();}
    private void requestUninstall(){if(!active||destroyed)return;Uri ownPackage=Uri.parse("package:"+getPackageName());try{startActivity(new Intent(Intent.ACTION_DELETE,ownPackage));}catch(ActivityNotFoundException|SecurityException blocked){try{startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,ownPackage));Toast.makeText(this,"Use Android's Uninstall button to remove DRACO Watch.",Toast.LENGTH_LONG).show();}catch(ActivityNotFoundException|SecurityException unavailable){Toast.makeText(this,"Android could not open uninstall. Open Settings, Apps, DRACO Watch to remove it.",Toast.LENGTH_LONG).show();}}}
    private void showSettings(){if(!active)return;String version=info().optString("versionName");new AlertDialog.Builder(this).setTitle("DRACO Watch "+version).setItems(new String[]{"Check for updates","Notifications: "+(info().optBoolean("notificationsEnabled")?"on":"off"),"Change private pairing","Android app settings","Uninstall DRACO Watch"},(dialog,index)->{
        if(index==0)updater.check(true);else if(index==1)notifications(!info().optBoolean("notificationsEnabled"));else if(index==2)showPairing();else if(index==3)startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())));else requestUninstall();}).setNegativeButton("Close",null).show();}
    private void showPairing(){EditText code=new EditText(this);code.setMinLines(3);code.setMaxLines(5);code.setHint("Paste private pairing code");code.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD|InputType.TYPE_TEXT_FLAG_MULTI_LINE);code.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);code.setPadding(36,20,36,20);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Private client pairing").setMessage("This profile permits communication with your own agents. Keep the pairing code private.").setView(code).setNegativeButton("Cancel",null).setPositiveButton("Pair",null).create();
        dialog.setOnShowListener(ignored->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view->{try{JSONObject raw=DracoClient.decodePairing(code.getText().toString());DracoClient.Profile next=new DracoClient.Profile(raw);getSharedPreferences("pairing",MODE_PRIVATE).edit().putString("profile",raw.toString()).commit();profile=next;pairingRevision++;code.setText("");dialog.dismiss();connection("connecting","Connecting to your private client.");refresh(latestAgent);}catch(Exception ex){code.setError("That private pairing code is invalid.");}}));dialog.show();}
    DracoClient.Profile currentProfile(){return profile;}
    void requestUnknownSources(){resumeInstall=false;startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())),UNKNOWN_SOURCES);}
    @Override protected void onResume(){super.onResume();active=true;if(web!=null){web.onResume();web.resumeTimers();lifecycle(true);drainCallbacks();}resumeMicrophoneStart();if(resumeInstall){resumeInstall=false;updater.install();}else if(loaded){refresh(latestAgent);updater.check(false);}}
    @Override protected void onPause(){active=false;finishRecording(false);stopPlayback();lifecycle(false);if(web!=null){web.onPause();web.pauseTimers();}super.onPause();}
    @Override protected void onDestroy(){destroyed=true;active=false;microphonePermissionPending=false;pendingMicrophoneStart=false;updater.close();finishRecording(true);stopPlayback();workers.shutdownNow();interactiveWorkers.shutdownNow();readWorkers.shutdownNow();observationWorkers.shutdownNow();if(web!=null){web.removeJavascriptInterface("DracoNative");web.destroy();}super.onDestroy();}
    @Override public void onConfigurationChanged(Configuration configuration){super.onConfigurationChanged(configuration);if(web!=null){web.getSettings().setTextZoom(Math.max(85,Math.min(180,Math.round(100*configuration.fontScale))));appInfo();}}
    @Override public void onBackPressed(){if(recorder!=null){finishRecording(false);return;}if(telegram!=null&&telegram.showing()&&telegram.back())return;if(web!=null){web.evaluateJavascript("Boolean(window.DracoWatch&&typeof window.DracoWatch.back==='function'&&window.DracoWatch.back())",value->{if(!"true".equals(value))finish();});return;}super.onBackPressed();}
}
