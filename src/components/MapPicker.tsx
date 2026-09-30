'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Maximize2, Minimize2, Check, ExternalLink, ZoomIn, AlertTriangle, CheckCircle2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  getCurrentLocation,
  locationErrorMessage,
  DEFAULT_CAMPUS_LOCATION,
  MAX_DELIVERY_RADIUS_KM,
  getDistanceKm,
  formatDistance,
} from '@/lib/geolocation';

interface MapPickerProps {
  location: { lat: number; lng: number };
  onChange: (loc: { lat: number; lng: number }) => void;
  title?: string;
  readOnly?: boolean;
  centerLocation?: { lat: number; lng: number };
  maxRadiusKm?: number;
  showRadiusCircle?: boolean;
  onRadiusStatusChange?: (isValid: boolean, distanceKm: number) => void;
}

export default function MapPicker({
  location,
  onChange,
  title = 'จุดส่งของคุณ',
  readOnly = false,
  centerLocation = DEFAULT_CAMPUS_LOCATION,
  maxRadiusKm = MAX_DELIVERY_RADIUS_KM,
  showRadiusCircle = true,
  onRadiusStatusChange,
}: MapPickerProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const defaultLat = centerLocation?.lat ?? DEFAULT_CAMPUS_LOCATION.lat;
  const defaultLng = centerLocation?.lng ?? DEFAULT_CAMPUS_LOCATION.lng;

  const currentLat = location?.lat ?? defaultLat;
  const currentLng = location?.lng ?? defaultLng;

  // Real-time distance calculation from center (shop / campus centroid)
  const distanceKm = getDistanceKm(defaultLat, defaultLng, currentLat, currentLng);
  const isWithinRadius = distanceKm <= (maxRadiusKm + 0.05); // slight float tolerance

  useEffect(() => {
    onRadiusStatusChange?.(isWithinRadius, distanceKm);
  }, [isWithinRadius, distanceKm, onRadiusStatusChange]);

  const inlineMapContainerRef = useRef<HTMLDivElement | null>(null);
  const fullMapContainerRef = useRef<HTMLDivElement | null>(null);
  const inlineMapInstanceRef = useRef<any>(null);
  const fullMapInstanceRef = useRef<any>(null);
  const inlineMarkerRef = useRef<any>(null);
  const fullMarkerRef = useRef<any>(null);
  const inlineCircleRef = useRef<any>(null);
  const fullCircleRef = useRef<any>(null);

  // Helper to create custom HTML Pin
  const createPinIcon = (L: any, label: string, isOutOfRange: boolean = false) => {
    const pinColor = isOutOfRange ? '#e11d48' : '#ea580c';
    return L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="background: ${pinColor}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 9999px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); white-space: nowrap; margin-bottom: 2px;">
            ${label}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${pinColor}" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35)); cursor: pointer;"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  // 1. Initialize Inline Map
  useEffect(() => {
    let isCancelled = false;

    async function initInlineMap() {
      if (!inlineMapContainerRef.current) return;
      const L = (await import('leaflet')).default;
      if (isCancelled || !inlineMapContainerRef.current) return;

      if (inlineMapInstanceRef.current) {
        inlineMapInstanceRef.current.remove();
        inlineMapInstanceRef.current = null;
      }

      const map = L.map(inlineMapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Render 3 km Radius Boundary Circle
      if (showRadiusCircle) {
        const circle = L.circle([defaultLat, defaultLng], {
          radius: maxRadiusKm * 1000,
          color: '#f59e0b',
          fillColor: '#fbbf24',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6, 6',
        }).addTo(map);
        circle.bindTooltip(`ขอบเขตรัศมีส่งอาหารไม่เกิน ${maxRadiusKm} กม.`, { permanent: false, direction: 'top' });
        inlineCircleRef.current = circle;
      }

      const marker = L.marker([currentLat, currentLng], {
        icon: createPinIcon(L, title, !isWithinRadius),
        draggable: !readOnly,
      }).addTo(map);

      if (!readOnly) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng });
        });

        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      inlineMapInstanceRef.current = map;
      inlineMarkerRef.current = marker;

      // Fix render size in modal/dynamic tab
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    initInlineMap();

    return () => {
      isCancelled = true;
      if (inlineMapInstanceRef.current) {
        inlineMapInstanceRef.current.remove();
        inlineMapInstanceRef.current = null;
      }
    };
  }, [defaultLat, defaultLng, maxRadiusKm, showRadiusCircle]);

  // Sync Inline marker position when location prop changes
  useEffect(() => {
    if (inlineMarkerRef.current && inlineMapInstanceRef.current) {
      inlineMarkerRef.current.setLatLng([currentLat, currentLng]);
    }
  }, [currentLat, currentLng]);

  // 2. Initialize Fullscreen Map Modal
  useEffect(() => {
    if (!isFullScreen) return;
    let isCancelled = false;

    async function initFullMap() {
      if (!fullMapContainerRef.current) return;
      const L = (await import('leaflet')).default;
      if (isCancelled || !fullMapContainerRef.current) return;

      if (fullMapInstanceRef.current) {
        fullMapInstanceRef.current.remove();
        fullMapInstanceRef.current = null;
      }

      const map = L.map(fullMapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: 16,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Render 3 km Radius Boundary Circle in Fullscreen
      if (showRadiusCircle) {
        const circle = L.circle([defaultLat, defaultLng], {
          radius: maxRadiusKm * 1000,
          color: '#f59e0b',
          fillColor: '#fbbf24',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6, 6',
        }).addTo(map);
        circle.bindTooltip(`ขอบเขตรัศมีส่งอาหารไม่เกิน ${maxRadiusKm} กม.`, { permanent: false, direction: 'top' });
        fullCircleRef.current = circle;
      }

      const marker = L.marker([currentLat, currentLng], {
        icon: createPinIcon(L, title, !isWithinRadius),
        draggable: !readOnly,
      }).addTo(map);

      if (!readOnly) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng });
        });

        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      fullMapInstanceRef.current = map;
      fullMarkerRef.current = marker;

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    initFullMap();

    return () => {
      isCancelled = true;
      if (fullMapInstanceRef.current) {
        fullMapInstanceRef.current.remove();
        fullMapInstanceRef.current = null;
      }
    };
  }, [isFullScreen, defaultLat, defaultLng, maxRadiusKm, showRadiusCircle]);

  // Sync Fullscreen marker position when location changes
  useEffect(() => {
    if (fullMarkerRef.current && fullMapInstanceRef.current) {
      fullMarkerRef.current.setLatLng([currentLat, currentLng]);
    }
  }, [currentLat, currentLng]);

  // High Accuracy GPS Locator
  const handleGetLocation = async () => {
    if (isLocating || readOnly) return;
    setLocationError('');
    setIsLocating(true);
    try {
      const { lat, lng } = await getCurrentLocation();
      const dist = getDistanceKm(defaultLat, defaultLng, lat, lng);
      onChange({ lat, lng });
      inlineMapInstanceRef.current?.flyTo([lat, lng], 17, { animate: true });
      fullMapInstanceRef.current?.flyTo([lat, lng], 17, { animate: true });
      if (dist > maxRadiusKm) {
        setLocationError(`ตำแหน่ง GPS ของคุณ (${formatDistance(dist)}) อยู่นอกรัศมีบริการ ${maxRadiusKm} กม. กรุณาเลื่อนหมุดมาอยู่ในเขตบริการ`);
      }
    } catch (error) {
      setLocationError(locationErrorMessage(error));
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-rose-500" />
          <span>{title} (แตะหรือลากหมุดได้)</span>
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isLocating || readOnly}
            className="text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1 shadow-xs transition active:scale-95"
            title="ดึงพิกัดตำแหน่งปัจจุบันของคุณด้วย GPS"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'กำลังหาพิกัด...' : 'ตำแหน่งของฉัน'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFullScreen(true)}
            className="p-1.5 text-gray-600 hover:bg-amber-100 hover:text-amber-800 bg-white border border-gray-200 rounded-xl transition shadow-2xs"
            title="ซูมปักหมุดแบบเต็มจอ"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline Interactive Leaflet Map */}
      {locationError && <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">{locationError}</p>}
      <div className="relative w-full h-52 rounded-2xl overflow-hidden border border-amber-200 shadow-inner bg-slate-100">
        <div ref={inlineMapContainerRef} className="w-full h-full z-10" />

        {/* Top Status Badges */}
        <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none gap-1">
          {/* Distance / Radius Status Badge */}
          {showRadiusCircle && (
            <div className={`px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-md flex items-center gap-1 backdrop-blur-xs pointer-events-auto border transition ${
              isWithinRadius
                ? 'bg-emerald-600/90 text-white border-emerald-400/50'
                : 'bg-rose-600/95 text-white border-rose-300 animate-pulse'
            }`}>
              {isWithinRadius ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>ระยะ {formatDistance(distanceKm)} (ในพื้นที่ 3 กม.)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-300" />
                  <span>เกินรัศมี ({formatDistance(distanceKm)} &gt; 3 กม.)</span>
                </>
              )}
            </div>
          )}

          {/* Floating Quick Hint Badge */}
          {!readOnly && (
            <div className="bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-xl text-[10px] font-bold text-gray-700 shadow-md border border-gray-200 flex items-center gap-1 pointer-events-none ml-auto">
              <span>แตะแผนที่เพื่อย้ายหมุด</span>
            </div>
          )}
        </div>

        {/* Fullscreen Expand CTA Banner */}
        <button
          type="button"
          onClick={() => setIsFullScreen(true)}
          className="absolute bottom-2 right-2 z-20 bg-slate-900/90 hover:bg-slate-900 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-md flex items-center gap-1 backdrop-blur-xs transition active:scale-95"
        >
          <ZoomIn className="w-3 h-3 text-amber-400" />
          <span>ซูมปักหมุดแบบขยายใหญ่</span>
        </button>

        {/* Coordinates Display */}
        <div className="absolute bottom-2 left-2 z-20 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] text-gray-600 font-mono shadow-xs border border-gray-200 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-rose-500" />
          <span>{currentLat.toFixed(5)}, {currentLng.toFixed(5)}</span>
        </div>
      </div>

      {/* Fullscreen Interactive Map Modal */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col animate-in fade-in">
          {/* Modal Header */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">ปักหมุดพิกัดอย่างละเอียด (ซูมได้ลึก)</h3>
                  {showRadiusCircle && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isWithinRadius
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                    }`}>
                      {isWithinRadius ? `ในพื้นที่ (${formatDistance(distanceKm)})` : `เกิน 3 กม. (${formatDistance(distanceKm)})`}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">แตะจุดที่ต้องการ หรือลากหมุดไปยังหน้าตึก/หอพักของคุณ (วงกลมสีส้มคือรัศมี 3 กม.)</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating || readOnly}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition active:scale-95"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>GPS</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullScreen(false)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1 shadow-md transition active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>ยืนยันพิกัด</span>
              </button>
            </div>
          </div>

          {/* Map canvas */}
          {locationError && <p role="alert" className="shrink-0 bg-amber-50 px-4 py-3 text-xs text-amber-900">{locationError}</p>}
          <div className="flex-1 relative w-full h-full bg-slate-200">
            <div ref={fullMapContainerRef} className="w-full h-full" />

            {/* Bottom floating bar */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-2 max-w-lg mx-auto pointer-events-none">
              <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-gray-200 text-xs font-mono font-bold text-gray-800 pointer-events-auto flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>{currentLat.toFixed(6)}, {currentLng.toFixed(6)}</span>
                <span className="text-[10px] text-gray-400 font-sans font-normal">({formatDistance(distanceKm)})</span>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${currentLat},${currentLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900/90 text-white px-3 py-1.5 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-1 backdrop-blur-md pointer-events-auto hover:bg-slate-800 transition"
              >
                <span>เปิดดู Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

