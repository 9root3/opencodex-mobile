package me.opencodex.quota

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import androidx.work.*
import java.util.concurrent.TimeUnit

class QuotaWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { update(context); schedule(context); enqueue(context,false) }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { update(context) }
    override fun onReceive(context: Context, intent: Intent) { super.onReceive(context,intent); if(intent.action=="me.opencodex.quota.REFRESH") enqueue(context,true) }
    override fun onDisabled(context: Context) { WorkManager.getInstance(context).cancelUniqueWork("quota-periodic") }
    companion object {
        fun schedule(context: Context) {
            val job=PeriodicWorkRequestBuilder<QuotaWorker>(30,TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("quota-periodic",ExistingPeriodicWorkPolicy.KEEP,job)
        }
        fun enqueue(context: Context, refresh: Boolean) {
            val job=OneTimeWorkRequestBuilder<QuotaWorker>().setInputData(workDataOf("refresh" to refresh)).build()
            WorkManager.getInstance(context).enqueueUniqueWork("quota-now",ExistingWorkPolicy.KEEP,job)
        }
        fun update(context: Context) {
            val manager=AppWidgetManager.getInstance(context);val connection=Store.load(context)
            val cache=context.getSharedPreferences("cache",0)
            for(id in manager.getAppWidgetIds(ComponentName(context,QuotaWidget::class.java))) {
                val options=manager.getAppWidgetOptions(id)
                val views=RemoteViews(context.packageName,R.layout.quota_widget)
                views.setImageViewBitmap(R.id.widget_image,WidgetRender.draw(cache.getString("json",null),options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,338),options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,160),cache.getString("warning","") ?: ""))
                val open=if(connection!=null) Intent(Intent.ACTION_VIEW,Uri.parse(connection.url)) else Intent(context,ConnectActivity::class.java)
                views.setOnClickPendingIntent(R.id.widget_image,PendingIntent.getActivity(context,id,open,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                views.setOnClickPendingIntent(R.id.refresh,PendingIntent.getBroadcast(context,id,Intent(context,QuotaWidget::class.java).setAction("me.opencodex.quota.REFRESH"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                manager.updateAppWidget(id,views)
            }
        }
    }
}
class QuotaWorker(context: Context, parameters: WorkerParameters): Worker(context,parameters) {
    override fun doWork(): Result {
        val connection=Store.load(applicationContext) ?: return Result.success()
        val prefs=applicationContext.getSharedPreferences("cache",0)
        try {
            val json=Api.read(connection,inputData.getBoolean("refresh",false))
            prefs.edit().putString("json",json).putString("warning","").commit()
        } catch(error: Exception) { prefs.edit().putString("warning",if(prefs.contains("json")) "Offline · Cached" else error.message ?: "Connection failed").commit() }
        QuotaWidget.update(applicationContext)
        return Result.success()
    }
}
