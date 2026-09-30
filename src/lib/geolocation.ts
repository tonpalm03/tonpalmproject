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

// Platform / Campus centroid: มหาวิทยาลัยราชภัฏชัยภูมิ (มรภ.ชัยภูมิ)
export const DEFAULT_CAMPUS_LOCATION = { lat: 15.8272, lng: 102.0298 };

// Maximum delivery radius strictly enforced at 2.0 kilometers
export const MAX_DELIVERY_RADIUS_KM = 2.0;

/**
 * Calculates the great-circle distance between two points on the Earth (Haversine formula in km)
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    !Number.isFinite(lat1) || !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) || !Number.isFinite(lon2)
  ) {
    return 0;
  }
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a distance in kilometers into a friendly Thai label (e.g. "850 ม." or "2.4 กม.")
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '0 ม.';
  if (km < 1) {
    return `${Math.round(km * 1000)} ม.`;
  }
  return `${km.toFixed(1)} กม.`;
}

/**
 * Validates whether a given pin coordinate is within the permitted delivery radius
 */
export function validateDeliveryRadius(
  pinLocation: { lat: number; lng: number } | null | undefined,
  centerLocation: { lat: number; lng: number } = DEFAULT_CAMPUS_LOCATION,
  maxRadiusKm: number = MAX_DELIVERY_RADIUS_KM
): { isValid: boolean; distanceKm: number; formattedDistance: string } {
  if (!pinLocation || typeof pinLocation.lat !== 'number' || typeof pinLocation.lng !== 'number') {
    return { isValid: true, distanceKm: 0, formattedDistance: '0 ม.' };
  }
  const distanceKm = getDistanceKm(centerLocation.lat, centerLocation.lng, pinLocation.lat, pinLocation.lng);
  const isValid = distanceKm <= maxRadiusKm;
  return {
    isValid,
    distanceKm: Math.round(distanceKm * 100) / 100,
    formattedDistance: formatDistance(distanceKm),
  };
}

