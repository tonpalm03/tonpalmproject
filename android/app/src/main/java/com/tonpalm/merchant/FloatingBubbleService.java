package com.tonpalm.merchant;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.PixelFormat;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;

public class FloatingBubbleService extends Service {
    // Owned only for the service lifetime; cleared in onDestroy.
    @android.annotation.SuppressLint("StaticFieldLeak")
    private static FloatingBubbleService instance;
    private static boolean foreground = true;
    private WindowManager manager;
    private WindowManager.LayoutParams params;
    private FrameLayout bubble;
    private TextView badge;
    private boolean attached;
    private String shopId = "";
    private int count;
    private long badgeVersion;
    private final Handler handler = new Handler(Looper.getMainLooper());
    public static boolean isRunning() { return instance != null && !instance.shopId.isEmpty(); }
    public static void updateServerBadge(String shop, int value, long version) {
        FloatingBubbleService service = instance;
        if (service != null) service.handler.post(() -> {
            if (!service.shopId.equals(shop) || version <= service.badgeVersion) return;
            service.badgeVersion = version;
            updateBadge(shop, value);
        });
    }
    public static void setForeground(boolean value) {
        foreground = value;
        if (instance != null) instance.handler.post(() -> { if (instance != null) instance.refresh(); });
    }
    public static void updateBadge(String shop, int value) {
        FloatingBubbleService service = instance;
        if (service != null) service.handler.post(() -> {
            if (!service.shopId.equals(shop)) return;
            service.count = Math.max(0, value);
            service.badge.setText(service.count > 99 ? "99+" : String.valueOf(service.count));
            service.badge.setVisibility(service.count > 0 ? View.VISIBLE : View.GONE);
        });
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private Intent openIntent() {
        return new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("openOrders", true);
    }
    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        manager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubble = new FrameLayout(this);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        GradientDrawable circle = new GradientDrawable(); circle.setColor(Color.WHITE); circle.setShape(GradientDrawable.OVAL);
        logo.setBackground(circle); logo.setClipToOutline(true); logo.setElevation(dp(4));
        bubble.addView(logo, new FrameLayout.LayoutParams(dp(60), dp(60), Gravity.BOTTOM | Gravity.LEFT));
        badge = new TextView(this); badge.setTextColor(Color.WHITE); badge.setTextSize(12); badge.setGravity(Gravity.CENTER);
        GradientDrawable red = new GradientDrawable(); red.setColor(0xffdc2626); red.setCornerRadius(dp(14)); badge.setBackground(red);
        bubble.addView(badge, new FrameLayout.LayoutParams(dp(28), dp(24), Gravity.TOP | Gravity.RIGHT));
        bubble.setContentDescription("เปิดหน้ารับออเดอร์");
        bubble.setOnClickListener(view -> {
            try { startActivity(openIntent()); removeBubble(); }
            catch (RuntimeException e) { android.util.Log.w("FloatingBubble", "Unable to open orders", e); }
        });
        params = new WindowManager.LayoutParams(dp(68), dp(68),
            Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = getSharedPreferences("bubble", MODE_PRIVATE).getInt("x", 0);
        params.y = getSharedPreferences("bubble", MODE_PRIVATE).getInt("y", dp(160));
        bubble.setOnTouchListener(new View.OnTouchListener() {
            float x, y; int startX, startY; boolean moved;
            public boolean onTouch(View view, android.view.MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        x = event.getRawX(); y = event.getRawY(); startX = params.x; startY = params.y; moved = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX()-x, dy = event.getRawY()-y;
                        moved |= Math.hypot(dx, dy) > ViewConfiguration.get(FloatingBubbleService.this).getScaledTouchSlop();
                        params.x = startX + (int) dx; params.y = startY + (int) dy; clamp(); reposition(); return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) view.performClick();
                        else { params.x = params.x < maxX()/2 ? 0 : maxX(); reposition(); savePosition(); }
                        return true;
                    case MotionEvent.ACTION_CANCEL: clamp(); reposition(); return true;
                }
                return false;
            }
        });
    }
    private int maxX() { return Math.max(0, getResources().getDisplayMetrics().widthPixels-dp(68)); }
    private void clamp() {
        params.x = Math.max(0, Math.min(params.x, maxX()));
        params.y = Math.max(0, Math.min(params.y, getResources().getDisplayMetrics().heightPixels-dp(120)));
    }
    private void savePosition() { getSharedPreferences("bubble", MODE_PRIVATE).edit().putInt("x",params.x).putInt("y",params.y).apply(); }
    private void reposition() { if (attached) try { manager.updateViewLayout(bubble, params); } catch (RuntimeException e) { stopSelf(); } }
    private void removeBubble() { if (attached) { manager.removeView(bubble); attached = false; } }
    private void refresh() {
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return; }
        if (foreground) removeBubble();
        else if (!attached) { try { clamp(); manager.addView(bubble, params); attached = true; } catch (RuntimeException e) { stopSelf(); } }
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY; }
        if ("stop".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        String nextShop = intent.getStringExtra("shopId");
        if (nextShop != null && !nextShop.equals(shopId)) badgeVersion = 0;
        shopId = nextShop == null ? "" : nextShop;
        if (shopId == null || shopId.isEmpty()) { stopSelf(); return START_NOT_STICKY; }
        NotificationManager notifications = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(new NotificationChannel("merchant_bubble", "ปุ่มลอยหน้าร้าน", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 70, openIntent(), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 71, new Intent(this, FloatingBubbleService.class).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "merchant_bubble") : new Notification.Builder(this);
        Notification notification = builder.setSmallIcon(R.drawable.ic_bubble_notification).setContentTitle("ปุ่มลอยหน้าร้านเปิดอยู่")
            .setContentText("แตะเพื่อกลับไปรับออเดอร์").setContentIntent(open).setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "หยุดปุ่มลอย", stop).build()).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(701, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(701, notification);
        updateBadge(shopId, intent.getIntExtra("count", 0)); refresh();
        return START_NOT_STICKY;
    }
    @Override public void onConfigurationChanged(Configuration config) { super.onConfigurationChanged(config); clamp(); reposition(); }
    @Override public void onTaskRemoved(Intent rootIntent) { stopSelf(); }
    @Override public void onDestroy() { removeBubble(); handler.removeCallbacksAndMessages(null); instance = null; super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
