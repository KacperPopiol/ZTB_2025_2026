import React, { useState, useEffect } from "react";
import { getMyRide, endRide, getPricing } from "../services/api";

export default function ActiveRidePanel({ onRideEnded }) {
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [duration, setDuration] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    loadRide();
    loadPricing();
    
    // Odświeżaj co 5 sekund
    const interval = setInterval(() => {
      loadRide();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (ride && pricing) {
      // Oblicz czas trwania jazdy
      const startTime = new Date(ride.startedAt);
      const now = new Date();
      const diffMs = now - startTime;
      const diffMinutes = Math.ceil(diffMs / (1000 * 60));
      setDuration(diffMinutes);

      // Oblicz szacowany koszt (już pobrane + pozostałe minuty)
      const alreadyCharged = ride.totalCharged || 0;
      const remainingMinutes = diffMinutes - (ride.lastChargedMinutes || 0);
      const remainingCost = remainingMinutes * pricing.ridePerMinute;
      setEstimatedCost(alreadyCharged + remainingCost);
    }
  }, [ride, pricing]);

  const loadRide = async () => {
    try {
      const response = await getMyRide();
      if (response.ride) {
        setRide(response.ride);
      } else {
        setRide(null);
      }
    } catch (error) {
      console.error("Błąd ładowania jazdy:", error);
      setRide(null);
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

  const handleEndRide = async () => {
    if (!window.confirm("Czy na pewno chcesz zakończyć jazdę?")) {
      return;
    }

    setLoading(true);
    try {
      await endRide(ride.rideId);
      setRide(null);
      onRideEnded?.();
    } catch (error) {
      alert(error.response?.data?.error || "Błąd zakończenia jazdy");
    } finally {
      setLoading(false);
    }
  };

  if (!ride) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-6 max-w-md w-full mx-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-blue-600">🚴 Aktywna jazda</h3>
        <button
          onClick={handleEndRide}
          disabled={loading}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition disabled:opacity-50"
        >
          {loading ? "Zakończanie..." : "Zakończ jazdę"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Czas jazdy:</span>
          <span className="font-semibold text-lg">{duration} min</span>
        </div>

        {pricing && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Opłata aktywacyjna:</span>
              <span className="font-semibold">{(ride.activationFee || pricing.activationFee || pricing.reservationPrice || 2.0).toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cena za minutę:</span>
              <span className="font-semibold">{pricing.ridePerMinute.toFixed(2)} zł</span>
            </div>
          </>
        )}

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Już pobrano:</span>
          <span className="font-semibold text-green-600">
            {(ride.totalCharged || 0).toFixed(2)} zł
          </span>
        </div>

        <div className="flex justify-between items-center border-t pt-2">
          <span className="text-gray-800 font-semibold">Szacowany koszt:</span>
          <span className="font-bold text-xl text-blue-600">
            {estimatedCost.toFixed(2)} zł
          </span>
        </div>

        <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
          💡 Opłata jest pobierana automatycznie co minutę. Jazda zakończy się automatycznie, gdy skończą się środki.
        </div>
      </div>
    </div>
  );
}

