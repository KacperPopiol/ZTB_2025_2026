import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Map from "../components/Map";
import FilterBar from "../components/FilterBar";
import ActiveRidePanel from "../components/ActiveRidePanel";
import ActiveReservationPanel from "../components/ActiveReservationPanel";
import {
  seedData,
  getScooterStats,
  logout,
  getCurrentUser,
  isAdmin,
  getMyProfile,
} from "../services/api";

export default function Home() {
  const navigate = useNavigate();
  const [minBattery, setMinBattery] = useState(0);
  const [status, setStatus] = useState("available");
  const [model, setModel] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await getMyProfile();
        setUser(response.user);
      } catch (error) {
        const currentUser = getCurrentUser();
        setUser(currentUser);
      }
    };
    loadUser();

    // Załaduj statystyki
    const loadStats = async () => {
      try {
        const statsResponse = await getScooterStats();
        setStats(statsResponse.stats);
      } catch (error) {
        console.error("Błąd ładowania statystyk:", error);
      }
    };
    loadStats();
  }, []);

  // Dla nie-adminów wymuś status="available" i sortBy=""
  useEffect(() => {
    if (!isAdmin()) {
      if (status !== "available") {
        setStatus("available");
      }
      if (sortBy !== "") {
        setSortBy("");
      }
    }
  }, [status, sortBy]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };


  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">🛴 EcoScoot</h1>
            <p className="text-gray-600 text-sm">
              Mapa dostępnych hulajnóg elektrycznych
            </p>
          </div>

          <div className="flex items-center gap-6">
            {user && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">
                    {user.firstName} {user.lastName}
                    {isAdmin() && (
                      <>
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          👑 Admin
                        </span>
                        <button
                          onClick={() => navigate("/admin")}
                          className="ml-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded"
                        >
                          Panel Admina
                        </button>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">{user.email}</p>
                  {user.walletBalance !== undefined && (
                    <p className="text-xs font-semibold text-green-600">
                      💰 {(user.walletBalance || 0).toFixed(2)} zł
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate("/profile")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  👤 Profil
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
                >
                  Wyloguj
                </button>
              </div>
            )}
          </div>

          {stats && isAdmin() && (
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-gray-600">Razem</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.total}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600">Dostępne</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.available}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600">Zarezerwowane</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.reserved}
                </p>
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
          status={status}
          setStatus={setStatus}
          model={model}
          setModel={setModel}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />

        <div className="flex-1 bg-white rounded-lg shadow-md overflow-hidden">
          <Map
            minBattery={minBattery}
            status={status}
            model={model}
            sortBy={sortBy}
          />
        </div>
      </div>

      {/* Active Reservation Panel */}
      <ActiveReservationPanel 
        onRideStarted={() => {
          // Odśwież profil użytkownika po rozpoczęciu jazdy
          getMyProfile().then(response => setUser(response.user)).catch(console.error);
        }}
        onReservationCancelled={() => {
          // Odśwież profil użytkownika po anulowaniu rezerwacji
          getMyProfile().then(response => setUser(response.user)).catch(console.error);
        }}
      />

      {/* Active Ride Panel */}
      <ActiveRidePanel onRideEnded={() => {
        // Odśwież profil użytkownika po zakończeniu jazdy
        getMyProfile().then(response => setUser(response.user)).catch(console.error);
      }} />
    </div>
  );
}
