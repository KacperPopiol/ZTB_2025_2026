import React from 'react';

export default function FilterBar({ 
  minBattery, 
  setMinBattery, 
  onSeed, 
  loading 
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 flex gap-4 items-end flex-wrap">
      <div className="flex-1 min-w-[200px]">
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

      <button
        onClick={onSeed}
        disabled={loading}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium 
          hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '⏳ Ładowanie...' : '🔄 Wczytaj dane'}
      </button>
    </div>
  );
}
