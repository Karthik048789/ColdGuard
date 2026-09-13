'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  description?: string;
  type?: 'origin' | 'destination' | 'truck' | 'facility' | 'pin';
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routeCoordinates?: Array<[number, number]>;
  routeColor?: string;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

export default function LeafletMap({
  center = [15.35, 73.95],
  zoom = 11,
  markers = [],
  routeCoordinates = [],
  routeColor = '#2563EB',
  onMapClick,
  className = 'w-full h-full',
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const truckMarkerRef = useRef<any>(null);
  const markersMapRef = useRef<Map<string, any>>(new Map());
  const onMapClickRef = useRef(onMapClick);
  const lastRouteSigRef = useRef<string>('');
  const hasFitInitialBoundsRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;
    let resizeTimer: any = null;
    let ro: ResizeObserver | null = null;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;
      LRef.current = L;

      // Fix default marker icons in Next.js bundlers
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

      // Force full tile rasterization immediately after mount and on next tick
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      }, 100);
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      }, 400);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      // Map Click delegation via ref
      map.on('click', (e: any) => {
        if (onMapClickRef.current) {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });

      // Rock-solid debounced ResizeObserver (prevents infinite resize/flicker loops)
      if (typeof window !== 'undefined' && 'ResizeObserver' in window && containerRef.current) {
        let lastWidth = containerRef.current.clientWidth;
        let lastHeight = containerRef.current.clientHeight;

        ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (Math.abs(width - lastWidth) >= 4 || Math.abs(height - lastHeight) >= 4) {
              lastWidth = width;
              lastHeight = height;
              clearTimeout(resizeTimer);
              resizeTimer = setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.invalidateSize({ pan: false });
                }
              }, 120);
            }
          }
        });
        ro.observe(containerRef.current);
      }
      setMapReady(true);
    });

    return () => {
      isMounted = false;
      clearTimeout(resizeTimer);
      if (ro) {
        ro.disconnect();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // 2. Synchronize Layers & Markers without glitching or tearing down layers
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !L || !layerGroup || !mapReady) return;

    // A. Update or Draw Polyline
    const hasRoute = Array.isArray(routeCoordinates) && routeCoordinates.length > 1;
    const routeSig = hasRoute
      ? `${routeCoordinates[0][0]}_${routeCoordinates[0][1]}_${routeCoordinates[routeCoordinates.length - 1][0]}_${routeCoordinates.length}`
      : '';

    if (hasRoute) {
      if (!polylineRef.current) {
        const polyline = L.polyline(routeCoordinates, {
          color: routeColor || '#2563EB',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
        });
        layerGroup.addLayer(polyline);
        polylineRef.current = polyline;
        lastRouteSigRef.current = routeSig;

        try {
          const bounds = polyline.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
          }
        } catch {}
      } else {
        if (routeSig !== lastRouteSigRef.current) {
          lastRouteSigRef.current = routeSig;
          polylineRef.current.setLatLngs(routeCoordinates);
          try {
            const bounds = polylineRef.current.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
            }
          } catch {}
        }
        polylineRef.current.setStyle({ color: routeColor || '#2563EB' });
        if (!layerGroup.hasLayer(polylineRef.current)) {
          layerGroup.addLayer(polylineRef.current);
        }
      }
      try {
        polylineRef.current.bringToBack();
      } catch {}
    } else if (polylineRef.current) {
      layerGroup.removeLayer(polylineRef.current);
      polylineRef.current = null;
      lastRouteSigRef.current = '';
    }

    // B. Smooth Live Truck Marker (Zero flicker, position updated via setLatLng)
    const truckItem = markers.find((m) => m.type === 'truck');
    if (truckItem && !isNaN(truckItem.lat) && !isNaN(truckItem.lng)) {
      const latLng = L.latLng(truckItem.lat, truckItem.lng);
      if (truckMarkerRef.current) {
        truckMarkerRef.current.setLatLng(latLng);
        const popup = truckMarkerRef.current.getPopup();
        if (popup && popup.isOpen()) {
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

    // C. Static / Facility / Pin Markers (Diffed and updated by key)
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

    // Initial bounds fit once only when no route is available
    if (!hasFitInitialBoundsRef.current && (!routeCoordinates || routeCoordinates.length === 0) && markers.length > 0) {
      const bounds = L.latLngBounds([]);
      markers.forEach((m) => {
        if (m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng)) {
          bounds.extend(L.latLng(m.lat, m.lng));
        }
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
        hasFitInitialBoundsRef.current = true;
      }
    }
  }, [markers, routeCoordinates, routeColor, mapReady]);

  return <div ref={containerRef} className={`${className} relative z-10`} style={{ width: '100%', height: '100%', minHeight: '100%' }} />;
}
