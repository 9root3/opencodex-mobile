package me.opencodex.quota

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.*

class ConnectActivity: Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val panel=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL;setPadding(32,48,32,32) }
        val heading=TextView(this).apply{text="OpenCodex quota";textSize=24f};panel.addView(heading)
        val instruction=TextView(this).apply{text="웹앱에서 ‘Android 위젯 연결’을 누르면 자동으로 설정됩니다. 직접 연결할 수도 있습니다."};panel.addView(instruction)
        val url=EditText(this).apply{hint="https://서버주소";inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI};panel.addView(url)
        val key=EditText(this).apply{hint="위젯 키";inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD};panel.addView(key)
        val status=TextView(this);panel.addView(status)
        val connect=Button(this).apply{text="연결하고 위젯 추가"};panel.addView(connect)
        Store.load(this)?.let{url.setText(it.url);key.setText(it.key)}
        fun save() {
            val value=try{Store.validate(url.text.toString(),key.text.toString())}catch(e:Exception){status.text=e.message;return}
            connect.isEnabled=false;status.text="연결 확인 중…"
            Thread {
                try {
                    val json=Api.read(value);Store.save(this,value)
                    getSharedPreferences("cache",0).edit().putString("json",json).putString("warning","").commit()
                    runOnUiThread {
                        connect.isEnabled=true;status.text="연결됐습니다. 홈 화면에 위젯을 추가하세요."
                        QuotaWidget.schedule(this);QuotaWidget.update(this)
                        val manager=AppWidgetManager.getInstance(this)
                        if(manager.isRequestPinAppWidgetSupported) manager.requestPinAppWidget(ComponentName(this,QuotaWidget::class.java),null,null)
                        else status.text="홈 화면을 길게 누르고 위젯 → OpenCodex quota를 선택하세요."
                    }
                }catch(e:Exception){runOnUiThread{connect.isEnabled=true;status.text=e.message ?: "연결 실패"}}
            }.start()
        }
        connect.setOnClickListener{save()}
        panel.addView(Button(this).apply{text="웹 대시보드 열기";setOnClickListener{Store.load(this@ConnectActivity)?.let{startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(it.url)))}}})
        setContentView(panel)
        intent.data?.takeIf{it.scheme=="opencodexquota" && it.host=="connect"}?.let { data ->
            url.setText(data.getQueryParameter("url") ?: "");key.setText(data.getQueryParameter("key") ?: "")
            val origin=runCatching{Store.validate(url.text.toString(),key.text.toString()).url}.getOrNull()
            if(origin!=null) AlertDialog.Builder(this).setTitle("이 서버에 연결할까요?").setMessage(origin).setPositiveButton("연결"){_,_->save()}.setNegativeButton("취소",null).show()
        }
        // Remove the incoming key from the activity's retained intent after reading it.
        intent.data=null
    }
}
