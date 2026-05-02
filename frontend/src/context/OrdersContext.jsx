import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api, wsUrl } from "../lib/api";
import { useAuth } from "./AuthContext";

const OrdersContext = createContext(null);

export const OrdersProvider = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/orders");
      setOrders(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket for real-time sync
  useEffect(() => {
    if (!user) return;
    let reconnectTimer;
    let heartbeatTimer;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl());
        wsRef.current = ws;
        ws.onopen = () => {
          setWsConnected(true);
          heartbeatTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send("ping");
          }, 25000);
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "order.created") {
              setOrders((prev) => [...prev.filter((o) => o.id !== msg.order.id), msg.order]);
            } else if (msg.type === "order.updated") {
              setOrders((prev) => prev.map((o) => (o.id === msg.order.id ? msg.order : o)));
            } else if (msg.type === "order.deleted") {
              setOrders((prev) => prev.filter((o) => o.id !== msg.id));
            }
          } catch {}
        };
        ws.onclose = () => {
          setWsConnected(false);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          reconnectTimer = setTimeout(connect, 2000);
        };
        ws.onerror = () => { try { ws.close(); } catch {} };
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();
    fetchOrders();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try { wsRef.current?.close(); } catch {}
    };
  }, [user, fetchOrders]);

  const createOrder = async (payload) => (await api.post("/orders", payload)).data;
  const updateOrder = async (id, payload) => (await api.put(`/orders/${id}`, payload)).data;
  const deleteOrder = async (id) => (await api.delete(`/orders/${id}`)).data;
  const reassignOrder = async (id, payload) => (await api.patch(`/orders/${id}/reassign`, payload)).data;

  return (
    <OrdersContext.Provider value={{ orders, loading, wsConnected, fetchOrders, createOrder, updateOrder, deleteOrder, reassignOrder }}>
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => useContext(OrdersContext);
