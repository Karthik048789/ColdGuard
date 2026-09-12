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
  const layerGroupRef = useRef<any>(null);
  const truckMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const clickHandlerRef = useRef<any>(null);
  const hasFitBoundsRef = useRef<boolean>(false);
  const lastRouteSigRef = useRef<string>('');
  const lastStaticSigRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      // Fix default icons in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });

      // Initialize map once
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center,
          zoom,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(mapRef.current);

        layerGroupRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const map = mapRef.current;
      const layerGroup = layerGroupRef.current;
      if (!layerGroup) return;

      // Handle map click events
      if (clickHandlerRef.current) {
        map.off('click', clickHandlerRef.current);
      }

      if (onMapClick) {
        clickHandlerRef.current = (e: any) => {
          onMapClick(e.latlng.lat, e.latlng.lng);
        };
        map.on('click', clickHandlerRef.current);
      }

      // Compute route signature & static markers signature
      const routeSig = routeCoordinates && routeCoordinates.length > 0
        ? `${routeCoordinates[0][0]}_${routeCoordinates[0][1]}_${routeCoordinates.length}`
        : '';
      const staticMarkers = markers.filter((m) => m.type !== 'truck');
      const staticSig = staticMarkers.map((m) => `${m.type}_${m.lat.toFixed(4)}_${m.lng.toFixed(4)}`).join('|');

      const truckItem = markers.find((m) => m.type === 'truck');

      // Fast-path: Only truck moved, route & other markers are unchanged
      if (
        routeSig === lastRouteSigRef.current &&
        staticSig === lastStaticSigRef.current &&
        truckMarkerRef.current &&
        truckItem
      ) {
        const newLatLng = L.latLng(truckItem.lat, truckItem.lng);
        truckMarkerRef.current.setLatLng(newLatLng);
        return;
      }

      // Full update required: route or static markers changed
      lastRouteSigRef.current = routeSig;
      lastStaticSigRef.current = staticSig;
      hasFitBoundsRef.current = false;

      // Clear previous layers
      layerGroup.clearLayers();
      truckMarkerRef.current = null;
      polylineRef.current = null;

      const bounds = L.latLngBounds([]);

      // Add all markers
      markers.forEach((m) => {
        if (!m.lat || !m.lng || isNaN(m.lat) || isNaN(m.lng)) return;
        const latLng = L.latLng(m.lat, m.lng);
        bounds.extend(latLng);

        if (m.type === 'truck') {
          const truckDivIcon = L.divIcon({
            className: 'cg-live-truck-marker',
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #dc2626; border: 2.5px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 16px; z-index: 10;">
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
              <b style="color: #0f172a;">${m.title}</b>
              ${m.description ? `<p style="margin: 4px 0 0 0; color: #475569;">${m.description}</p>` : ''}
            </div>
          `);
          layerGroup.addLayer(marker);
          truckMarkerRef.current = marker;
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
        }
      });

      // Add OSRM Road Polyline
      if (routeCoordinates && routeCoordinates.length > 0) {
        const polyline = L.polyline(routeCoordinates, {
          color: routeColor,
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
        });
        layerGroup.addLayer(polyline);
        polylineRef.current = polyline;

        // Only fit bounds on initial load or route change to avoid disrupting user zoom during live tracking
        if (!hasFitBoundsRef.current) {
          map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
          hasFitBoundsRef.current = true;
        }
      } else if (markers.length > 0 && bounds.isValid() && !hasFitBoundsRef.current) {
        map.fitBounds(bounds, { padding: [35, 35] });
        hasFitBoundsRef.current = true;
      }

      // Ensure map tiles properly display on resize
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
    });

    return () => {
      isMounted = false;
    };
  }, [markers, routeCoordinates, routeColor, zoom, center, onMapClick]);

  return <div ref={containerRef} className={className} />;
}
