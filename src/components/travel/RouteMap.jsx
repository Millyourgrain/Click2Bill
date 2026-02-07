
import { useEffect, useRef } from "react";

function RouteMap({ result }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Only initialize map if we have valid result data
    if (!result || !result.origin || !result.destination || !mapRef.current) {
      return;
    }

    // Check if coordinates are valid
    if (!result.origin.lat || !result.origin.lon || !result.destination.lat || !result.destination.lon) {
      console.error('Invalid coordinates:', result);
      return;
    }

    // Clean up existing map instance before creating new one
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const L = window.L;
    
    // Initialize new map
    mapInstanceRef.current = L.map(mapRef.current).setView(
      [result.origin.lat, result.origin.lon],
      10
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    const map = mapInstanceRef.current;

    // Add origin marker (green)
    const originMarker = L.marker([result.origin.lat, result.origin.lon], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map);
    originMarker.bindPopup('<b>Origin</b>').openPopup();

    // Add destination marker (red)
    const destMarker = L.marker([result.destination.lat, result.destination.lon], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map);
    destMarker.bindPopup('<b>Destination</b>');

    // Draw route line
    if (result.routeGeometry && result.routeGeometry.coordinates) {
      const coordinates = result.routeGeometry.coordinates;
      
      // Convert [lon, lat] to [lat, lon] for Leaflet
      let latLngs;
      if (result.routeGeometry.type === 'LineString') {
        latLngs = coordinates.map(coord => [coord[1], coord[0]]);
      } else if (result.routeGeometry.type === 'MultiLineString') {
        latLngs = coordinates.flatMap(line => 
          line.map(coord => [coord[1], coord[0]])
        );
      }

      if (latLngs && latLngs.length > 0) {
        const routeLine = L.polyline(latLngs, {
          color: '#2196F3',
          weight: 5,
          opacity: 0.7,
        }).addTo(map);

        // Fit map to show entire route
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
      }
    }

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [result]);

  // Don't render map container until we have valid data
  if (!result || !result.origin || !result.destination) {
    return null;
  }

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '400px',
        borderRadius: '8px',
        marginTop: '1rem',
        border: '1px solid #ddd',
      }}
    />
  );
}

export default RouteMap;
