import React, { useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents, Marker } from "react-leaflet";
import L from "leaflet";

// Fix dla ikon Leaflet w React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function LocationMarker({ position, setPosition, onLocationChange }) {
  useMapEvents({
    click(e) {
      const newPosition = [e.latlng.lat, e.latlng.lng];
      setPosition(newPosition);
      // Wywołaj callback tylko gdy użytkownik kliknie, nie w useEffect
      if (onLocationChange) {
        onLocationChange(newPosition[0], newPosition[1]);
      }
    },
  });

  return position === null ? null : <Marker position={position} />;
}

export default function LocationPicker({ latitude, longitude, onLocationChange, height = "300px" }) {
  const [position, setPosition] = React.useState(
    latitude && longitude ? [parseFloat(latitude), parseFloat(longitude)] : null
  );

  useEffect(() => {
    if (latitude && longitude) {
      const newPosition = [parseFloat(latitude), parseFloat(longitude)];
      // Aktualizuj pozycję tylko jeśli się zmieniła (aby uniknąć niepotrzebnych aktualizacji)
      setPosition(prev => {
        if (!prev || prev[0] !== newPosition[0] || prev[1] !== newPosition[1]) {
          return newPosition;
        }
        return prev;
      });
    } else {
      setPosition(null);
    }
  }, [latitude, longitude]);

  const defaultCenter = position || [49.6215, 20.6969]; // Nowy Sącz jako domyślne

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={setPosition} onLocationChange={onLocationChange} />
      </MapContainer>
      <div className="bg-blue-50 border-t border-blue-200 p-2 text-sm text-blue-700">
        📍 Kliknij na mapę, aby ustawić lokalizację
      </div>
    </div>
  );
}

