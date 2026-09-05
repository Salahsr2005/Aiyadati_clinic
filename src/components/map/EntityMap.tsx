import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import mapboxgl, { type LngLatLike, type MapMouseEvent } from "mapbox-gl";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  AlertCircle,
  Layers,
  Flame,
  Stethoscope,
  Building2,
  Navigation,
  LocateFixed,
  Eye,
  EyeOff,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/store/ui";
import { doctorPlaceholderUrl } from "@/lib/assetFallbacks";
import { cn } from "@/lib/utils";

interface GeoJsonFeatureLike {
  properties?: Record<string, unknown> | null;
  geometry: { coordinates: [number, number] } | unknown;
}

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badgeLabel?: string;
  badgeTone?: "success" | "warning" | "danger" | "info";
  /** Optional type to split markers into distinct layers. Defaults to "clinic". */
  type?: "doctor" | "clinic" | "appointment";
  /** Optional numeric weight used for the heatmap layer (e.g. value, count). */
  weight?: number;
  /** Optional key/value rows shown in the popup for a richer detail card. */
  meta?: { label: string; value: string }[];
}

interface EntityMapProps {
  points: MapPoint[];
  onSelect?: (id: string) => void;
  height?: number | string;
  emptyLabel?: string;
  fallbackImageUrl?: string;
  /** Show the current user's device location as a distinct marker with a "Locate me" control. */
  showUserLocation?: boolean;
  /** Show the side list synced with the map. Defaults to true. */
  showList?: boolean;
}

export const FALLBACK_MAPBOX_TOKEN = "";

const ALGERIA_CENTER: LngLatLike = [2.6323, 28.0339];

const TONE_BG: Record<NonNullable<MapPoint["badgeTone"]>, string> = {
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

const LAYER_COLORS = {
  doctor: "#a78bfa",
  clinic: "#14b8a6",
  appointment: "#f43f5e",
};

type MapStyleKey = "streets" | "satellite" | "light" | "dark";

const MAP_STYLES: Record<MapStyleKey, string> = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
};

// Quick-fly locations in Algeria
const FLY_TO_LOCATIONS: { label: string; center: [number, number]; zoom: number }[] = [
  { label: "Algiers", center: [3.042, 36.752], zoom: 11 },
  { label: "Oran", center: [-0.6418, 35.6969], zoom: 11 },
  { label: "Constantine", center: [6.6147, 36.365], zoom: 11 },
  { label: "Annaba", center: [7.7534, 36.9], zoom: 11 },
  { label: "Setif", center: [5.4108, 36.19], zoom: 11 },
];

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in kilometers between two [lng, lat] points. */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (km < 1) return t("map.distanceAway", { distance: `${Math.round(km * 1000)} ${t("map.m")}` });
  return t("map.distanceAway", { distance: `${km.toFixed(1)} ${t("map.km")}` });
}

/** Generates a GeoJSON polygon approximating a circle of `radiusKm` around center. */
function circlePolygon(center: [number, number], radiusKm: number, points = 64) {
  const coords: [number, number][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos(toRad(center[1])));
  const distanceY = radiusKm / 110.574;
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([center[0] + distanceX * Math.cos(theta), center[1] + distanceY * Math.sin(theta)]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function EntityMap({
  points,
  onSelect,
  height = 520,
  emptyLabel,
  fallbackImageUrl = doctorPlaceholderUrl,
  showUserLocation = false,
  showList = true,
}: EntityMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);
  const themeMode = useUIStore((s) => s.themeMode);
  const theme =
    themeMode === "system"
      ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light")
      : themeMode;
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);
  const [showFlyMenu, setShowFlyMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [styleOverride, setStyleOverride] = useState<MapStyleKey | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Layer toggles
  const [showClinics, setShowClinics] = useState(true);
  const [showDoctors, setShowDoctors] = useState(true);
  const [showAppointments, setShowAppointments] = useState(true);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const token =
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
    (import.meta.env.VITE_PUBLIC_MAPBOX_TOKEN as string | undefined) ||
    FALLBACK_MAPBOX_TOKEN;
  const tokenLooksValid = !!token && /^pk\./.test(token);

  const LAYER_META: Record<string, { label: string; icon: typeof Building2; color: string }> = useMemo(
    () => ({
      clinic: { label: t("map.clinics"), icon: Building2, color: LAYER_COLORS.clinic },
      doctor: { label: t("map.doctors"), icon: Stethoscope, color: LAYER_COLORS.doctor },
      appointment: { label: t("map.bookingDensity"), icon: Flame, color: LAYER_COLORS.appointment },
    }),
    [t],
  );

  // Filter points by search term (applies to both map sources and side list)
  const filteredPoints = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.subtitle ?? "").toLowerCase().includes(q) ||
        (p.badgeLabel ?? "").toLowerCase().includes(q),
    );
  }, [points, search]);

  // Helper to map Point objects into GeoJSON Features
  const mapPointToFeature = useCallback((p: MapPoint) => ({
    type: "Feature" as const,
    id: p.id,
    properties: {
      id: p.id,
      title: p.title,
      subtitle: p.subtitle ?? "",
      imageUrl: p.imageUrl ?? "",
      badgeLabel: p.badgeLabel ?? "",
      tone: p.badgeTone ?? "info",
      weight: p.weight ?? 1,
      type: p.type ?? "clinic",
      meta: p.meta ? JSON.stringify(p.meta) : "",
    },
    geometry: { type: "Point" as const, coordinates: [p.longitude, p.latitude] },
  }), []);

  const clinicsGeojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: filteredPoints
        .filter((p) => (p.type === "clinic" || !p.type) && Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map(mapPointToFeature),
    }),
    [filteredPoints, mapPointToFeature],
  );

  const doctorsGeojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: filteredPoints
        .filter((p) => p.type === "doctor" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map(mapPointToFeature),
    }),
    [filteredPoints, mapPointToFeature],
  );

  const appointmentsGeojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: filteredPoints
        .filter((p) => p.type === "appointment" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map(mapPointToFeature),
    }),
    [filteredPoints, mapPointToFeature],
  );

  const counts = useMemo(() => {
    return {
      clinic: clinicsGeojson.features.length,
      doctor: doctorsGeojson.features.length,
      appointment: appointmentsGeojson.features.length,
      total: filteredPoints.length,
    };
  }, [clinicsGeojson, doctorsGeojson, appointmentsGeojson, filteredPoints]);

  // Points sorted by distance from user (when available), for the side list
  const sortedListPoints = useMemo(() => {
    const withDistance = filteredPoints
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => ({
        point: p,
        distanceKm: userLocation ? haversineKm(userLocation, [p.longitude, p.latitude]) : null,
      }));
    if (userLocation) {
      withDistance.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      withDistance.sort((a, b) => a.point.title.localeCompare(b.point.title));
    }
    return withDistance;
  }, [filteredPoints, userLocation]);

  // Handle popup
  const showPopup = useCallback(
    (map: mapboxgl.Map, coords: [number, number], props: Record<string, string>, opts?: { interactive?: boolean }) => {
      const target = opts?.interactive === false ? hoverPopupRef : popupRef;
      target.current?.remove();
      const distanceKm = userLocationRef.current ? haversineKm(userLocationRef.current, coords) : null;
      const popup = new mapboxgl.Popup({
        offset: 18,
        closeButton: opts?.interactive !== false,
        maxWidth: "300px",
        className: "iyadati-popup",
      })
        .setLngLat(coords)
        .setHTML(renderPopupHtml(props, fallbackImageUrl, distanceKm, t))
        .addTo(map);

      if (opts?.interactive !== false) {
        popup
          .getElement()
          ?.querySelector<HTMLButtonElement>("button[data-entity-id]")
          ?.addEventListener("click", (ev) => {
            const id = (ev.currentTarget as HTMLButtonElement).getAttribute("data-entity-id");
            if (id) onSelect?.(id);
            popup.remove();
          });
      }
      target.current = popup;
    },
    [onSelect, fallbackImageUrl, t],
  );

  const setupSourcesAndLayers = useCallback(
    (map: mapboxgl.Map) => {
      if (!map.getSource("source-clinics")) {
        map.addSource("source-clinics", {
          type: "geojson",
          data: clinicsGeojson,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 45,
        });
        map.addSource("source-doctors", {
          type: "geojson",
          data: doctorsGeojson,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 45,
        });
        map.addSource("source-appointments", {
          type: "geojson",
          data: appointmentsGeojson,
        });
        map.addSource("source-user-accuracy", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        addMapLayers(map);
      } else {
        (map.getSource("source-clinics") as mapboxgl.GeoJSONSource).setData(clinicsGeojson);
        (map.getSource("source-doctors") as mapboxgl.GeoJSONSource).setData(doctorsGeojson);
        (map.getSource("source-appointments") as mapboxgl.GeoJSONSource).setData(appointmentsGeojson);
      }
    },
    [clinicsGeojson, doctorsGeojson, appointmentsGeojson],
  );

  const attachInteractions = useCallback(
    (map: mapboxgl.Map) => {
      // Cluster expand
      ["clinics-clusters", "doctors-clusters"].forEach((layerId) => {
        map.on("click", layerId, (e: MapMouseEvent) => {
          const features = map.queryRenderedFeatures(e.point, { layers: [layerId] }) as unknown as GeoJsonFeatureLike[];
          const clusterId = features[0]?.properties?.cluster_id as number | undefined;
          if (clusterId == null) return;
          const srcId = layerId.startsWith("clinics") ? "source-clinics" : "source-doctors";
          const src = map.getSource(srcId) as mapboxgl.GeoJSONSource;
          src.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            const coords = (features[0].geometry as { coordinates: [number, number] }).coordinates;
            map.easeTo({ center: coords, zoom: zoom ?? 7 });
          });
        });
      });

      // Popup triggers (click)
      ["clinics-unclustered-point", "doctors-unclustered-point", "appointments-heat-point"].forEach((layerId) => {
        map.on("click", layerId, (e: MapMouseEvent) => {
          const f = e.features?.[0] as unknown as GeoJsonFeatureLike | undefined;
          if (!f) return;
          const props = f.properties as Record<string, string>;
          const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
          setSelectedId(props.id);
          showPopup(map, coords, props);
        });
      });

      // Hover popups
      ["clinics-unclustered-point", "doctors-unclustered-point"].forEach((layerId) => {
        map.on("mouseenter", layerId, (e: MapMouseEvent) => {
          map.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0] as unknown as GeoJsonFeatureLike | undefined;
          if (!f) return;
          const props = f.properties as Record<string, string>;
          const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
          showPopup(map, coords, props, { interactive: false });
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          hoverPopupRef.current?.remove();
        });
      });

      const hoverLayers = [
        "clinics-clusters", "doctors-clusters",
        "appointments-heat-point",
      ];
      hoverLayers.forEach((layerId) => {
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      });
    },
    [showPopup],
  );

  // Init map
  useEffect(() => {
    if (!tokenLooksValid || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token as string;
    const effectiveStyle = styleOverride ?? (theme === "dark" ? "dark" : "light");
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES[effectiveStyle],
      center: ALGERIA_CENTER,
      zoom: 4.8,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

    map.on("load", () => {
      setupSourcesAndLayers(map);
      updateLayerVisibilitiesRef.current?.(map);
      attachInteractions(map);
      setReady(true);
    });

    // Re-add sources/layers whenever the style changes (theme or manual switch)
    map.on("style.load", () => {
      if (map.getSource("source-clinics")) return; // already present, nothing to re-add
      setupSourcesAndLayers(map);
      updateLayerVisibilitiesRef.current?.(map);
      attachInteractions(map);
    });

    mapRef.current = map;
    map.on("error", (e) => console.error("[mapbox]", e && (e as { error?: Error }).error));

    return () => {
      popupRef.current?.remove();
      hoverPopupRef.current?.remove();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenLooksValid]);

  // Style change (theme or manual override)
  const effectiveStyleKey: MapStyleKey = styleOverride ?? (theme === "dark" ? "dark" : "light");
  const prevStyleRef = useRef(effectiveStyleKey);
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    if (prevStyleRef.current === effectiveStyleKey) return;
    prevStyleRef.current = effectiveStyleKey;
    mapRef.current.setStyle(MAP_STYLES[effectiveStyleKey]);
  }, [effectiveStyleKey, ready]);

  // Data source updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const cSrc = map.getSource("source-clinics") as mapboxgl.GeoJSONSource | undefined;
    if (cSrc) cSrc.setData(clinicsGeojson);
    const dSrc = map.getSource("source-doctors") as mapboxgl.GeoJSONSource | undefined;
    if (dSrc) dSrc.setData(doctorsGeojson);
    const aSrc = map.getSource("source-appointments") as mapboxgl.GeoJSONSource | undefined;
    if (aSrc) aSrc.setData(appointmentsGeojson);

    if (filteredPoints.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredPoints.forEach((p) => {
        if (Number.isFinite(p.longitude) && Number.isFinite(p.latitude)) {
          bounds.extend([p.longitude, p.latitude]);
        }
      });
      map.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 500 });
    }
  }, [filteredPoints, ready, clinicsGeojson, doctorsGeojson, appointmentsGeojson]);

  // Visibility toggle
  const updateLayerVisibilities = useCallback((map: mapboxgl.Map) => {
    const cVis = showClinics ? "visible" : "none";
    ["clinics-clusters", "clinics-cluster-count", "clinics-unclustered-halo", "clinics-unclustered-point"].forEach(
      (id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", cVis),
    );
    const dVis = showDoctors ? "visible" : "none";
    ["doctors-clusters", "doctors-cluster-count", "doctors-unclustered-halo", "doctors-unclustered-point"].forEach(
      (id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", dVis),
    );
    const aVis = showAppointments ? "visible" : "none";
    ["appointments-heat", "appointments-heat-point"].forEach(
      (id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", aVis),
    );
  }, [showClinics, showDoctors, showAppointments]);

  const updateLayerVisibilitiesRef = useRef(updateLayerVisibilities);
  useEffect(() => {
    updateLayerVisibilitiesRef.current = updateLayerVisibilities;
  }, [updateLayerVisibilities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updateLayerVisibilities(map);
  }, [showClinics, showDoctors, showAppointments, ready, updateLayerVisibilities]);

  const flyTo = useCallback((center: [number, number], zoom: number) => {
    mapRef.current?.flyTo({ center, zoom, duration: 1200 });
    setShowFlyMenu(false);
  }, []);

  const flyToPoint = useCallback(
    (p: MapPoint) => {
      setSelectedId(p.id);
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({ center: [p.longitude, p.latitude], zoom: 14, duration: 1000 });
      const props: Record<string, string> = {
        id: p.id,
        title: p.title,
        subtitle: p.subtitle ?? "",
        imageUrl: p.imageUrl ?? "",
        badgeLabel: p.badgeLabel ?? "",
        tone: p.badgeTone ?? "info",
        meta: p.meta ? JSON.stringify(p.meta) : "",
      };
      window.setTimeout(() => showPopup(map, [p.longitude, p.latitude], props), 900);
    },
    [showPopup],
  );

  const locateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocateError(t("map.geoUnsupported"));
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        setAccuracy(pos.coords.accuracy ?? null);
        setLocating(false);
        mapRef.current?.flyTo({ center: coords, zoom: 13, duration: 1200 });
      },
      (err) => {
        setLocating(false);
        setLocateError(t("map.geoDenied"));
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(t("map.geoDeniedToastTitle"), { description: t("map.geoDeniedToastBody") });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [t]);

  const recenter = useCallback(() => {
    if (userLocation) mapRef.current?.flyTo({ center: userLocation, zoom: 13, duration: 1000 });
  }, [userLocation]);

  // Render / update the user location marker + accuracy circle
  useEffect(() => {
    const map = mapRef.current;
    if (!showUserLocation || !map || !ready) return;
    const accSrc = map.getSource("source-user-accuracy") as mapboxgl.GeoJSONSource | undefined;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      accSrc?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    if (accSrc) {
      const radiusKm = Math.max((accuracy ?? 50) / 1000, 0.02);
      accSrc.setData({ type: "FeatureCollection", features: [circlePolygon(userLocation, radiusKm)] });
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "9999px";
      el.style.background = "#2563eb";
      el.style.border = "3px solid #ffffff";
      el.style.boxShadow = "0 0 0 6px rgba(37,99,235,0.25), 0 2px 8px rgba(0,0,0,0.35)";
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(userLocation)
        .setPopup(new mapboxgl.Popup({ offset: 14 }).setText(t("map.youAreHere")))
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(userLocation);
    }
  }, [showUserLocation, userLocation, accuracy, ready, t]);

  if (!tokenLooksValid) {
    return (
      <div
        className="glass flex flex-col items-center justify-center gap-2 rounded-3xl p-8 text-center"
        style={{ height }}
      >
        <AlertCircle className="h-8 w-8 text-warning" />
        <div className="text-sm font-semibold">{t("map.tokenMissingTitle")}</div>
        <div className="max-w-md text-xs text-muted-foreground">
          {t("map.tokenMissingBody")}{" "}
          <code className="rounded bg-muted px-1 py-0.5">VITE_MAPBOX_TOKEN</code>
        </div>
      </div>
    );
  }

  const mapHeight = isMobile ? Math.round((typeof height === "number" ? height : 420) * 0.75) : height;

  const toggles: { key: string; active: boolean; toggle: () => void }[] = [
    { key: "clinic", active: showClinics, toggle: () => setShowClinics((v) => !v) },
    { key: "doctor", active: showDoctors, toggle: () => setShowDoctors((v) => !v) },
    { key: "appointment", active: showAppointments, toggle: () => setShowAppointments((v) => !v) },
  ];

  const styleOptions: { key: MapStyleKey; label: string }[] = [
    { key: "streets", label: t("map.styleStreets") },
    { key: "satellite", label: t("map.styleSatellite") },
    { key: "light", label: t("map.styleLight") },
    { key: "dark", label: t("map.styleDark") },
  ];

  return (
    <div className={cn("flex flex-col gap-3 md:flex-row", showList ? "" : "")}>
      <div className="relative flex-1 min-w-0">
        {/* Map canvas */}
        <div
          ref={containerRef}
          className="overflow-hidden rounded-3xl"
          style={{ height: mapHeight, width: "100%" }}
        />

        {points.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[10] flex items-center justify-center">
            <div className="pointer-events-auto rounded-2xl bg-background/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md border border-border/40">
              {emptyLabel || t("map.empty")}
            </div>
          </div>
        )}

        {/* ─── TOP-LEFT: Summary counter + search ─── */}
        <div className="pointer-events-none absolute left-3 top-3 z-[10] flex flex-col gap-2 max-w-[calc(100%-1rem)]">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-background/90 px-3 py-2 text-xs font-bold shadow-lg backdrop-blur-md border border-border/40 w-fit">
            <MapPin className="h-3.5 w-3.5 text-primary-500" />
            <span className="tabular-nums">{counts.total.toLocaleString()}</span>
            <span className="text-muted-foreground font-medium">{t("map.entitiesMapped")}</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-background/90 px-2.5 py-1.5 shadow-lg backdrop-blur-md border border-border/40 w-fit min-w-[180px]">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("map.search")}
              className="bg-transparent text-[11px] font-medium outline-none placeholder:text-muted-foreground/60 w-full"
            />
            {search && (
              <button onClick={() => setSearch("")} className="shrink-0 cursor-pointer">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* ─── TOP-RIGHT: Quick Navigation / style / locate ─── */}
        <div className="absolute right-3 top-14 z-[10] flex flex-col gap-1.5 items-end">
          {/* Style switcher */}
          <div className="relative">
            <button
              onClick={() => setShowStyleMenu((v) => !v)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-background/90 px-3 py-2 text-[11px] font-bold shadow-lg backdrop-blur-md border border-border/40 cursor-pointer hover:bg-background transition-colors"
            >
              <Layers className="h-3.5 w-3.5 text-primary-500" />
              {t("map.style")}
            </button>
            {showStyleMenu && (
              <div className="pointer-events-auto absolute right-0 top-full mt-1.5 w-40 rounded-xl bg-background/95 border border-border/40 shadow-xl backdrop-blur-md overflow-hidden">
                {styleOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setStyleOverride(opt.key);
                      setShowStyleMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold hover:bg-primary-500/10 hover:text-primary-500 cursor-pointer transition-colors",
                      effectiveStyleKey === opt.key ? "text-primary-500" : "text-foreground/80",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fly-to button */}
          <div className="relative">
            <button
              onClick={() => setShowFlyMenu((v) => !v)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-background/90 px-3 py-2 text-[11px] font-bold shadow-lg backdrop-blur-md border border-border/40 cursor-pointer hover:bg-background transition-colors"
            >
              <Navigation className="h-3.5 w-3.5 text-primary-500" />
              {t("map.quickFly")}
            </button>
            {showFlyMenu && (
              <div className="pointer-events-auto absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-background/95 border border-border/40 shadow-xl backdrop-blur-md overflow-hidden">
                <button
                  onClick={() => flyTo(ALGERIA_CENTER as [number, number], 4.8)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold text-foreground/80 hover:bg-primary-500/10 hover:text-primary-500 cursor-pointer transition-colors"
                >
                  <LocateFixed className="h-3 w-3 shrink-0" />
                  {t("map.allAlgeria")}
                </button>
                {FLY_TO_LOCATIONS.map((loc) => (
                  <button
                    key={loc.label}
                    onClick={() => flyTo(loc.center, loc.zoom)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold text-foreground/80 hover:bg-primary-500/10 hover:text-primary-500 cursor-pointer transition-colors"
                  >
                    <LocateFixed className="h-3 w-3 shrink-0" />
                    {loc.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Locate me / recenter */}
          {showUserLocation && (
            <button
              onClick={userLocation ? recenter : locateMe}
              disabled={locating}
              className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-background/90 px-3 py-2 text-[11px] font-bold shadow-lg backdrop-blur-md border border-border/40 cursor-pointer hover:bg-background transition-colors disabled:opacity-60"
              title={locateError ?? t("map.locateMe")}
            >
              <LocateFixed className={cn("h-3.5 w-3.5 text-primary-500", locating && "animate-pulse")} />
              {locating ? t("map.locating") : userLocation ? t("map.recenter") : t("map.locateMe")}
            </button>
          )}
        </div>
        {showUserLocation && locateError && (
          <div className="absolute right-3 top-[9.5rem] z-[10] max-w-[200px] rounded-xl bg-danger/10 border border-danger/30 px-2.5 py-1.5 text-[10px] font-semibold text-danger shadow-lg">
            {locateError}
          </div>
        )}

        {/* ─── BOTTOM-LEFT: Layer toggle pills ─── */}
        <div className="absolute left-3 bottom-3 z-[10] flex flex-col gap-2">
          <div className="pointer-events-auto flex flex-col gap-1.5 rounded-2xl bg-background/90 p-2.5 shadow-lg backdrop-blur-md border border-border/40">
            <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider uppercase text-muted-foreground px-1 pb-1 border-b border-border/30">
              <Layers className="h-3 w-3" />
              {t("map.layers")}
            </div>
            {toggles.map(({ key, active, toggle }) => {
              const meta = LAYER_META[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={toggle}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-bold cursor-pointer transition-all",
                    active
                      ? "bg-foreground/5 text-foreground"
                      : "text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-lg transition-colors"
                    style={{
                      background: active ? `${meta.color}20` : "var(--muted)",
                      color: active ? meta.color : "var(--muted-foreground)",
                    }}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="flex-1 text-left">{meta.label}</span>
                  <span className="tabular-nums text-[10px]">
                    {(counts as Record<string, number>)[key] ?? 0}
                  </span>
                  {active ? (
                    <Eye className="h-3 w-3 text-muted-foreground/60" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── BOTTOM-RIGHT: Legend ─── */}
        <div className="pointer-events-none absolute right-3 bottom-3 z-[10] rounded-2xl bg-background/90 p-2.5 shadow-lg backdrop-blur-md border border-border/40 hidden sm:block">
          <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider uppercase text-muted-foreground px-1 pb-1.5 mb-1.5 border-b border-border/30">
            <Layers className="h-3 w-3 text-primary-500" />
            {t("map.legend")}
          </div>
          <div className="flex flex-col gap-1 text-[10px] font-semibold">
            <LegendItem color={TONE_BG.success} label={t("map.verifiedActive")} />
            <LegendItem color={TONE_BG.warning} label={t("map.pending")} />
            <LegendItem color={TONE_BG.danger} label={t("map.suspended")} />
            <LegendItem color={TONE_BG.info} label={t("map.other")} />
          </div>
        </div>

        {/* Click outside menus */}
        {(showFlyMenu || showStyleMenu) && (
          <div
            className="fixed inset-0 z-[5]"
            onClick={() => {
              setShowFlyMenu(false);
              setShowStyleMenu(false);
            }}
          />
        )}
      </div>

      {/* ─── SIDE LIST ─── */}
      {showList && (
        <div className="w-full md:w-72 shrink-0 rounded-2xl border border-border/40 bg-background/60 overflow-hidden flex flex-col max-h-[420px] md:max-h-none">
          <div className="px-3 py-2 border-b border-border/30 text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
            {t("map.listTitle")} ({sortedListPoints.length})
          </div>
          <div className="overflow-y-auto flex-1">
            {sortedListPoints.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">{t("map.noResults")}</div>
            )}
            {sortedListPoints.map(({ point, distanceKm }) => (
              <button
                key={point.id}
                onClick={() => flyToPoint(point)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-border/20 px-3 py-2.5 text-left transition-colors cursor-pointer hover:bg-primary-500/5",
                  selectedId === point.id && "bg-primary-500/10",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate">{point.title}</span>
                  {point.badgeLabel && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{
                        background: `${TONE_BG[point.badgeTone ?? "info"]}20`,
                        color: TONE_BG[point.badgeTone ?? "info"],
                      }}
                    >
                      {point.badgeLabel}
                    </span>
                  )}
                </div>
                {point.subtitle && (
                  <span className="text-[10px] text-muted-foreground truncate">{point.subtitle}</span>
                )}
                {distanceKm != null && (
                  <span className="text-[10px] font-semibold text-primary-500">{formatDistance(distanceKm, t)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 px-1">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-foreground/70">{label}</span>
    </span>
  );
}

function addMapLayers(map: mapboxgl.Map) {
  // User location accuracy circle
  map.addLayer({
    id: "user-accuracy-circle",
    type: "fill",
    source: "source-user-accuracy",
    paint: {
      "fill-color": "#2563eb",
      "fill-opacity": 0.12,
    },
  });
  map.addLayer({
    id: "user-accuracy-outline",
    type: "line",
    source: "source-user-accuracy",
    paint: {
      "line-color": "#2563eb",
      "line-width": 1.5,
      "line-opacity": 0.4,
    },
  });

  // Appointment Density Heatmap
  map.addLayer({
    id: "appointments-heat",
    type: "heatmap",
    source: "source-appointments",
    maxzoom: 14,
    paint: {
      "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 100, 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 12, 3],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(244,63,94,0)",
        0.2, "rgba(244,63,94,0.3)",
        0.4, "rgba(245,158,11,0.6)",
        0.7, "rgba(239,68,68,0.8)",
        1, "rgba(225,29,72,1)",
      ],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 12, 35],
      "heatmap-opacity": 0.8,
    },
  });

  map.addLayer({
    id: "appointments-heat-point",
    type: "circle",
    source: "source-appointments",
    paint: {
      "circle-color": "transparent",
      "circle-radius": 15,
    },
  });

  // Clinics Clusters
  map.addLayer({
    id: "clinics-clusters",
    type: "circle",
    source: "source-clinics",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": ["step", ["get", "point_count"], LAYER_COLORS.clinic, 25, "#0d9488", 100, "#0f766e"],
      "circle-radius": ["step", ["get", "point_count"], 18, 25, 22, 100, 26],
      "circle-stroke-width": 3,
      "circle-stroke-color": "rgba(255,255,255,0.9)",
    },
  });

  map.addLayer({
    id: "clinics-cluster-count",
    type: "symbol",
    source: "source-clinics",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 11,
    },
    paint: { "text-color": "#ffffff" },
  });

  map.addLayer({
    id: "clinics-unclustered-halo",
    type: "circle",
    source: "source-clinics",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": [
        "match", ["get", "tone"],
        "success", TONE_BG.success,
        "warning", TONE_BG.warning,
        "danger", TONE_BG.danger,
        TONE_BG.info,
      ],
      "circle-radius": 16,
      "circle-blur": 0.9,
      "circle-opacity": 0.35,
    },
  });

  map.addLayer({
    id: "clinics-unclustered-point",
    type: "circle",
    source: "source-clinics",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": LAYER_COLORS.clinic,
      "circle-radius": 7,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  // Doctors Clusters
  map.addLayer({
    id: "doctors-clusters",
    type: "circle",
    source: "source-doctors",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": ["step", ["get", "point_count"], LAYER_COLORS.doctor, 25, "#8b5cf6", 100, "#7c3aed"],
      "circle-radius": ["step", ["get", "point_count"], 18, 25, 22, 100, 26],
      "circle-stroke-width": 3,
      "circle-stroke-color": "rgba(255,255,255,0.9)",
    },
  });

  map.addLayer({
    id: "doctors-cluster-count",
    type: "symbol",
    source: "source-doctors",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 11,
    },
    paint: { "text-color": "#ffffff" },
  });

  map.addLayer({
    id: "doctors-unclustered-halo",
    type: "circle",
    source: "source-doctors",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": [
        "match", ["get", "tone"],
        "success", TONE_BG.success,
        "warning", TONE_BG.warning,
        "danger", TONE_BG.danger,
        TONE_BG.info,
      ],
      "circle-radius": 16,
      "circle-blur": 0.9,
      "circle-opacity": 0.35,
    },
  });

  map.addLayer({
    id: "doctors-unclustered-point",
    type: "circle",
    source: "source-doctors",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": LAYER_COLORS.doctor,
      "circle-radius": 7,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
}

function renderPopupHtml(
  props: Record<string, string>,
  fallback: string,
  distanceKm: number | null,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  const tone = (props.tone as keyof typeof TONE_BG) || "info";
  const color = TONE_BG[tone];
  const img = props.imageUrl && props.imageUrl.length > 0 ? props.imageUrl : fallback;

  const metaEntries = props.meta ? (JSON.parse(props.meta) as { label: string; value: string }[]) : [];
  if (distanceKm != null) {
    metaEntries.push({ label: "Distance", value: formatDistance(distanceKm, t) });
  }

  const metaRows = metaEntries
    .slice(0, 5)
    .map(
      (m) => `
        <div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid color-mix(in oklab, var(--border) 60%, transparent);font-size:11px">
          <span style="color:var(--muted-foreground)">${escapeHtml(m.label)}</span>
          <span style="font-weight:600;color:var(--foreground);text-align:right">${escapeHtml(m.value)}</span>
        </div>`,
    )
    .join("");

  return `
    <div style="min-width:240px;font-family:inherit;overflow:hidden;border-radius:16px;background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);box-shadow:0 20px 40px -12px rgba(10,26,60,.25)">
      <div style="position:relative">
        <img src="${escapeHtml(img)}" crossorigin="anonymous" onerror="this.src='${escapeHtml(fallback)}'" style="width:100%;height:110px;object-fit:cover;display:block" />
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.6))"></div>
        ${
          props.badgeLabel
            ? `<span style="position:absolute;top:8px;right:8px;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${color};color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)">${escapeHtml(props.badgeLabel)}</span>`
            : ""
        }
        <div style="position:absolute;left:10px;bottom:8px;color:#fff">
          <div style="font-weight:700;font-size:14px;line-height:1.15;text-shadow:0 1px 2px rgba(0,0,0,.5)">${escapeHtml(props.title)}</div>
          ${props.subtitle ? `<div style="font-size:11px;opacity:.9;margin-top:2px;text-shadow:0 1px 2px rgba(0,0,0,.5)">${escapeHtml(props.subtitle)}</div>` : ""}
        </div>
      </div>
      <div style="padding:10px 12px 12px">
        ${metaRows}
        ${
          props.id
            ? `<button data-entity-id="${escapeHtml(props.id)}" style="margin-top:10px;width:100%;padding:8px 10px;border-radius:10px;border:none;background:var(--primary-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.02em;box-shadow:0 4px 12px -2px color-mix(in oklab, var(--primary-500) 40%, transparent)">${escapeHtml(t("map.openDetails"))}</button>`
            : ""
        }
      </div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
