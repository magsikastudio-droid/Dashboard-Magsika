import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ms-bg)" }}>
        <div className="w-10 h-10 rounded-full border-4 border-[var(--ms-primary)] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Talent → redirect to /todo, others → /dashboard
    return <Navigate to={user.role === "talent" ? "/todo" : "/dashboard"} replace />;
  }
  return children;
}
