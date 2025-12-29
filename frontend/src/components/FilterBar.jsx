import React, { useState, useEffect } from 'react';
import { getScooterModels } from '../services/api';
import { isAdmin } from '../services/api';

export default function FilterBar({ 
  minBattery, 
  setMinBattery,
  status,
  setStatus,
  model,
  setModel,
  sortBy,
  setSortBy,
}) {
  const [models, setModels] = useState([]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await getScooterModels();
        setModels(response.models || []);
      } catch (error) {
        console.error('Błąd ładowania modeli:', error);
      }
    };
    loadModels();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimalna bateria
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minBattery}
              onChange={(e) => setMinBattery(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-300 rounded-lg cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-700 min-w-[40px]">
              {minBattery}%
            </span>
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="available">Dostępne</option>
            {isAdmin() && (
              <>
                <option value="reserved">Zarezerwowane</option>
                <option value="in_use">W użyciu</option>
                <option value="maintenance">W naprawie</option>
                <option value="">Wszystkie</option>
              </>
            )}
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Wszystkie</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sortuj po
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Domyślnie</option>
            <option value="battery">Bateria (↓)</option>
            <option value="battery-asc">Bateria (↑)</option>
            <option value="model">Model (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
