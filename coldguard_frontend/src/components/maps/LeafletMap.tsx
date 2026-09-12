'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  description?: string;
  type?: 'truck' | 'origin' | 'destination' | 'facility' | 'pin';
}

interface MapProps {
  markers?: MapMarker[];
  routeCoordinates?: Array<[number, number]>;
  zoom?: number;
  center?: [number, number];
  routeColor?: string;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

export default function LeafletMap({
  markers = [],
  routeCoordinates = [],
  zoom = 10,
  center = [15.3800, 73.9200],
  routeColor = '#2563EB',
  onMapClick,
  className = 'w-full h-full min-h-[520px] rounded-2xl z-10',
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const truckMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markersMapRef = useRef<Map<string, any>>(new Map());
  const hasFitBoundsRef = useRef<boolean>(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const lastRouteSigRef = useRef<string>('');

  // 1. Initialize Leaflet Map Instance Once
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current || mapRef.current) return;

      LRef.current = L;

      // Fix default icons in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      // Map Click delegation via ref
      map.on('click', (e: any) => {
        if (onMapClickRef.current) {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });

      // Smooth ResizeObserver to avoid glitchy setTimeout calls
      if (typeof window !== 'undefined' && 'ResizeObserver' in window && containerRef.current) {
        const ro = new ResizeObserver(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize({ pan: false });
          }
        });
        ro.observe(containerRef.current);
      }
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Synchronize Layers & Markers without clearing or glitching
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !L || !layerGroup) return;

    // A. Update or Draw Polyline
    const routeSig = routeCoordinates && routeCoordinates.length > 0
      ? `${routeCoordinates[0][0]}_${routeCoordinates[0][1]}_${routeCoordinates.length}`
      : '';

    const routeChanged = routeSig !== lastRouteSigRef.current;
    if (routeChanged) {
      lastRouteSigRef.current = routeSig;
      if (routeCoordinates && routeCoordinates.length > 0) {
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(routeCoordinates);
          polylineRef.current.setStyle({ color: routeColor });
        } else {
          const polyline = L.polyline(routeCoordinates, {
            color: routeColor,
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round',
          });
          layerGroup.addLayer(polyline);
          polylineRef.current = polyline;
        }

        // Fit bounds once on route load
        if (!hasFitBoundsRef.current) {
          map.fitBounds(polylineRef.current.getBounds(), { padding: [35, 35] });
          hasFitBoundsRef.current = true;
        }
      } else if (polylineRef.current) {
        layerGroup.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
    } else if (polylineRef.current && routeColor) {
      polylineRef.current.setStyle({ color: routeColor });
    }

    // B. Update Truck Marker Smoothly (Zero recreation, 0 flicker)
    const truckItem = markers.find((m) => m.type === 'truck');
    if (truckItem && !isNaN(truckItem.lat) && !isNaN(truckItem.lng)) {
      const latLng = L.latLng(truckItem.lat, truckItem.lng);
      if (truckMarkerRef.current) {
        truckMarkerRef.current.setLatLng(latLng);
        const popup = truckMarkerRef.current.getPopup();
        if (popup) {
          popup.setContent(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
              <b style="color: #0f172a;">${truckItem.title}</b>
              ${truckItem.description ? `<p style="margin: 4px 0 0 0; color: #475569;">${truckItem.description}</p>` : ''}
            </div>
          `);
        }
      } else {
        const truckDivIcon = L.divIcon({
          className: 'cg-live-truck-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: #dc2626; border: 2.5px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 17px; z-index: 10;">
                🚛
              </div>
              <div style="background: rgba(15, 23, 42, 0.95); color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 8px; margin-top: 2px; white-space: nowrap; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                LIVE TRUCK
              </div>
            </div>
          `,
          iconSize: [40, 52],
          iconAnchor: [20, 26],
          popupAnchor: [0, -26],
        });
        const marker = L.marker(latLng, { icon: truckDivIcon, zIndexOffset: 1000 });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <b style="color: #0f172a;">${truckItem.title}</b>
            ${truckItem.description ? `<p style="margin: 4px 0 0 0; color: #475569;">${truckItem.description}</p>` : ''}
          </div>
        `);
        layerGroup.addLayer(marker);
        truckMarkerRef.current = marker;
      }
    } else if (!truckItem && truckMarkerRef.current) {
      layerGroup.removeLayer(truckMarkerRef.current);
      truckMarkerRef.current = null;
    }

    // C. Synchronize Static / Facility / Pin Markers without wiping
    const currentKeys = new Set<string>();
    const staticItems = markers.filter((m) => m.type !== 'truck');

    staticItems.forEach((m) => {
      if (!m.lat || !m.lng || isNaN(m.lat) || isNaN(m.lng)) return;
      const key = `${m.type || 'marker'}::${m.title}`;
      currentKeys.add(key);

      const latLng = L.latLng(m.lat, m.lng);
      const existing = markersMapRef.current.get(key);

      if (existing) {
        existing.setLatLng(latLng);
      } else {
        let iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
        if (m.type === 'facility') {
          iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png';
        } else if (m.type === 'destination' || m.type === 'pin') {
          iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png';
        } else if (m.type === 'origin') {
          iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';
        }

        const customIcon = L.icon({
          iconUrl,
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        });

        const marker = L.marker(latLng, { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <b style="color: #0f172a;">${m.title}</b>
            ${m.description ? `<p style="margin: 4px 0 0 0; color: #475569;">${m.description}</p>` : ''}
          </div>
        `);
        layerGroup.addLayer(marker);
        markersMapRef.current.set(key, marker);
      }
    });

    // Remove obsolete static markers
    for (const [key, marker] of markersMapRef.current.entries()) {
      if (!currentKeys.has(key)) {
        layerGroup.removeLayer(marker);
        markersMapRef.current.delete(key);
      }
    }

    // Initial bounds fit if no route exists
    if (!hasFitBoundsRef.current && (!routeCoordinates || routeCoordinates.length === 0) && markers.length > 0) {
      const bounds = L.latLngBounds([]);
      markers.forEach((m) => {
        if (m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng)) {
          bounds.extend(L.latLng(m.lat, m.lng));
        }
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
        hasFitBoundsRef.current = true;
      }
    }
  }, [markers, routeCoordinates, routeColor]);

  return <div ref={containerRef} className={className} />;
}
