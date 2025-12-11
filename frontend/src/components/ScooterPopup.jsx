import React, { useState } from 'react';
import { reserveScooter } from '../services/api';

export default function ScooterPopup({ scooter, onClose, onReserved }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reserved, setReserved] = useState(scooter.reserved || false);

  const handleReserve = async () => {
    setLoading(true);
    setError('');

    try {
      // Wygeneruj prosty user ID
      const userId = `user_${Math.random().toString(36).substr(2, 9)}`;
      
      await reserveScooter(scooter.id, userId);
      setReserved(true);
      onReserved?.();
      
      // Automatycznie anuluj rezerwację po 5 minutach
      setTimeout(() => {
        setReserved(false);
      }, 5 * 60 * 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Błąd rezerwacji');
    } finally {
      setLoading(false);
    }
  };

  const getBatteryColor = () => {
    const battery = parseInt(scooter.battery);
    if (battery >= 70) return 'text-green-600';
    if (battery >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="w-72">
      <h3 className="font-bold text-lg mb-3">{scooter.id}</h3>
      
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Model:</span>
          <span className="font-semibold">{scooter.model || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Bateria:</span>
          <span className={`font-semibold ${getBatteryColor()}`}>
            🔋 {scooter.battery}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span className={`font-semibold ${
            reserved ? 'text-red-600' : 'text-green-600'
          }`}>
            {reserved ? '🔴 Zarezerwowana' : '🟢 Dostępna'}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleReserve}
        disabled={loading || reserved}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium 
          hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '⏳ Rezerwowanie...' : reserved ? '✅ Zarezerwowana' : '📍 Zarezerwuj na 5 min'}
      </button>
    </div>
  );
}
