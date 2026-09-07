import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { AlertCircle, LocateFixed } from "lucide-react";
import { FALLBACK_MAPBOX_TOKEN } from "@/components/map/EntityMap";
import { cn } from "@/lib/utils";

interface LocationPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
  height?: number | string;
}

const DEFAULT_CENTER: [number, number] = [3.042, 36.752]; // Algiers
const FALLBACK_MARKER_COLOR = "#1A56B0";

function resolveMarkerColor(): string {
  if (typeof document === "undefined") return FALLBACK_MARKER_COLOR;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary-500")?.trim();
  if (!raw) return FALLBACK_MARKER_COLOR;
  const isUsableColor = /^#|^rgb|^hsl|^[a-z]+$/i.test(raw);
  return isUsableColor ? raw : FALLBACK_MARKER_COLOR;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = 300,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const token =
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
    FALLBACK_MAPBOX_TOKEN ||
    (import.meta.env.VITE_PUBLIC_MAPBOX_TOKEN as string | undefined);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const initialCenter: [number, number] =
      latitude && longitude ? [longitude, latitude] : DEFAULT_CENTER;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: initialCenter,
      zoom: latitude && longitude ? 13 : 6,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const marker = new mapboxgl.Marker({
      draggable: true,
      color: resolveMarkerColor(),
    })
      .setLngLat(initialCenter)
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      onChange(lngLat.lat, lngLat.lng);
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      onChange(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => map.resize())
        : null;
    if (resizeObserver && containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver?.disconnect();
      marker.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (latitude && longitude && markerRef.current && mapRef.current) {
      const currentLngLat = markerRef.current.getLngLat();
      if (currentLngLat.lat !== latitude || currentLngLat.lng !== longitude) {
        markerRef.current.setLngLat([longitude, latitude]);
        mapRef.current.flyTo({ center: [longitude, latitude], zoom: 13 });
      }
    }
  }, [latitude, longitude]);

  const locateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocateError("Geolocation is not supported on this device");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setLocating(false);
        markerRef.current?.setLngLat(coords);
        mapRef.current?.flyTo({ center: coords, zoom: 13, duration: 1200 });
        onChange(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setLocateError("Unable to access your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [onChange]);

  if (!token) {
    return (
      <div
        className="glass flex flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center"
        style={{ height }}
      >
        <AlertCircle className="h-6 w-6 text-warning" />
        <div className="text-xs font-semibold">Mapbox token not configured</div>
        <div className="max-w-xs text-[11px] text-muted-foreground">
          Add <code className="rounded bg-muted px-1 py-0.5">VITE_MAPBOX_TOKEN</code> to your{" "}
          <code className="rounded bg-muted px-1 py-0.5">.env</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40">
      <div ref={containerRef} style={{ height, width: "100%" }} />
      <div className="absolute bottom-2 start-2 z-10 rounded-xl bg-background/90 px-3 py-1.5 text-[11px] font-semibold shadow backdrop-blur">
        Click or drag pin to position practice location
      </div>
      <button
        type="button"
        onClick={locateMe}
        disabled={locating}
        title={locateError ?? "Use my current location"}
        className="absolute end-2 top-2 z-10 flex items-center gap-1.5 rounded-xl bg-background/90 px-2.5 py-1.5 text-[11px] font-bold shadow backdrop-blur disabled:opacity-60 cursor-pointer"
      >
        <LocateFixed className={cn("h-3.5 w-3.5 text-primary-500", locating && "animate-pulse")} />
        {locating ? "Locating…" : "Use my current location"}
      </button>
      {locateError && (
        <div className="absolute end-2 top-11 z-10 max-w-[200px] rounded-xl bg-danger/10 border border-danger/30 px-2.5 py-1.5 text-[10px] font-semibold text-danger shadow">
          {locateError}
        </div>
      )}
    </div>
  );
}
