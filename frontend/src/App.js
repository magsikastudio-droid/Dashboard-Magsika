import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { OrdersProvider } from "@/context/OrdersContext";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import Board from "@/pages/Board";
import Invoice from "@/pages/Invoice";
import Settings from "@/pages/Settings";

function AppRouter() {
  const location = useLocation();
  // Synchronous check: if returning from OAuth, render AuthCallback first
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={<ProtectedRoute><OrdersProvider><Layout><Dashboard /></Layout></OrdersProvider></ProtectedRoute>}
      />
      <Route
        path="/orders"
        element={<ProtectedRoute><OrdersProvider><Layout><Orders /></Layout></OrdersProvider></ProtectedRoute>}
      />
      <Route
        path="/board"
        element={<ProtectedRoute><OrdersProvider><Layout><Board /></Layout></OrdersProvider></ProtectedRoute>}
      />
      <Route
        path="/invoice"
        element={<ProtectedRoute><OrdersProvider><Layout><Invoice /></Layout></OrdersProvider></ProtectedRoute>}
      />
      <Route
        path="/settings"
        element={<ProtectedRoute><OrdersProvider><Layout><Settings /></Layout></OrdersProvider></ProtectedRoute>}
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
