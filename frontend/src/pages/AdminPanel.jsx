import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllScooters,
  createScooter,
  updateScooter,
  deleteScooter,
  getPricing,
  updatePricing,
  logout,
} from "../services/api";
import LocationPicker from "../components/LocationPicker";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("scooters");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Scooters
  const [scooters, setScooters] = useState([]);
  const [editingScooter, setEditingScooter] = useState(null);
  const [scooterForm, setScooterForm] = useState({
    model: "",
    latitude: "",
    longitude: "",
    battery: 100,
    status: "available",
  });

  // Pricing
  const [pricing, setPricing] = useState({
    activationFee: 2.0,
    ridePerMinute: 0.5,
    minimumRidePrice: 5.0,
  });

  useEffect(() => {
    loadScooters();
    loadPricing();
  }, []);

  const loadScooters = async () => {
    try {
      const response = await getAllScooters(100);
      setScooters(response.scooters || []);
    } catch (error) {
      console.error("Błąd ładowania hulajnóg:", error);
      setMessage({ type: "error", text: "Nie udało się załadować hulajnóg" });
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

  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Wyślij activationFee zamiast reservationPrice
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
        model: scooterForm.model,
        latitude: parseFloat(scooterForm.latitude),
        longitude: parseFloat(scooterForm.longitude),
        battery: parseInt(scooterForm.battery),
      });
      setMessage({ type: "success", text: "Hulajnoga utworzona!" });
      setScooterForm({
        model: "",
        latitude: "",
        longitude: "",
        battery: 100,
        status: "available",
      });
      loadScooters();
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
      model: scooter.model,
      latitude: scooter.latitude.toString(),
      longitude: scooter.longitude.toString(),
      battery: scooter.battery,
      status: scooter.status,
    });
  };

  const handleUpdateScooter = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await updateScooter(editingScooter.scooterId, {
        model: scooterForm.model,
        latitude: parseFloat(scooterForm.latitude),
        longitude: parseFloat(scooterForm.longitude),
        battery: parseInt(scooterForm.battery),
        status: scooterForm.status,
      });
      setMessage({ type: "success", text: "Hulajnoga zaktualizowana!" });
      setEditingScooter(null);
      setScooterForm({
        model: "",
        latitude: "",
        longitude: "",
        battery: 100,
        status: "available",
      });
      loadScooters();
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
    if (!window.confirm("Czy na pewno chcesz usunąć tę hulajnogę?")) {
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await deleteScooter(scooterId);
      setMessage({ type: "success", text: "Hulajnoga usunięta!" });
      loadScooters();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd usuwania hulajnogi",
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingScooter(null);
    setScooterForm({
      model: "",
      latitude: "",
      longitude: "",
      battery: 100,
      status: "available",
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">🛴 EcoScoot</h1>
            <p className="text-gray-600 text-sm">Panel administratora</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              🗺️ Mapa
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition"
            >
              👤 Profil
            </button>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Message */}
        {message.text && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-100 text-green-700 border border-green-400"
                : "bg-red-100 text-red-700 border border-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("scooters")}
              className={`px-6 py-3 font-medium ${
                activeTab === "scooters"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Hulajnogi
            </button>
            <button
              onClick={() => setActiveTab("pricing")}
              className={`px-6 py-3 font-medium ${
                activeTab === "pricing"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Ceny
            </button>
          </div>

          <div className="p-6">
            {/* Scooters Tab */}
            {activeTab === "scooters" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">
                    {editingScooter ? "Edytuj hulajnogę" : "Dodaj hulajnogę"}
                  </h2>
                  <form
                    onSubmit={editingScooter ? handleUpdateScooter : handleCreateScooter}
                    className="space-y-4 max-w-md"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Model
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lokalizacja (kliknij na mapie lub wpisz ręcznie)
                      </label>
                      <LocationPicker
                        latitude={scooterForm.latitude}
                        longitude={scooterForm.longitude}
                        onLocationChange={(lat, lng) => {
                          setScooterForm({
                            ...scooterForm,
                            latitude: lat.toFixed(6),
                            longitude: lng.toFixed(6),
                          });
                        }}
                        height="250px"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Szerokość geograficzna
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
                          Długość geograficzna
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bateria (%)
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
                            ? "Zapisz zmiany"
                            : "Dodaj hulajnogę"}
                      </button>
                      {editingScooter && (
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-6 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition"
                        >
                          Anuluj
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="border-t pt-6">
                  <h2 className="text-2xl font-bold mb-4">
                    Lista hulajnóg ({scooters.length})
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
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
                        {scooters.map((scooter) => (
                          <tr key={scooter.scooterId}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {scooter.model}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {scooter.latitude?.toFixed(4)}, {scooter.longitude?.toFixed(4)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {scooter.battery}%
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
                        ))}
                      </tbody>
                    </table>
                  </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}

