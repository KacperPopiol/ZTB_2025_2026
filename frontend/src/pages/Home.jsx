import React, { useState } from 'react';
import Map from '../components/Map';
import FilterBar from '../components/FilterBar';
import { seedData, getStats } from '../services/api';

export default function Home() {
  const [minBattery, setMinBattery] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [mapKey, setMapKey] = useState(0);

  const handleSeed = async () => {
    setLoading(true);
    try {
      await seedData();
      setMapKey((prev) => prev + 1);
      
      // Pobierz statystyki
      const statsResponse = await getStats();
      setStats(statsResponse.data);
      
      alert('✅ Dane załadowane! 50 hulajnóg wygenerowano.');
    } catch (error) {
      alert('❌ Błąd: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">🛴 EcoScoot</h1>
            <p className="text-gray-600 text-sm">Mapa dostępnych hulajnóg elektrycznych</p>
          </div>
          
          {stats && (
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-gray-600">Razem</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total_scooters}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600">Dostępne</p>
                <p className="text-2xl font-bold text-green-600">{stats.available}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600">Zarezerwowane</p>
                <p className="text-2xl font-bold text-red-600">{stats.reserved}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        <FilterBar
          minBattery={minBattery}
          setMinBattery={setMinBattery}
          onSeed={handleSeed}
          loading={loading}
        />

        <div className="flex-1 bg-white rounded-lg shadow-md overflow-hidden">
          <Map key={mapKey} minBattery={minBattery} onRefresh={handleSeed} />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t text-center py-3 text-sm text-gray-600">
        🎯 Przesuń mapę aby zobaczyć hulajnogi w pobliżu | 📍 Kliknij na hulajnogę aby zarezerwować
      </footer>
    </div>
  );
}
