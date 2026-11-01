import { getDistanceKm } from '@/lib/geolocation';

export type LatLng = { lat: number; lng: number };

export interface Route {
  /** Points along the road, start to end. */
  path: LatLng[];
  distanceM: number;
  durationS: number;
  /** False when no road route was found and `path` is just a straight line. */
  onRoads: boolean;
}

// Public OSRM server: free, no key, fine for light use like a few deliveries at a time.
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
// Motorbikes in town average about 25 km/h; used for the straight-line fallback.
const FALLBACK_SPEED_MS = 25000 / 3600;

export async function fetchRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<Route> {
  try {
    const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('no route');
    const path: LatLng[] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
    return { path, distanceM: route.distance, durationS: route.duration, onRoads: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    const distanceM = getDistanceKm(from.lat, from.lng, to.lat, to.lng) * 1000;
    return { path: [from, to], distanceM, durationS: distanceM / FALLBACK_SPEED_MS, onRoads: false };
  }
}

const metersBetween = (a: LatLng, b: LatLng) => getDistanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;

/** How far `here` is from the route, and how much of the route is left from the closest point. */
export function progressOnRoute(route: Route, here: LatLng): { offRouteM: number; remainingM: number } {
  let best = 0;
  let bestDist = Infinity;
  route.path.forEach((p, i) => {
    const d = metersBetween(p, here);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  let remainingM = 0;
  for (let i = best; i < route.path.length - 1; i++) remainingM += metersBetween(route.path[i], route.path[i + 1]);
  return { offRouteM: bestDist, remainingM };
}

export function formatMeters(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} ม.` : `${(m / 1000).toFixed(1)} กม.`;
}

export function formatMinutes(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  return `~${min} นาที`;
}
