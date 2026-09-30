package com.tonpalm.merchant;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle state) {
        registerPlugin(FloatingBubblePlugin.class);
        super.onCreate(state);
    }
}
