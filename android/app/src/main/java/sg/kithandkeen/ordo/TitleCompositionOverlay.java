package sg.kithandkeen.ordo;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.PorterDuff;
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.common.util.UnstableApi;
import java.util.List;

/** One GPU overlay texture, regardless of how many sequential captions are in a project. */
@UnstableApi
final class TitleCompositionOverlay extends BitmapOverlay {
    private final List<TitleOverlay> titles;
    private final Bitmap output;
    private final Bitmap[] previous;
    private boolean initialized;
    TitleCompositionOverlay(List<TitleOverlay> titles,int width,int height){
        this.titles=titles;output=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);previous=new Bitmap[titles.size()];
    }
    @Override public Bitmap getBitmap(long timeUs){
        boolean changed=!initialized;
        for(int i=0;i<titles.size();i++){Bitmap bitmap=titles.get(i).getBitmap(timeUs);changed|=bitmap!=previous[i]||titles.get(i).animated;previous[i]=bitmap;}
        if(changed){Canvas canvas=new Canvas(output);canvas.drawColor(android.graphics.Color.TRANSPARENT,PorterDuff.Mode.CLEAR);for(Bitmap bitmap:previous)if(bitmap.getWidth()>1)canvas.drawBitmap(bitmap,0,0,null);initialized=true;}
        return output;
    }
}
