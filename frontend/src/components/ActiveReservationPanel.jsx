import React, { useState, useEffect } from "react";
import { getMyReservation, startRide, cancelReservation, getPricing } from "../services/api";

export default function ActiveReservationPanel({ onRideStarted, onReservationCancelled }) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    loadReservation();
    loadPricing();
    
    // Odświeżaj co sekundę
    const interval = setInterval(() => {
      loadReservation();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadReservation = async () => {
    try {
      const response = await getMyReservation();
      if (response.reservation) {
        setReservation(response.reservation);
      } else {
        setReservation(null);
      }
    } catch (error) {
      console.error("Błąd ładowania rezerwacji:", error);
      setReservation(null);
    }
  };

  const loadPricing = async () => {
    try {
      const response = await getPricing();
      setPricing(response.pricing);
    } catch (error) {
      console.error("Błąd ładowania cen:", error);
    }
  };

  const calculateTimeLeft = () => {
    if (!reservation || !reservation.expiresAt) return;
    
    const expiresAt = new Date(reservation.expiresAt);
    const now = new Date();
    const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
    setTimeLeft(diff);
  };

  useEffect(() => {
    if (reservation) {
      calculateTimeLeft();
      // Odświeżaj czas co sekundę
      const timeInterval = setInterval(() => {
        calculateTimeLeft();
      }, 1000);
      return () => clearInterval(timeInterval);
    }
  }, [reservation]);

  const handleStartRide = async () => {
    if (!window.confirm("Czy na pewno chcesz rozpocząć jazdę? Opłata będzie pobierana za każdą rozpoczętą minutę.")) {
      return;
    }

    setLoading(true);
    try {
      await startRide(reservation.reservationId);
      setReservation(null);
      onRideStarted?.();
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Błąd rozpoczynania jazdy";
      if (errorMessage.includes("Niewystarczające środki")) {
        alert(`❌ ${errorMessage}\n\nDoładuj portfel w profilu, aby rozpocząć jazdę.`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!window.confirm("Czy na pewno chcesz anulować rezerwację?")) {
      return;
    }

    setCancelling(true);
    try {
      await cancelReservation(reservation.reservationId);
      setReservation(null);
      onReservationCancelled?.();
    } catch (error) {
      alert(error.response?.data?.error || "Błąd anulowania rezerwacji");
    } finally {
      setCancelling(false);
    }
  };

  if (!reservation) {
    return null;
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-lg shadow-2xl border-2 border-yellow-500 p-6 max-w-md w-full mx-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-yellow-600">⏰ Aktywna rezerwacja</h3>
        <div className="text-right">
          <div className="text-sm text-gray-600">Pozostało:</div>
          <div className="text-2xl font-bold text-yellow-600">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {pricing && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Rezerwacja:</span>
              <span className="font-semibold text-green-600">Darmowa</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Opłata aktywacyjna:</span>
              <span className="font-semibold">{(pricing.activationFee || pricing.reservationPrice || 2.0).toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cena za minutę jazdy:</span>
              <span className="font-semibold text-blue-600">{pricing.ridePerMinute.toFixed(2)} zł</span>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleStartRide}
          disabled={loading || cancelling || timeLeft === 0}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "⏳ Rozpoczynanie..." : "🚴 Rozpocznij jazdę"}
        </button>
        <button
          onClick={handleCancelReservation}
          disabled={loading || cancelling}
          className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelling ? "⏳..." : "❌"}
        </button>
      </div>

      {pricing && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Po rozpoczęciu zostanie pobrana opłata aktywacyjna {(pricing.activationFee || pricing.reservationPrice || 2.0).toFixed(2)} zł
        </div>
      )}

      {timeLeft === 0 && (
        <div className="mt-2 text-sm text-red-600 text-center">
          Rezerwacja wygasła
        </div>
      )}
    </div>
  );
}

