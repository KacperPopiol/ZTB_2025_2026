import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { getScootersInBounds } from "../services/api";
import ScooterMarker from "./ScooterMarker";

// Progi zoomu dla ilości ładowanych hulajnóg
const ZOOM_THRESHOLDS = {
  SHOW_100: 12,          // < zoom 12: 100 hulajnóg
  SHOW_300: 13,          // zoom 12-13: 300 hulajnóg
  SHOW_1000: 14,         // zoom 13-14: 1000 hulajnóg
  SHOW_3000: 15,         // zoom 14-15: 3000 hulajnóg
  SHOW_ALL_IN_VIEW: 16  // > zoom 15: wszystkie w widoku (max 5000)
};

function MapEventsHandler({ 
  onMapMove, 
  onZoomChange, 
  minBattery, 
  status, 
  model, 
  sortBy 
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      
      onZoomChange(zoom);
      onMapMove(
        center.lat, 
        center.lng, 
        zoom,
        bounds,
        minBattery, 
        status, 
        model, 
        sortBy
      );
    },
    zoomend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      
      onZoomChange(zoom);
      onMapMove(
        center.lat, 
        center.lng, 
        zoom,
        bounds,
        minBattery, 
        status, 
        model, 
        sortBy
      );
    },
  });

  return null;
}

export default function Map({ minBattery, status, model, sortBy }) {
  const [scooters, setScooters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(14);
  const [scooterCount, setScooterCount] = useState(0);

  // Domyślne współrzędne (Nowy Sącz)
  const DEFAULT_LAT = 49.6215;
  const DEFAULT_LON = 20.6969;

  const lastRequestRef = useRef(null);

  const getLimitForZoom = (currentZoom) => {
    if (currentZoom < ZOOM_THRESHOLDS.SHOW_100) {
      return 100;
    } else if (currentZoom < ZOOM_THRESHOLDS.SHOW_300) {
      return 300;
    } else if (currentZoom < ZOOM_THRESHOLDS.SHOW_1000) {
      return 1000;
    } else if (currentZoom < ZOOM_THRESHOLDS.SHOW_3000) {
      return 3000;
    } else {
      return 5000;
    }
  };

  const handleMapMove = async (
    lat, 
    lon, 
    currentZoom, 
    bounds, 
    battery, 
    statusFilter, 
    modelFilter, 
    sortByFilter
  ) => {
    // Anuluj poprzednie żądanie jeśli jeszcze trwa
    if (lastRequestRef.current) {
      lastRequestRef.current.cancel = true;
    }

    const requestId = Date.now();
    lastRequestRef.current = { id: requestId, cancel: false };

    setLoading(true);
    
    try {
      const limit = getLimitForZoom(currentZoom);
      
      // Przygotuj bounds dla API
      const boundsData = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };

      const response = await getScootersInBounds(
        boundsData,
        limit,
        statusFilter || status
      );

      // Sprawdź czy to żądanie nie zostało anulowane
      if (lastRequestRef.current?.id !== requestId || lastRequestRef.current?.cancel) {
        return;
      }

      let filteredScooters = response.scooters || [];

      // Dodatkowe filtrowanie po baterii i modelu (client-side)
      if (battery > 0) {
        filteredScooters = filteredScooters.filter(s => s.battery >= battery);
      }
      
      if (modelFilter) {
        filteredScooters = filteredScooters.filter(s => s.model === modelFilter);
      }

      // Sortowanie (jeśli potrzebne)
      if (sortByFilter === 'battery') {
        filteredScooters.sort((a, b) => b.battery - a.battery);
      } else if (sortByFilter === 'distance') {
        // Sortuj po odległości od centrum mapy
        filteredScooters.sort((a, b) => {
          const distA = Math.sqrt(
            Math.pow(a.latitude - lat, 2) + Math.pow(a.longitude - lon, 2)
          );
          const distB = Math.sqrt(
            Math.pow(b.latitude - lat, 2) + Math.pow(b.longitude - lon, 2)
          );
          return distA - distB;
        });
      }

      setScooters(filteredScooters);
      setScooterCount(filteredScooters.length);
    } catch (error) {
      if (lastRequestRef.current?.cancel) {
        return;
      }
      console.error("Błąd pobierania hulajnóg:", error);
    } finally {
      if (lastRequestRef.current?.id === requestId && !lastRequestRef.current?.cancel) {
        setLoading(false);
      }
    }
  };

  const handleZoomChange = (newZoom) => {
    setZoom(newZoom);
  };

  useEffect(() => {
    // Początkowe załadowanie - używamy placeholder bounds
    const initialBounds = {
      north: DEFAULT_LAT + 0.05,
      south: DEFAULT_LAT - 0.05,
      east: DEFAULT_LON + 0.05,
      west: DEFAULT_LON - 0.05,
    };
    
    handleMapMove(
      DEFAULT_LAT, 
      DEFAULT_LON, 
      14, 
      { 
        getNorth: () => initialBounds.north,
        getSouth: () => initialBounds.south,
        getEast: () => initialBounds.east,
        getWest: () => initialBounds.west,
      },
      minBattery, 
      status, 
      model || "", 
      sortBy || ""
    );
  }, [minBattery, status, model, sortBy]);

  const getZoomInfo = () => {
    if (zoom < ZOOM_THRESHOLDS.SHOW_100) {
      return "Przybliż mapę, aby zobaczyć więcej hulajnóg";
    } else if (zoom < ZOOM_THRESHOLDS.SHOW_300) {
      return "Widok ogólny - pokazuję do 300 hulajnóg";
    } else if (zoom < ZOOM_THRESHOLDS.SHOW_1000) {
      return "Widok średni - pokazuję do 1000 hulajnóg";
    } else if (zoom < ZOOM_THRESHOLDS.SHOW_3000) {
      return "Widok szczegółowy - pokazuję do 3000 hulajnóg";
    } else {
      return "Maksymalna szczegółowość - pokazuję wszystkie hulajnogi w tym obszarze";
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Informacja o ładowaniu */}
      {loading && (
        <div className="absolute top-4 left-4 z-[1000] bg-white px-4 py-2 rounded-lg shadow-md">
          ⏳ Aktualizowanie mapy...
        </div>
      )}

      {/* Panel informacyjny */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-md min-w-[250px]">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Zoom:</span>
            <span className="text-sm font-bold text-blue-600">{zoom}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Hulajnogi:</span>
            <span className="text-sm font-bold text-green-600">
              {scooterCount.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
            {getZoomInfo()}
          </div>
        </div>
      </div>

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
          onZoomChange={handleZoomChange}
          minBattery={minBattery}
          status={status}
          model={model}
          sortBy={sortBy}
        />

        {/* Bezpośrednie markery (bez clusteringu) */}
        {scooters.map((scooter) => (
          <ScooterMarker
            key={scooter.scooterId}
            scooter={scooter}
            onReserved={() => {
              window.location.reload();
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}