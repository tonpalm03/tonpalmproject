'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Phone, CheckCircle2, LocateFixed, MapPin, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { getDistanceKm, locationErrorMessage, watchLocation } from '@/lib/geolocation';
import { LatLng, Route, fetchRoute, formatMeters, formatMinutes, progressOnRoute } from '@/lib/routing';

interface DeliveryNavigatorProps {
  destination: LatLng;
  /** Where to draw the route from until the device position arrives (the shop). */
  fallbackOrigin?: LatLng;
  customerName: string;
  customerPhone?: string;
  address?: string;
  /** Shown as the main action when the order is out for delivery. */
  onDelivered?: () => void;
  onClose: () => void;
}

// Re-plan when the rider drifts this far from the line, but not more often than this.
const OFF_ROUTE_M = 60;
const REROUTE_GAP_MS = 15000;
const ARRIVED_M = 40;

/** Full-screen, in-app navigation from the rider's live position to the customer. */
export default function DeliveryNavigator({
  destination, fallbackOrigin, customerName, customerPhone, address, onDelivered, onClose,
}: DeliveryNavigatorProps) {
  const [here, setHere] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [following, setFollowing] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Leaflet objects are created after a dynamic import, so they stay untyped here like in MapPicker.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const meRef = useRef<any>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const lastRouteAt = useRef(0);
  const routing = useRef<AbortController | null>(null);

  // Map with the customer's pin.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false }).setView([destination.lat, destination.lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      L.marker([destination.lat, destination.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
            <div style="background:#e11d48;color:#fff;font-size:11px;font-weight:800;padding:3px 9px;border-radius:9999px;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,.3)">ลูกค้า</div>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#e11d48" stroke="#fff" stroke-width="1.5"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>
          </div>`,
          iconSize: [0, 0],
        }),
      }).addTo(map);
      // Panning by hand stops the map from chasing the rider until they tap "กลับมาที่ฉัน".
      map.on('dragstart', () => setFollowing(false));
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [destination.lat, destination.lng]);

  // Live position.
  useEffect(() => watchLocation(
    (loc) => {
      setGpsError('');
      setHere({ lat: loc.lat, lng: loc.lng });
    },
    (err) => setGpsError(locationErrorMessage(err)),
  ), []);

  // Keep the screen awake while navigating, where the browser allows it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);

  // Plan the route from the rider (or the shop until GPS arrives), and re-plan when they leave it.
  const origin = here ?? fallbackOrigin ?? null;
  useEffect(() => {
    if (!origin) return;
    const now = Date.now();
    const needsRoute =
      !route ||
      (route.onRoads && here && progressOnRoute(route, here).offRouteM > OFF_ROUTE_M && now - lastRouteAt.current > REROUTE_GAP_MS) ||
      (!route.onRoads && here && now - lastRouteAt.current > REROUTE_GAP_MS * 2);
    if (!needsRoute) return;
    lastRouteAt.current = now;
    routing.current?.abort();
    const ctrl = new AbortController();
    routing.current = ctrl;
    fetchRoute(origin, destination, ctrl.signal).then(setRoute).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination.lat, destination.lng]);

  // Draw the route line.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !route) return;
    routeLineRef.current?.remove();
    routeLineRef.current = L.polyline(route.path.map(p => [p.lat, p.lng]), {
      color: '#1D9E75', weight: 6, opacity: 0.85, dashArray: route.onRoads ? undefined : '8 10',
    }).addTo(map);
    // The map can be laid out after it was created, so measure it again before fitting.
    map.invalidateSize();
    if (!here) map.fitBounds(routeLineRef.current.getBounds(), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, mapReady]);

  // Draw the rider and follow them.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !here) return;
    if (!meRef.current) {
      meRef.current = L.circleMarker([here.lat, here.lng], {
        radius: 9, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1,
      }).addTo(map);
    } else {
      meRef.current.setLatLng([here.lat, here.lng]);
    }
    if (following) map.setView([here.lat, here.lng], Math.max(map.getZoom(), 17), { animate: true });
  }, [here, following, mapReady]);

  const directM = here ? getDistanceKm(here.lat, here.lng, destination.lat, destination.lng) * 1000 : null;
  const remainingM = route
    // The road distance left can never be shorter than the straight line to the customer.
    ? here && route.onRoads ? Math.max(progressOnRoute(route, here).remainingM, directM ?? 0) : directM ?? route.distanceM
    : null;
  const speed = route && route.durationS > 0 ? route.distanceM / route.durationS : 7;
  const arrived = directM !== null && directM <= ARRIVED_M;

  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col">
      <div className="bg-gradient-to-br from-[#E1F5EE] to-[#C3EBDC] px-4 pt-3 pb-3 flex items-start gap-3 shadow-sm z-10">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[#0F6E56]">ไปส่งที่</p>
          <p className="text-base font-black text-[#04342C] truncate">{customerName}</p>
          {address && <p className="text-xs text-[#085041] line-clamp-2">{address}</p>}
        </div>
        <button onClick={onClose} aria-label="ปิดการนำทาง" className="w-9 h-9 rounded-full bg-white/80 text-[#0F6E56] flex items-center justify-center shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        {gpsError && (
          <p role="alert" className="absolute top-2 left-2 right-2 z-[500] rounded-xl bg-white/95 border border-rose-200 p-2.5 text-xs text-rose-700 flex gap-1.5 shadow">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {gpsError}
          </p>
        )}
        {route && !route.onRoads && (
          <p className="absolute bottom-2 left-2 right-2 z-[500] rounded-xl bg-white/95 p-2 text-xs text-gray-600 shadow">
            โหลดเส้นทางถนนไม่ได้ เส้นประคือทิศทางเป็นเส้นตรงไปหาลูกค้า
          </p>
        )}
        {!following && here && (
          <button
            onClick={() => setFollowing(true)}
            className="absolute right-3 bottom-14 z-[500] h-10 px-3 rounded-full bg-white shadow-lg text-[#0F6E56] text-xs font-bold flex items-center gap-1.5"
          >
            <LocateFixed className="w-4 h-4" /> กลับมาที่ฉัน
          </button>
        )}
      </div>

      <div className="px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-gray-100 space-y-2.5 bg-white z-10">
        <div className="flex items-baseline gap-2">
          {arrived ? (
            <p className="text-lg font-black text-[#1D9E75] flex items-center gap-1.5"><MapPin className="w-5 h-5" /> ถึงที่หมายแล้ว</p>
          ) : remainingM !== null ? (
            <>
              <p className="text-2xl font-black text-gray-900">{formatMeters(remainingM)}</p>
              <p className="text-sm font-bold text-gray-500">{formatMinutes(remainingM / speed)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-500 animate-pulse">กำลังหาตำแหน่งและเส้นทาง...</p>
          )}
        </div>
        <div className="flex gap-2">
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="flex-1 py-3 rounded-2xl border border-[#5DCAA5] text-[#0F6E56] font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <Phone className="w-4 h-4" /> โทรหาลูกค้า
            </a>
          )}
          {onDelivered && (
            <button
              onClick={onDelivered}
              className="flex-1 py-3 rounded-2xl bg-brand-600 text-white font-black text-sm flex items-center justify-center gap-1.5 shadow-[0_6px_16px_-6px_rgba(15,110,86,0.45)] active:scale-95 transition"
            >
              <CheckCircle2 className="w-4 h-4" /> ส่งถึงแล้ว
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
