import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Interceptor dodający token do każdego żądania
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Interceptor obsługi błędów
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTENTYKACJA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const register = async (userData) => {
  const response = await api.post("/auth/register", userData);
  if (response.data.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }
  return response.data;
};

export const login = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  if (response.data.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

export const isAuthenticated = () => {
  return !!localStorage.getItem("token");
};

export const isAdmin = () => {
  const user = getCurrentUser();
  return user?.role === "admin";
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UŻYTKOWNICY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getMyProfile = async () => {
  const response = await api.get("/users/me");
  return response.data;
};

export const updateMyProfile = async (updates) => {
  const response = await api.put("/users/me", updates);
  return response.data;
};

export const changePassword = async (oldPassword, newPassword) => {
  const response = await api.post("/users/me/change-password", {
    oldPassword,
    newPassword,
  });
  return response.data;
};

export const getAllUsers = async (limit = 50) => {
  const response = await api.get("/users", { params: { limit } });
  return response.data;
};

export const updateUser = async (userId, updates) => {
  const response = await api.put(`/users/${userId}`, updates);
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/users/${userId}`);
  return response.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HULAJNOGI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getScooters = async (lat, lon, radius = 500, minBattery = 0) => {
  const response = await api.get("/scooters", {
    params: { lat, lon, radius, minBattery },
  });
  return response.data;
};

export const getScooter = async (scooterId) => {
  const response = await api.get(`/scooters/${scooterId}`);
  return response.data;
};

export const getScooterStats = async () => {
  const response = await api.get("/scooters/stats");
  return response.data;
};

export const createScooter = async (scooterData) => {
  const response = await api.post("/scooters", scooterData);
  return response.data;
};

export const updateScooter = async (scooterId, updates) => {
  const response = await api.put(`/scooters/${scooterId}`, updates);
  return response.data;
};

export const updateScooterStatus = async (scooterId, status) => {
  const response = await api.patch(`/scooters/${scooterId}/status`, { status });
  return response.data;
};

export const updateScooterBattery = async (scooterId, battery) => {
  const response = await api.patch(`/scooters/${scooterId}/battery`, {
    battery,
  });
  return response.data;
};

export const deleteScooter = async (scooterId) => {
  const response = await api.delete(`/scooters/${scooterId}`);
  return response.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REZERWACJE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createReservation = async (scooterId) => {
  const response = await api.post("/reservations", { scooterId });
  return response.data;
};

export const getMyReservation = async () => {
  const response = await api.get("/reservations/me");
  return response.data;
};

export const getReservationHistory = async (limit = 20) => {
  const response = await api.get("/reservations/history", {
    params: { limit },
  });
  return response.data;
};

export const cancelReservation = async (reservationId) => {
  const response = await api.delete(`/reservations/${reservationId}`);
  return response.data;
};

export const startRide = async (reservationId) => {
  const response = await api.post(`/reservations/${reservationId}/start`);
  return response.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const initDatabase = async (reset = false) => {
  const url = reset ? "/init?reset=true" : "/init";
  const response = await api.post(url);
  return response.data;
};

export const seedData = async () => {
  const response = await api.post("/seed");
  return response.data;
};

export default api;
