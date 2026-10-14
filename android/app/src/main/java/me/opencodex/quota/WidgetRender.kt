package me.opencodex.quota

import android.graphics.*
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.*

object WidgetRender {
    private val colors = listOf("#173f36", "#55a694", "#a7d6c6", "#d4e9df", "#e1e6e2").map(Color::parseColor)
    fun draw(json: String?, width: Int, height: Int, warning: String): Bitmap {
        val w = width.coerceIn(280,600).toFloat(); val h = height.coerceIn(140,300).toFloat()
        val bitmap = Bitmap.createBitmap((w*2).toInt(),(h*2).toInt(),Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap); canvas.scale(2f,2f)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        fun text(value: String, x: Float, y: Float, size: Float, color: Int=colors[0], bold: Boolean=false, align: Paint.Align=Paint.Align.LEFT, max: Float=Float.MAX_VALUE) {
            paint.style=Paint.Style.FILL; paint.color=color; paint.typeface=if(bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT;paint.textAlign=align;paint.textSize=size
            val measure=paint.measureText(value);if(measure>max)paint.textSize=size*max/measure
            canvas.drawText(value,x,y,paint)
        }
        fun box(left: Float,top: Float,right: Float,bottom: Float,color: Int,radius: Float=10f){paint.style=Paint.Style.FILL;paint.color=color;canvas.drawRoundRect(left,top,right,bottom,radius,radius,paint)}
        box(0f,0f,w,h,Color.parseColor("#f2f5ef"),20f)
        text("OpenCodex quota",16f,25f,12f,bold=true)
        val now=System.currentTimeMillis()/1000.0
        val pool=runCatching {
            val array=JSONObject(json ?: "").getJSONArray("accounts")
            PoolMath.summarize((0 until array.length()).map { i ->
                val a=array.getJSONObject(i);val q=a.optJSONObject("quota") ?: JSONObject()
                fun num(key:String)=q.optDouble(key,Double.NaN).takeIf{it.isFinite()}
                Account(num("shortPercent"),num("weeklyPercent"),num("shortResetAt"),num("weeklyResetAt"),num("updatedAt"),a.optBoolean("paused"),a.optBoolean("needsReauth"))
            },now)
        }.getOrNull()
        if(pool==null){text(if(json==null) "웹앱에서 위젯 연결을 눌러주세요." else "사용량을 읽지 못했습니다.",16f,h/2,12f);return bitmap}
        val updated=pool.updated?.let { SimpleDateFormat("HH:mm",Locale.US).apply{timeZone=TimeZone.getTimeZone("Asia/Seoul")}.format(Date(it.toLong())) } ?: "—"
        val stale=pool.updated?.let{System.currentTimeMillis()-it>3600000} ?: true
        text("Updated $updated"+(if(stale) " · Stale" else ""),w-44f,25f,9f,Color.parseColor(if(stale) "#b77724" else "#73857c"),align=Paint.Align.RIGHT,max=w-160f)
        val ringSize=min(h-54f,w*.35f);val cx=16+ringSize/2;val cy=39+ringSize/2;val radius=ringSize*.385f
        val recoveries=if(pool.remaining==null) emptyList() else pool.recoveries.take(3)
        val parts=listOf((pool.remaining ?: 0.0) to colors[0])+recoveries.mapIndexed{i,r->r.gain to colors[i+1]}
        var angle=-90f
        paint.style=Paint.Style.STROKE;paint.strokeWidth=ringSize*.15f
        val bounds=RectF(cx-radius,cy-radius,cx+radius,cy+radius)
        for((value,color) in parts+listOf(max(0.0,100-parts.sumOf{it.first}) to colors[4])) {paint.style=Paint.Style.STROKE;paint.strokeWidth=ringSize*.15f;paint.color=color;val sweep=(value*3.6).toFloat();canvas.drawArc(bounds,angle,sweep,false,paint)
            if(color!=colors[0] && color!=colors[4] && value>=12){val mid=Math.toRadians((angle+sweep/2).toDouble());text("+${value.roundToInt()}",cx+radius*cos(mid).toFloat(),cy+radius*sin(mid).toFloat()+3,ringSize*.095f,bold=true,align=Paint.Align.CENTER)}
            angle+=sweep}
        text(pool.remaining?.let{"${it.roundToInt()}%"} ?: "—",cx,cy+4,ringSize*.21f,bold=true,align=Paint.Align.CENTER)
        text("5h",cx,cy+ringSize*.20f,ringSize*.09f,align=Paint.Align.CENTER)
        val left=16+ringSize+10;val right=w-16;val rw=right-left;val top=39f;val cardHeight=(ringSize-6)/2;val cardWidth=(rw-8)/3
        for(i in 0..2){val x=left+i*(cardWidth+4);box(x,top,x+cardWidth,top+cardHeight,colors[i+1]);val r=recoveries.getOrNull(i);val fg=Color.parseColor(listOf("#ffffff","#164e63","#405529")[i]);text(r?.let{PoolMath.duration(it.at-now)} ?: "—",x+cardWidth/2,top+cardHeight*.46f,14f,fg,true,Paint.Align.CENTER,cardWidth-6);text(r?.let{PoolMath.gain(it.gain)} ?: "",x+cardWidth/2,top+cardHeight*.77f,10f,fg,true,Paint.Align.CENTER,cardWidth-6)}
        val wt=top+cardHeight+6;box(left,wt,right,top+ringSize,colors[4]);text(pool.week?.let{"${it.roundToInt()}%"} ?: "—",left+8,wt+cardHeight*.48f,21f,bold=true,max=48f);text("Weekly",left+8,wt+cardHeight*.78f,9f,Color.parseColor("#73857c"))
        for((i,r) in pool.weekly.take(2).withIndex()){text("${PoolMath.duration(r.at-now)}  ${PoolMath.gain(r.gain)}",right-8,wt+cardHeight*.40f+i*15,10f,align=Paint.Align.RIGHT,max=rw-66)}
        val note=if(warning.isNotEmpty()) warning else if(pool.overdue) "Reset passed · Refresh needed" else ""
        if(note.isNotEmpty())text(note,16f,h-7,8f,Color.parseColor("#bd5f50"),max=w-32)
        return bitmap
    }
}
