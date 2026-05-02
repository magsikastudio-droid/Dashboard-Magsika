import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const { user } = useAuth();
  const [rate, setRate] = useState(parseFloat(localStorage.getItem("ms_rate")) || 16000);
  const [display, setDisplay] = useState(localStorage.getItem("ms_display") || "USD"); // USD or IDR

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api.get("/settings").then((r) => { if (r.data?.exchange_rate) setRate(r.data.exchange_rate); }).catch(() => {});
  }, [user]);

  const updateRate = useCallback(async (newRate) => {
    setRate(newRate);
    localStorage.setItem("ms_rate", String(newRate));
    if (user?.role === "admin") {
      try { await api.put("/settings", { exchange_rate: newRate }); } catch {}
    }
  }, [user]);

  const setDisplayCurrency = useCallback((c) => { setDisplay(c); localStorage.setItem("ms_display", c); }, []);

  // Convert: amount in given currency (USD/IDR) → display currency
  const convert = useCallback((amount, fromCurrency = "USD") => {
    const a = Number(amount) || 0;
    if (fromCurrency === display) return a;
    if (fromCurrency === "USD" && display === "IDR") return a * rate;
    if (fromCurrency === "IDR" && display === "USD") return a / rate;
    return a;
  }, [display, rate]);

  const fmt = useCallback((amount, fromCurrency = "USD") => {
    const v = convert(amount, fromCurrency);
    if (display === "USD") return "$" + (v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return "Rp" + Math.round(v).toLocaleString("id-ID");
  }, [convert, display]);

  const fmtSecondary = useCallback((amount, fromCurrency = "USD") => {
    // returns the OTHER currency for sub-display
    const otherDisplay = display === "USD" ? "IDR" : "USD";
    let other;
    if (fromCurrency === otherDisplay) other = Number(amount) || 0;
    else if (fromCurrency === "USD" && otherDisplay === "IDR") other = (Number(amount) || 0) * rate;
    else if (fromCurrency === "IDR" && otherDisplay === "USD") other = (Number(amount) || 0) / rate;
    else other = Number(amount) || 0;
    if (otherDisplay === "USD") return "$" + other.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return "Rp" + Math.round(other).toLocaleString("id-ID");
  }, [display, rate]);

  return (
    <CurrencyContext.Provider value={{ rate, display, updateRate, setDisplayCurrency, convert, fmt, fmtSecondary }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
