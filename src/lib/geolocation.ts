import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export function locationErrorMessage(error: unknown, native = Capacitor.isNativePlatform()): string {
  const code = (error as { code?: string | number } | null)?.code;
  const manual = ' หรือแตะปักหมุดบนแผนที่แทนได้';
  if (code === 'APP_UPDATE_REQUIRED') return 'กรุณาติดตั้งแอป huaychan เวอร์ชันล่าสุดเพื่อใช้ GPS' + manual;
  if (code === 1 || code === 'OS-PLUG-GLOC-0003') {
    return (native
      ? 'ยังไม่ได้รับสิทธิ์ตำแหน่ง กรุณาไปที่การตั้งค่า Android > แอป > huaychan > สิทธิ์ > ตำแหน่ง แล้วอนุญาตขณะใช้แอป'
      : 'กรุณาอนุญาตสิทธิ์ตำแหน่งให้เว็บไซต์นี้ในการตั้งค่าเบราว์เซอร์') + manual;
  }
  if (['OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0009', 'OS-PLUG-GLOC-0017'].includes(String(code))) {
    return 'กรุณาเปิดตำแหน่ง (Location / GPS) ของอุปกรณ์ แล้วลองอีกครั้ง' + manual;
  }
  if (code === 3 || code === 'OS-PLUG-GLOC-0010') return 'หาพิกัดไม่ทัน ลองอีกครั้งในบริเวณที่รับสัญญาณได้ดี' + manual;
  return 'ยังหาตำแหน่งไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและตำแหน่งของอุปกรณ์ แล้วลองอีกครั้ง' + manual;
}

// Only called by a user's GPS button: no background location or automatic prompt.
export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable('Geolocation')) throw { code: 'APP_UPDATE_REQUIRED' };
    let permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
      permissions = await Geolocation.requestPermissions({ permissions: ['location'] });
    }
    if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') throw { code: 'OS-PLUG-GLOC-0003' };
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: permissions.location === 'granted', timeout: 20000, maximumAge: 0,
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  }
  if (!navigator.geolocation) throw { code: 'UNAVAILABLE' };
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
    reject,
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  ));
}
