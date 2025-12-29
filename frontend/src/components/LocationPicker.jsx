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

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
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
      setPosition(newPosition);
    } else {
      setPosition(null);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (position && onLocationChange) {
      onLocationChange(position[0], position[1]);
    }
  }, [position, onLocationChange]);

  const defaultCenter = position || [50.0647, 19.945]; // Kraków jako domyślne

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
        <LocationMarker position={position} setPosition={setPosition} />
      </MapContainer>
      <div className="bg-blue-50 border-t border-blue-200 p-2 text-sm text-blue-700">
        📍 Kliknij na mapę, aby ustawić lokalizację
      </div>
    </div>
  );
}

