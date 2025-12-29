import React, { useState, useEffect } from "react";
import { createReservation, cancelReservation, getPricing } from "../services/api";

export default function ScooterPopup({ scooter, onClose, onReserved }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reserved, setReserved] = useState(scooter.reserved || false);
  const [pricing, setPricing] = useState(null);

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
      setReserved(true);
      onReserved?.();

      // Automatycznie odśwież po 5 minutach
      setTimeout(
        () => {
          setReserved(false);
        },
        5 * 60 * 1000,
      );
    } catch (err) {
      setError(err.response?.data?.error || "Błąd rezerwacji");
    } finally {
      setLoading(false);
    }
  };

  const getBatteryColor = () => {
    const battery = parseInt(scooter.battery);
    if (battery >= 70) return "text-green-600";
    if (battery >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  if (!scooter) {
    return (
      <div className="w-72 p-4">
        <p className="text-gray-600">Ładowanie danych...</p>
      </div>
    );
  }

  return (
    <div className="w-72 p-4">
      <h3 className="font-bold text-lg mb-3">{scooter.model || "Hulajnoga"}</h3>

      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Model:</span>
          <span className="font-semibold">{scooter.model || "N/A"}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Bateria:</span>
          <span className={`font-semibold ${getBatteryColor()}`}>
            🔋 {scooter.battery}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span
            className={`font-semibold ${
              reserved || scooter.status === "reserved"
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {reserved || scooter.status === "reserved"
              ? "🔴 Zarezerwowana"
              : "🟢 Dostępna"}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {pricing && (
        <div className="mb-3 space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Rezerwacja:</span>
            <span className="font-semibold text-green-600">Darmowa</span>
          </div>
          <div className="flex justify-between">
            <span>Opłata aktywacyjna:</span>
            <span className="font-semibold">{(pricing.activationFee || pricing.reservationPrice || 2.0).toFixed(2)} zł</span>
          </div>
          <div className="flex justify-between">
            <span>Cena za minutę jazdy:</span>
            <span className="font-semibold text-blue-600">{pricing.ridePerMinute.toFixed(2)} zł</span>
          </div>
        </div>
      )}

      <button
        onClick={handleReserve}
        disabled={loading || reserved || scooter.status === "reserved"}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium
          hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "⏳ Rezerwowanie..."
          : reserved
            ? "✅ Zarezerwowana"
            : "📍 Zarezerwuj na 5 min"}
      </button>
    </div>
  );
}
