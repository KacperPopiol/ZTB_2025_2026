import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { getScooters } from "../services/api";
import ScooterPopup from "./ScooterPopup";

// Custom marker icon
const createMarkerIcon = (color) => {
  return L.divIcon({
    className: `scooter-marker ${color}`,
    html: `<span style="font-size: 1.5rem">🛴</span>`,
    iconSize: [40, 40],
  });
};

function MapEventsHandler({ onMapMove, minBattery }) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMapMove(center.lat, center.lng, minBattery);
    },
    zoomend: () => {
      const center = map.getCenter();
      onMapMove(center.lat, center.lng, minBattery);
    },
  });

  return null;
}

function MarkerCluster({
  scooters,
  selectedScooter,
  setSelectedScooter,
  onRefresh,
}) {
  const map = useMap();

  useEffect(() => {
    // Wyczyść poprzednie markery
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Dodaj nowe markery
    scooters.forEach((scooter) => {
      // Użyj współrzędnych z danych hulajnogi
      const lat = parseFloat(scooter.latitude) || 50.0647;
      const lon = parseFloat(scooter.longitude) || 19.945;

      const marker = L.marker([lat, lon], {
        icon: createMarkerIcon(
          scooter.status === "reserved" ? "reserved" : "available",
        ),
      })
        .bindPopup(
          L.popup({ maxWidth: 400 }).setContent(
            document.createElement("div"), // Placeholder
          ),
        )
        .on("click", () => {
          setSelectedScooter(scooter);
        });

      marker.addTo(map);
    });
  }, [scooters, map]);

  return null;
}

export default function Map({ minBattery, onRefresh }) {
  const [scooters, setScooters] = useState([]);
  const [selectedScooter, setSelectedScooter] = useState(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

  // Domyślne współrzędne (Kraków)
  const DEFAULT_LAT = 50.0647;
  const DEFAULT_LON = 19.945;

  const handleMapMove = async (lat, lon, battery) => {
    setLoading(true);
    try {
      const response = await getScooters(lat, lon, 500, battery);
      setScooters(response.scooters || []);
    } catch (error) {
      console.error("Błąd pobierania hulajnóg:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Pobierz hulajnogi przy załadowaniu
    handleMapMove(DEFAULT_LAT, DEFAULT_LON, minBattery);
  }, [minBattery]);

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
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventsHandler onMapMove={handleMapMove} minBattery={minBattery} />
        <MarkerCluster
          scooters={scooters}
          selectedScooter={selectedScooter}
          setSelectedScooter={setSelectedScooter}
          onRefresh={onRefresh}
        />
      </MapContainer>

      {selectedScooter && (
        <div className="absolute bottom-6 left-6 z-">
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
            <button
              onClick={() => setSelectedScooter(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 z-10"
            >
              ✕
            </button>
            <ScooterPopup
              scooter={selectedScooter}
              onClose={() => setSelectedScooter(null)}
              onReserved={() =>
                handleMapMove(DEFAULT_LAT, DEFAULT_LON, minBattery)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
