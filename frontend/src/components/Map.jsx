import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { getScooters } from "../services/api";
import ScooterMarker from "./ScooterMarker";

function MapEventsHandler({ onMapMove, minBattery, status, model, sortBy }) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMapMove(center.lat, center.lng, minBattery, status, model, sortBy);
    },
    zoomend: () => {
      const center = map.getCenter();
      onMapMove(center.lat, center.lng, minBattery, status, model, sortBy);
    },
  });

  return null;
}

export default function Map({ minBattery, status, model, sortBy }) {
  const [scooters, setScooters] = useState([]);
  const [loading, setLoading] = useState(false);

  // Domyślne współrzędne (Kraków)
  const DEFAULT_LAT = 50.0647;
  const DEFAULT_LON = 19.945;

  const handleMapMove = async (lat, lon, battery, statusFilter, modelFilter, sortByFilter) => {
    setLoading(true);
    try {
      const response = await getScooters(
        lat,
        lon,
        500,
        battery,
        statusFilter || status,
        modelFilter || model || null,
        sortByFilter || sortBy || null
      );
      setScooters(response.scooters || []);
    } catch (error) {
      console.error("Błąd pobierania hulajnóg:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Pobierz hulajnogi przy załadowaniu lub zmianie filtrów
    handleMapMove(DEFAULT_LAT, DEFAULT_LON, minBattery, status, model || "", sortBy || "");
  }, [minBattery, status, model, sortBy]);

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute top-4 left-4 z- bg-white px-4 py-2 rounded-lg shadow-md">
          ⏳ Aktualizowanie mapy...
        </div>
      )}

      <MapContainer
        center={[DEFAULT_LAT, DEFAULT_LON]}
        zoom={14}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventsHandler
          onMapMove={handleMapMove}
          minBattery={minBattery}
          status={status}
          model={model}
          sortBy={sortBy}
        />
        {scooters.map((scooter) => (
          <ScooterMarker
            key={scooter.scooterId}
            scooter={scooter}
            onReserved={() =>
              handleMapMove(DEFAULT_LAT, DEFAULT_LON, minBattery, status, model || "", sortBy || "")
            }
          />
        ))}
      </MapContainer>
    </div>
  );
}
