import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface FloatingBubblePlugin {
  checkPermission(): Promise<{ granted: boolean; running: boolean }>;
  requestPermission(): Promise<void>;
  showBubble(options: { shopId: string; count: number }): Promise<void>;
  hideBubble(): Promise<void>;
  updateBadge(options: { shopId: string; count: number }): Promise<void>;
  addListener(event: 'resume' | 'openOrders', listener: () => void): Promise<PluginListenerHandle>;
}

export const floatingBubble = registerPlugin<FloatingBubblePlugin>('FloatingBubble');
export const supportsFloatingBubble = () => Capacitor.getPlatform() === 'android'
  && Capacitor.isPluginAvailable('FloatingBubble');
