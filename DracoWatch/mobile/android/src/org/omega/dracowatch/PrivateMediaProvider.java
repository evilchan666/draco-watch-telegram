package org.omega.dracowatch;
import android.content.*;
import android.database.*;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

/** Read-only explicit URI grants for downloaded private documents, not general file access. */
public final class PrivateMediaProvider extends ContentProvider {
    @Override public boolean onCreate(){return true;}
    private File file(Uri uri)throws FileNotFoundException{String name=uri.getLastPathSegment();if(name==null||!(name.matches("playback-[a-f0-9-]{36}\\.media")||name.matches("staged-[a-f0-9-]{36}")||support(name))||uri.getPathSegments().size()!=1||uri.getQuery()!=null||uri.getFragment()!=null)throw new FileNotFoundException();File result=name.startsWith("staged-")?new File(new File(getContext().getFilesDir(),"staged-media"),name.substring(7)):new File(getContext().getCacheDir(),name);if(!result.isFile())throw new FileNotFoundException();return result;}
    static boolean support(String name){return name!=null&&(name.matches("support-diagnostics-[a-f0-9-]{36}\\.json")||name.matches("support-operation-[a-f0-9-]{36}\\.txt"));}
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException();return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
    @Override public String getType(Uri uri){String name=uri.getLastPathSegment();return support(name)?name.endsWith(".json")?"application/json":"text/plain":"application/octet-stream";}
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] arguments,String sort){try{File file=file(uri);MatrixCursor cursor=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});cursor.addRow(new Object[]{support(file.getName())?file.getName().endsWith(".json")?"DRACO diagnostics.json":"DRACO recorded operation.txt":"DRACO attachment",file.length()});return cursor;}catch(Exception ex){return null;}}
    @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}
    @Override public int delete(Uri uri,String selection,String[] arguments){throw new UnsupportedOperationException();}
    @Override public int update(Uri uri,ContentValues values,String selection,String[] arguments){throw new UnsupportedOperationException();}
}
