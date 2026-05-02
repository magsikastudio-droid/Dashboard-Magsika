import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { OrdersProvider } from "@/context/OrdersContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import Board from "@/pages/Board";
import Invoice from "@/pages/Invoice";
import Settings from "@/pages/Settings";
import Earning from "@/pages/Earning";
import Freelance from "@/pages/Freelance";
import Archive from "@/pages/Archive";

const gated = (Page) => (
  <ProtectedRoute>
    <OrdersProvider>
      <CurrencyProvider>
        <Layout>
          <Page />
        </Layout>
      </CurrencyProvider>
    </OrdersProvider>
  </ProtectedRoute>
);

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={gated(Dashboard)} />
      <Route path="/orders" element={gated(Orders)} />
      <Route path="/board" element={gated(Board)} />
      <Route path="/invoice" element={gated(Invoice)} />
      <Route path="/earning" element={gated(Earning)} />
      <Route path="/freelance" element={gated(Freelance)} />
      <Route path="/archive" element={gated(Archive)} />
      <Route path="/settings" element={gated(Settings)} />
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
