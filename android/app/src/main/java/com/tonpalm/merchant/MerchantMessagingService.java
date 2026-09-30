package com.tonpalm.merchant;

import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.MessagingService;

public class MerchantMessagingService extends MessagingService {
    @Override public void onNewToken(String token) { super.onNewToken(token); }
    @Override public void onMessageReceived(RemoteMessage message) {
        if ("ORDER_BADGE".equals(message.getData().get("type"))) {
            try {
                FloatingBubbleService.updateServerBadge(message.getData().get("shopId"), Integer.parseInt(message.getData().get("count")), Long.parseLong(message.getData().get("version")));
            } catch (RuntimeException ignored) { }
            return;
        }
        super.onMessageReceived(message);
    }
}
