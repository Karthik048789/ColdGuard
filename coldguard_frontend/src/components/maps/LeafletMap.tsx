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
  const layersRef = useRef<any>(null);
  const clickHandlerRef = useRef<any>(null);

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

        layersRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const map = mapRef.current;
      const layerGroup = layersRef.current;
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

      // Clear previous markers & polylines
      layerGroup.clearLayers();

      const bounds = L.latLngBounds([]);

      // Add markers
      markers.forEach((m) => {
        if (!m.lat || !m.lng || isNaN(m.lat) || isNaN(m.lng)) return;
        const latLng = L.latLng(m.lat, m.lng);
        bounds.extend(latLng);

        let iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
        if (m.type === 'truck') {
          iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
        } else if (m.type === 'facility') {
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

        // Fit to polyline
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
      } else if (markers.length > 0 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [35, 35] });
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
