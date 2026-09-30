package com.tonpalm.merchant;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FloatingBubble")
public class FloatingBubblePlugin extends Plugin {
    private boolean foreground;
    @PluginMethod public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", Settings.canDrawOverlays(getContext()));
        result.put("running", FloatingBubbleService.isRunning());
        call.resolve(result);
    }
    @PluginMethod public void requestPermission(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())));
            call.resolve();
        } catch (Exception e) { call.reject("เปิดหน้าตั้งค่าสิทธิ์ไม่ได้", e); }
    }
    @PluginMethod public void showBubble(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!foreground || !Settings.canDrawOverlays(getContext())) {
                call.reject("กรุณาเปิดแอปและอนุญาตให้แสดงทับแอปอื่นก่อน"); return;
            }
            String shop = call.getString("shopId", "");
            if (shop.isEmpty()) { call.reject("ไม่พบร้านค้า"); return; }
            try {
                Intent intent = new Intent(getContext(), FloatingBubbleService.class);
                intent.putExtra("shopId", shop);
                intent.putExtra("count", call.getInt("count", 0));
                ContextCompat.startForegroundService(getContext(), intent);
                call.resolve();
            } catch (Exception e) { call.reject("เปิดปุ่มลอยไม่สำเร็จ", e); }
        });
    }
    @PluginMethod public void hideBubble(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getContext().stopService(new Intent(getContext(), FloatingBubbleService.class));
            call.resolve();
        });
    }
    @PluginMethod public void updateBadge(PluginCall call) {
        FloatingBubbleService.updateBadge(call.getString("shopId", ""), call.getInt("count", 0));
        call.resolve();
    }
    @Override protected void handleOnResume() {
        foreground = true;
        FloatingBubbleService.setForeground(true);
        notifyListeners("resume", new JSObject());
        openOrders(getActivity().getIntent());
    }
    @Override protected void handleOnStop() {
        foreground = false;
        FloatingBubbleService.setForeground(false);
    }
    @Override protected void handleOnNewIntent(Intent intent) { openOrders(intent); }
    private void openOrders(Intent intent) {
        if (intent != null && intent.getBooleanExtra("openOrders", false)) {
            intent.removeExtra("openOrders");
            notifyListeners("openOrders", new JSObject(), true);
        }
    }
}
