package sg.kithandkeen.ordo;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.common.util.UnstableApi;
import org.json.JSONObject;

/** Reuses the rasterized, font-exact title. Only animated edges require a bitmap redraw. */
@UnstableApi
final class TitleOverlay extends BitmapOverlay {
    private Bitmap source;
    private final Bitmap blank;
    private final java.io.File file;
    boolean animated;
    private Bitmap first, second;
    private final JSONObject text;
    TitleOverlay(java.io.File file, JSONObject text) {
        this.file=file; this.text=text;
        blank=Bitmap.createBitmap(1,1,Bitmap.Config.ARGB_8888);
    }
    @Override public Bitmap getBitmap(long timeUs) {
        double frame=timeUs*30.0/1000000-text.optInt("startFrame"),frames=text.optInt("frames");
        animated=false;
        if(frame<0||frame>=frames){if(source!=null){source.recycle();source=null;}if(first!=null){first.recycle();second.recycle();first=second=null;}return blank;}
        if(source==null){source=android.graphics.BitmapFactory.decodeFile(file.getAbsolutePath());if(source==null)throw new IllegalStateException("Could not read title image.");}
        JSONObject start=text.optJSONObject("startTransition"),end=text.optJSONObject("endTransition");
        double s=start==null?0:Math.min(frames,start.optInt("frames")),e=end==null?0:Math.min(frames,end.optInt("frames"));
        boolean entering=s>0&&frame<s,leaving=e>0&&frame>=frames-e;
        if(!entering&&!leaving)return source;
        animated=true;
        if(first==null){first=Bitmap.createBitmap(source.getWidth(),source.getHeight(),Bitmap.Config.ARGB_8888);second=Bitmap.createBitmap(source.getWidth(),source.getHeight(),Bitmap.Config.ARGB_8888);}
        Bitmap image=source;
        if(entering){edge(first,image,start.optString("type"),(float)(frame/s),true);image=first;}
        if(leaving){edge(second,image,end.optString("type"),(float)((frame-frames+e)/e),false);image=second;}
        return image;
    }
    static void edge(Bitmap output,Bitmap image,String type,float progress,boolean start){
        Canvas canvas=new Canvas(output);canvas.drawColor(Color.TRANSPARENT,PorterDuff.Mode.CLEAR);canvas.save();
        float a=Math.max(0,Math.min(1,start?progress:1-progress)),w=output.getWidth(),h=output.getHeight();
        Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        if(type.equals("fade-black")||type.equals("fade-white")){
            // Preserve the source alpha while mixing the text colour with the edge colour.
            float v=a,offset=type.equals("fade-white")?255*(1-a):0;
            paint.setColorFilter(new android.graphics.ColorMatrixColorFilter(new float[]{v,0,0,0,offset,0,v,0,0,offset,0,0,v,0,offset,0,0,0,1,0}));
        }else if(type.startsWith("wipe-")){
            String direction=type;if(!start)direction=type.equals("wipe-left")?"wipe-right":type.equals("wipe-right")?"wipe-left":type.equals("wipe-up")?"wipe-down":"wipe-up";
            if(direction.equals("wipe-left"))canvas.clipRect(w*(1-a),0,w,h);
            if(direction.equals("wipe-right"))canvas.clipRect(0,0,w*a,h);
            if(direction.equals("wipe-up"))canvas.clipRect(0,h*(1-a),w,h);
            if(direction.equals("wipe-down"))canvas.clipRect(0,0,w,h*a);
        }else if(type.startsWith("slide-")||type.startsWith("push-"))canvas.translate((type.endsWith("left")?1:-1)*(start?1:-1)*w*(1-a),0);
        else if(type.startsWith("zoom-")){
            float scale=(start==type.equals("zoom-in"))?.5f+.5f*a:1.5f-.5f*a;canvas.scale(scale,scale,w/2,h/2);paint.setAlpha(Math.round(255*a));
        }else paint.setAlpha(Math.round(255*a));
        canvas.drawBitmap(image,0,0,paint);canvas.restore();
    }
}
