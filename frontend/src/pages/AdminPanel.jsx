import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllScooters,
  createScooter,
  updateScooter,
  deleteScooter,
  getPricing,
  updatePricing,
  logout,
  getSystemStatus,
  toggleRedisStatus,
} from "../services/api";
import LocationPicker from "../components/LocationPicker";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("scooters");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Scooters z infinite scroll
  const [scooters, setScooters] = useState([]);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  
  const [editingScooter, setEditingScooter] = useState(null);
  const [scooterForm, setScooterForm] = useState({
    identifier: "",
    model: "",
    latitude: "",
    longitude: "",
    battery: 100,
    status: "available",
  });
  
  // Paginacja i wyszukiwanie
  const [searchQuery, setSearchQuery] = useState("");

  // Pricing
  const [pricing, setPricing] = useState({
    activationFee: 2.0,
    ridePerMinute: 0.5,
    minimumRidePrice: 5.0,
  });

  // Stan dla Redisa
  const [redisEnabled, setRedisEnabled] = useState(true);

  // Ref dla infinite scroll observer
  const observer = useRef();
  const lastScooterRef = useCallback(
    (node) => {
      if (loadingMore || searchQuery.trim()) return; // Don't observe when searching
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !searchQuery.trim()) {
          loadMoreScooters();
        }
      });

      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore, searchQuery]
  );

  useEffect(() => {
    loadInitialScooters();
    loadPricing();
    loadSystemConfig();
  }, []);

  // Callback dla LocationPicker
  const handleLocationChange = useCallback((lat, lng) => {
    setScooterForm(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }, []);

  // Filtruj hulajnogi na podstawie wyszukiwania
  const filteredScooters = scooters.filter((scooter) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const identifier = (scooter.identifier || '').toLowerCase();
    const model = (scooter.model || '').toLowerCase();
    const status = (scooter.status || '').toLowerCase();
    const battery = scooter.battery?.toString() || '';
    const location = `${scooter.latitude?.toFixed(4) || ''}, ${scooter.longitude?.toFixed(4) || ''}`;
    
    return (
      identifier.includes(query) ||
      model.includes(query) ||
      status.includes(query) ||
      battery.includes(query) ||
      location.includes(query)
    );
  });

  const loadInitialScooters = async () => {
    setLoading(true);
    try {
      const response = await getAllScooters(100, null);
      setScooters(response.scooters || []);
      setLastEvaluatedKey(response.lastEvaluatedKey);
      setHasMore(response.hasMore);
      setTotalLoaded(response.scooters?.length || 0);
    } catch (error) {
      console.error("Błąd ładowania hulajnóg:", error);
      setMessage({ type: "error", text: "Nie udało się załadować hulajnóg" });
    } finally {
      setLoading(false);
    }
  };

  const loadMoreScooters = async () => {
    if (loadingMore || !hasMore || searchQuery.trim()) return; // Don't load more when searching

    setLoadingMore(true);
    try {
      const response = await getAllScooters(100, lastEvaluatedKey);
      
      // Deduplicate scooters by scooterId
      setScooters(prev => {
        const existingIds = new Set(prev.map(s => s.scooterId));
        const newScooters = (response.scooters || []).filter(
          s => !existingIds.has(s.scooterId)
        );
        return [...prev, ...newScooters];
      });
      
      setLastEvaluatedKey(response.lastEvaluatedKey);
      setHasMore(response.hasMore);
      setTotalLoaded(prev => prev + (response.scooters?.length || 0));
    } catch (error) {
      console.error("Błąd ładowania więcej hulajnóg:", error);
      setMessage({ type: "error", text: "Nie udało się załadować więcej hulajnóg" });
    } finally {
      setLoadingMore(false);
    }
  };

  const loadPricing = async () => {
    try {
      const response = await getPricing();
      const loadedPricing = response.pricing || {};
      setPricing({
        activationFee: loadedPricing.activationFee || loadedPricing.reservationPrice || 2.0,
        ridePerMinute: loadedPricing.ridePerMinute || 0.5,
        minimumRidePrice: loadedPricing.minimumRidePrice || 5.0,
      });
    } catch (error) {
      console.error("Błąd ładowania cen:", error);
    }
  };

  const loadSystemConfig = async () => {
    try {
      const response = await getSystemStatus();
      setRedisEnabled(response.redisEnabled);
    } catch (error) {
      console.error("Błąd ładowania konfiguracji:", error);
      setMessage({ type: "error", text: "Nie udało się pobrać statusu systemu" });
    }
  };

  const handleRedisToggle = async () => {
    const newState = !redisEnabled;
    setRedisEnabled(newState);
    
    try {
      await toggleRedisStatus(newState);
      
      setMessage({ 
        type: "success", 
        text: `Redis został ${newState ? 'włączony' : 'wyłączony'}.` 
      });
    } catch (error) {
      setRedisEnabled(!newState);
      setMessage({ 
        type: "error", 
        text: "Nie udało się zmienić statusu Redisa" 
      });
    }
  };

  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await updatePricing({
        activationFee: pricing.activationFee,
        ridePerMinute: pricing.ridePerMinute,
      });
      setMessage({ type: "success", text: "Ceny zaktualizowane!" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd aktualizacji cen",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScooter = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await createScooter({
        identifier: scooterForm.identifier || null,
        model: scooterForm.model,
        latitude: parseFloat(scooterForm.latitude),
        longitude: parseFloat(scooterForm.longitude),
        battery: parseInt(scooterForm.battery),
      });
      setMessage({ type: "success", text: "Hulajnoga utworzona!" });
      setScooterForm({
        identifier: "",
        model: "",
        latitude: "",
        longitude: "",
        battery: 100,
        status: "available",
      });
      loadInitialScooters();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd tworzenia hulajnogi",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditScooter = (scooter) => {
    setEditingScooter(scooter);
    setScooterForm({
      identifier: scooter.identifier,
      model: scooter.model,
      latitude: scooter.latitude,
      longitude: scooter.longitude,
      battery: scooter.battery,
      status: scooter.status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateScooter = async (e) => {
    e.preventDefault();
    if (!editingScooter) return;

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await updateScooter(editingScooter.scooterId, {
        identifier: scooterForm.identifier,
        model: scooterForm.model,
        latitude: parseFloat(scooterForm.latitude),
        longitude: parseFloat(scooterForm.longitude),
        battery: parseInt(scooterForm.battery),
        status: scooterForm.status,
      });
      setMessage({ type: "success", text: "Hulajnoga zaktualizowana!" });
      setEditingScooter(null);
      setScooterForm({
        identifier: "",
        model: "",
        latitude: "",
        longitude: "",
        battery: 100,
        status: "available",
      });
      loadInitialScooters();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd aktualizacji hulajnogi",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScooter = async (scooterId) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę hulajnogę?")) return;

    try {
      await deleteScooter(scooterId);
      setMessage({ type: "success", text: "Hulajnoga usunięta!" });
      loadInitialScooters();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd usuwania hulajnogi",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingScooter(null);
    setScooterForm({
      identifier: "",
      model: "",
      latitude: "",
      longitude: "",
      battery: 100,
      status: "available",
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Panel Administratora</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("scooters")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "scooters"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Hulajnogi
            </button>
            <button
              onClick={() => setActiveTab("pricing")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "pricing"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Cennik
            </button>
            <button
              onClick={() => setActiveTab("system")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "system"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              System
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Messages */}
          {message.text && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-red-100 text-red-800 border border-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          <div>
            {/* Scooters Tab */}
            {activeTab === "scooters" && (
              <div>
                <h2 className="text-2xl font-bold mb-4">
                  {editingScooter ? "Edytuj hulajnogę" : "Dodaj nową hulajnogę"}
                </h2>
                
                <form
                  onSubmit={editingScooter ? handleUpdateScooter : handleCreateScooter}
                  className="space-y-4 max-w-2xl mb-8"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Identyfikator (opcjonalny - zostanie wygenerowany automatycznie)
                    </label>
                    <input
                      type="text"
                      value={scooterForm.identifier}
                      onChange={(e) =>
                        setScooterForm({ ...scooterForm, identifier: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="np. BOLT-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model *
                    </label>
                    <input
                      type="text"
                      value={scooterForm.model}
                      onChange={(e) =>
                        setScooterForm({ ...scooterForm, model: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Szerokość geograficzna *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={scooterForm.latitude}
                        onChange={(e) =>
                          setScooterForm({ ...scooterForm, latitude: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Długość geograficzna *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={scooterForm.longitude}
                        onChange={(e) =>
                          setScooterForm({ ...scooterForm, longitude: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <LocationPicker 
                    onLocationChange={handleLocationChange}
                    initialLat={scooterForm.latitude ? parseFloat(scooterForm.latitude) : undefined}
                    initialLng={scooterForm.longitude ? parseFloat(scooterForm.longitude) : undefined}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Poziom baterii (%) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={scooterForm.battery}
                        onChange={(e) =>
                          setScooterForm({ ...scooterForm, battery: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    {editingScooter && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={scooterForm.status}
                          onChange={(e) =>
                            setScooterForm({ ...scooterForm, status: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="available">Dostępna</option>
                          <option value="reserved">Zarezerwowana</option>
                          <option value="in_use">W użyciu</option>
                          <option value="maintenance">W naprawie</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {loading
                        ? "Zapisywanie..."
                        : editingScooter
                          ? "Zaktualizuj"
                          : "Utwórz"}
                    </button>
                    {editingScooter && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition"
                      >
                        Anuluj
                      </button>
                    )}
                  </div>
                </form>

                {/* Lista hulajnóg z infinite scroll */}
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Lista hulajnóg</h3>
                    <div className="text-sm text-gray-600">
                      {searchQuery ? (
                        <>
                          Znaleziono: <span className="font-bold">{filteredScooters.length.toLocaleString()}</span> hulajnóg
                          <span className="text-xs ml-2">(wyszukiwanie w {totalLoaded.toLocaleString()} załadowanych)</span>
                        </>
                      ) : (
                        <>
                          Załadowano: <span className="font-bold">{totalLoaded.toLocaleString()}</span> hulajnóg
                          {hasMore && !searchQuery && " (przewiń w dół, aby załadować więcej)"}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Wyszukiwanie */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Szukaj po identyfikatorze, modelu, statusie, baterii lub lokalizacji..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Identyfikator
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Model
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Lokalizacja
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bateria
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Akcje
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {loading && scooters.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                              Ładowanie hulajnóg...
                            </td>
                          </tr>
                        ) : filteredScooters.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                              {searchQuery ? "Nie znaleziono hulajnóg pasujących do wyszukiwania" : "Brak hulajnóg"}
                            </td>
                          </tr>
                        ) : (
                          filteredScooters.map((scooter, index) => {
                            const isLast = index === filteredScooters.length - 1;
                            
                            return (
                              <tr 
                                key={scooter.scooterId}
                                ref={isLast && !searchQuery ? lastScooterRef : null}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {scooter.identifier}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {scooter.model}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {scooter.latitude?.toFixed(4)}, {scooter.longitude?.toFixed(4)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      scooter.battery >= 80
                                        ? "bg-green-100 text-green-800"
                                        : scooter.battery >= 50
                                          ? "bg-yellow-100 text-yellow-800"
                                          : scooter.battery >= 20
                                            ? "bg-orange-100 text-orange-800"
                                            : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {scooter.battery}%
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      scooter.status === "available"
                                        ? "bg-green-100 text-green-800"
                                        : scooter.status === "reserved"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : scooter.status === "in_use"
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {scooter.status === "available"
                                      ? "Dostępna"
                                      : scooter.status === "reserved"
                                        ? "Zarezerwowana"
                                        : scooter.status === "in_use"
                                          ? "W użyciu"
                                          : "W naprawie"}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button
                                    onClick={() => handleEditScooter(scooter)}
                                    className="text-blue-600 hover:text-blue-900 mr-4"
                                  >
                                    Edytuj
                                  </button>
                                  <button
                                    onClick={() => handleDeleteScooter(scooter.scooterId)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Usuń
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Loading indicator dla infinite scroll */}
                  {loadingMore && (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                      <p className="mt-2 text-gray-600">Ładowanie kolejnych hulajnóg...</p>
                    </div>
                  )}

                  {/* Koniec listy */}
                  {!hasMore && totalLoaded > 0 && (
                    <div className="text-center py-8 text-gray-600">
                      Koniec listy - załadowano wszystkie {totalLoaded.toLocaleString()} hulajnóg
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing Tab */}
            {activeTab === "pricing" && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Zarządzanie cenami</h2>
                <form onSubmit={handleUpdatePricing} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Opłata aktywacyjna (zł)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Opłata pobierana przy rozpoczęciu jazdy
                    </p>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricing.activationFee}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          activationFee: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cena za minutę jazdy (zł)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricing.ridePerMinute}
                      onChange={(e) =>
                        setPricing({
                          ...pricing,
                          ridePerMinute: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? "Zapisywanie..." : "Zapisz ceny"}
                  </button>
                </form>
              </div>
            )}

            {/* System Tab */}
            {activeTab === "system" && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Konfiguracja Systemu</h2>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Status Redis Cache</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Włącz lub wyłącz obsługę bazy Redis. Wyłączenie może spowolnić działanie aplikacji.
                      </p>
                      <div className="mt-2 text-xs">
                        Status połączenia: 
                        <span className={`ml-2 font-bold ${redisEnabled ? 'text-green-600' : 'text-red-600'}`}>
                          {redisEnabled ? 'AKTYWNY' : 'NIEAKTYWNY'}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleRedisToggle}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        redisEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className="sr-only">Włącz Redis</span>
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                          redisEnabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}