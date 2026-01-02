import React, { useState, useEffect } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { createReservation, getPricing } from "../services/api";

// Custom marker icon
const createMarkerIcon = (color) => {
  return L.divIcon({
    className: `scooter-marker ${color}`,
    html: `<span style="font-size: 1.5rem">🛴</span>`,
    iconSize: [40, 40],
  });
};

export default function ScooterMarker({ scooter, onReserved }) {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const map = useMap();

  useEffect(() => {
    const loadPrice = async () => {
      try {
        const response = await getPricing();
        setPricing(response.pricing);
      } catch (error) {
        console.error("Błąd ładowania ceny:", error);
      }
    };
    loadPrice();
  }, []);

  const handleReserve = async () => {
    setLoading(true);
    setError("");

    try {
      await createReservation(scooter.scooterId);
      setShowConfirm(false);
      setLoading(false);
      onReserved?.();
      // Zamknij popup po rezerwacji
      setTimeout(() => {
        map.closePopup();
      }, 500);
    } catch (err) {
      setError(err.response?.data?.error || "Błąd rezerwacji");
      setLoading(false);
      // Zamknij popup po błędzie
      setTimeout(() => {
        map.closePopup();
      }, 2000);
    }
  };

  const getBatteryColor = () => {
    const battery = parseInt(scooter.battery);
    if (battery >= 70) return "text-green-600";
    if (battery >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusInfo = () => {
    const status = scooter.status;
    if (status === "reserved") {
      return { color: "reserved", text: "🔴 Zarezerwowana", textColor: "text-red-600", canReserve: false };
    }
    if (status === "maintenance") {
      return { color: "maintenance", text: "🔧 W naprawie", textColor: "text-gray-600", canReserve: false };
    }
    if (status === "in_use") {
      return { color: "in-use", text: "🔵 W użyciu", textColor: "text-blue-600", canReserve: false };
    }
    return { color: "available", text: "🟢 Dostępna", textColor: "text-green-600", canReserve: true };
  };

  const statusInfo = getStatusInfo();
  const isReserved = scooter.status === "reserved";

  return (
    <Marker
      position={[parseFloat(scooter.latitude), parseFloat(scooter.longitude)]}
      icon={createMarkerIcon(statusInfo.color)}
    >
      <Popup maxWidth={300} className="custom-popup">
        <div className="p-2">
          <h3 className="font-bold text-base mb-2">{scooter.model || "Hulajnoga"}</h3>

          <div className="space-y-1 mb-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Bateria:</span>
              <span className={`font-semibold ${getBatteryColor()}`}>
                🔋 {scooter.battery}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold ${statusInfo.textColor}`}>
                {statusInfo.text}
              </span>
            </div>

            {pricing && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rezerwacja:</span>
                  <span className="font-semibold text-green-600">Darmowa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Opłata aktywacyjna:</span>
                  <span className="font-semibold">{(pricing.activationFee || pricing.reservationPrice || 2.0).toFixed(2)} zł</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cena za minutę:</span>
                  <span className="font-semibold text-blue-600">{pricing.ridePerMinute.toFixed(2)} zł</span>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
              {error}
            </div>
          )}

          {!showConfirm && statusInfo.canReserve && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="w-full py-2 px-3 bg-blue-600 text-white rounded-lg font-medium text-sm
                hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📍 Zarezerwuj na 5 min
            </button>
          )}

          {showConfirm && statusInfo.canReserve && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700 mb-2">
                Czy na pewno chcesz zarezerwować tę hulajnogę?
                {pricing && (
                  <span className="block mt-1 text-xs text-gray-600">
                    Rezerwacja jest darmowa. Po rozpoczęciu jazdy zostanie pobrana opłata aktywacyjna {(pricing.activationFee || pricing.reservationPrice || 2.0).toFixed(2)} zł oraz {pricing.ridePerMinute.toFixed(2)} zł za każdą minutę jazdy.
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReserve}
                  disabled={loading}
                  className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-lg font-medium text-sm
                    hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "⏳ Rezerwowanie..." : "✅ Potwierdź"}
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setError("");
                  }}
                  disabled={loading}
                  className="flex-1 py-2 px-3 bg-gray-500 text-white rounded-lg font-medium text-sm
                    hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}

          {!statusInfo.canReserve && (
            <div className="text-center py-2 text-sm text-gray-600">
              {scooter.status === "reserved" && "Ta hulajnoga jest już zarezerwowana"}
              {scooter.status === "maintenance" && "🔧 Ta hulajnoga jest w naprawie i nie jest dostępna"}
              {scooter.status === "in_use" && "🔵 Ta hulajnoga jest obecnie w użyciu"}
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

