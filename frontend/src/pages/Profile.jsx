import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getReservationHistory,
  topUpWallet,
  logout,
  getCurrentUser,
} from "../services/api";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [activeTab, setActiveTab] = useState("profile");

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    loadProfile();
    loadReservations();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await getMyProfile();
      setUser(response.user);
      setFirstName(response.user.firstName || "");
      setLastName(response.user.lastName || "");
    } catch (error) {
      console.error("Błąd ładowania profilu:", error);
      setMessage({ type: "error", text: "Nie udało się załadować profilu" });
    }
  };

  const loadReservations = async () => {
    try {
      const response = await getReservationHistory(20);
      setReservations(response.reservations || []);
    } catch (error) {
      console.error("Błąd ładowania rezerwacji:", error);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await updateMyProfile({ firstName, lastName });
      setUser(response.user);
      setMessage({ type: "success", text: "Profil zaktualizowany!" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd aktualizacji profilu",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Hasła nie są identyczne" });
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Hasło musi mieć co najmniej 6 znaków" });
      setLoading(false);
      return;
    }

    try {
      await changePassword(oldPassword, newPassword);
      setMessage({ type: "success", text: "Hasło zostało zmienione!" });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd zmiany hasła",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async (amount) => {
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await topUpWallet(amount);
      setUser((prev) => ({ ...prev, walletBalance: response.walletBalance }));
      setMessage({ type: "success", text: `Doładowano portfel o ${amount} zł!` });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Błąd doładowania portfela",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">🛴 EcoScoot</h1>
            <p className="text-gray-600 text-sm">Panel użytkownika</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              🗺️ Mapa
            </button>
            <button
              onClick={handleLogout}
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
              onClick={() => setActiveTab("profile")}
              className={`px-6 py-3 font-medium ${
                activeTab === "profile"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Profil
            </button>
            <button
              onClick={() => setActiveTab("wallet")}
              className={`px-6 py-3 font-medium ${
                activeTab === "wallet"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Portfel
            </button>
            <button
              onClick={() => setActiveTab("reservations")}
              className={`px-6 py-3 font-medium ${
                activeTab === "reservations"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Rezerwacje
            </button>
          </div>

          <div className="p-6">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Dane osobowe</h2>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Imię
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nazwisko
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {loading ? "Zapisywanie..." : "Zapisz zmiany"}
                    </button>
                  </form>
                </div>

                <div className="border-t pt-6">
                  <h2 className="text-2xl font-bold mb-4">Zmiana hasła</h2>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stare hasło
                      </label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nowe hasło
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Potwierdź hasło
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {loading ? "Zmienianie..." : "Zmień hasło"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Wallet Tab */}
            {activeTab === "wallet" && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Portfel</h2>
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white mb-6">
                  <p className="text-sm opacity-90 mb-2">Saldo konta</p>
                  <p className="text-4xl font-bold">
                    {(user.walletBalance || 0).toFixed(2)} zł
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Doładuj portfel</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Wybierz kwotę do doładowania (demo - bez rzeczywistej płatności)
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {[5, 10, 15].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleTopUp(amount)}
                        disabled={loading}
                        className="px-6 py-4 bg-white border-2 border-blue-500 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition disabled:opacity-50"
                      >
                        +{amount} zł
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reservations Tab */}
            {activeTab === "reservations" && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Historia rezerwacji</h2>
                {reservations.length === 0 ? (
                  <p className="text-gray-600">Brak rezerwacji</p>
                ) : (
                  <div className="space-y-4">
                    {reservations.map((reservation) => (
                      <div
                        key={reservation.reservationId}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">
                              Rezerwacja #{reservation.reservationId.slice(0, 8)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Data:{" "}
                              {new Date(reservation.createdAt).toLocaleString("pl-PL")}
                            </p>
                            <p className="text-sm text-gray-600">
                              Status:{" "}
                              <span
                                className={`font-semibold ${
                                  reservation.status === "active"
                                    ? "text-green-600"
                                    : reservation.status === "completed"
                                      ? "text-blue-600"
                                      : "text-gray-600"
                                }`}
                              >
                                {reservation.status === "active"
                                  ? "Aktywna"
                                  : reservation.status === "completed"
                                    ? "Zakończona"
                                    : reservation.status === "cancelled"
                                      ? "Anulowana"
                                      : reservation.status}
                              </span>
                            </p>
                            {reservation.price !== undefined && reservation.price > 0 && (
                              <p className="text-sm text-gray-600">
                                Cena: {reservation.price.toFixed(2)} zł
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

