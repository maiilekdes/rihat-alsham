'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { OrderMessage } from '@rihasham/shared';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import OrderChatPanel from '@/components/OrderChatPanel';

interface OrderRow {
  id: string;
  order_number: number;
  status: string;
  fulfillment_type: 'delivery' | 'pickup';
  full_name?: string;
  phone: string;
  total: string;
  created_at: string;
  items: { nameEn: string; nameAr: string; quantity: number }[];
}

const NEXT_STATUS: Record<string, string | null> = {
  received: 'preparing',
  preparing: null, // branches into out_for_delivery / ready_for_pickup, handled below
  out_for_delivery: 'completed',
  ready_for_pickup: 'completed',
  completed: null,
  cancelled: null,
};

export default function OrdersPage() {
  const { staffUser } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [openChatOrderId, setOpenChatOrderId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api.get('/api/orders').then((res) => setOrders(res.data));
  }, []);

  useEffect(() => {
    if (!staffUser) return;
    let cleanup = () => {};
    getSocket(staffUser.role).then((sock) => {
      setSocket(sock);
      const onNew = (order: OrderRow) => {
        setOrders((prev) => [order, ...prev]);
        audioRef.current?.play().catch(() => {});
      };
      const onStatus = (update: { id: string; status: string }) => {
        setOrders((prev) => prev.map((o) => (o.id === update.id ? { ...o, status: update.status } : o)));
      };
      const onMessage = (msg: OrderMessage & { orderId: string }) => {
        if (msg.senderRole === 'customer' && msg.orderId !== openChatOrderId) {
          setUnread((prev) => ({ ...prev, [msg.orderId]: (prev[msg.orderId] ?? 0) + 1 }));
          audioRef.current?.play().catch(() => {});
        }
      };
      sock.on('order:new', onNew);
      sock.on('order:status', onStatus);
      sock.on('order:message', onMessage);
      cleanup = () => {
        sock.off('order:new', onNew);
        sock.off('order:status', onStatus);
        sock.off('order:message', onMessage);
      };
    });
    return () => cleanup();
  }, [staffUser, openChatOrderId]);

  function openChat(orderId: string) {
    setOpenChatOrderId(orderId);
    setUnread((prev) => ({ ...prev, [orderId]: 0 }));
  }

  async function updateStatus(order: OrderRow, status: string) {
    await api.patch(`/api/orders/${order.id}/status`, { status });
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
  }

  const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      {/* Plays a short chime on new-order events; provide your own /notify.mp3 asset. */}
      <audio ref={audioRef} src="/notify.mp3" preload="auto" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24 }}>Live Order Queue</h1>
        <select className="input" style={{ width: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All active</option>
          <option value="received">Received</option>
          <option value="preparing">Preparing</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="ready_for_pickup">Ready for Pickup</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {visible.map((order) => (
          <div key={order.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong>#{order.order_number}</strong>
              <span className={`badge badge-${order.status}`}>{order.status.replace(/_/g, ' ')}</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: 14 }}>{order.full_name || 'Customer'} — {order.phone}</p>
            <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--ink-soft)' }}>
              {order.fulfillment_type === 'delivery' ? 'Delivery' : 'Pickup'} · {order.total} SAR
            </p>
            <ul style={{ margin: '10px 0', paddingInlineStart: 18, fontSize: 13 }}>
              {order.items.map((it, i) => (
                <li key={i}>{it.quantity}x {it.nameEn}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {order.status === 'received' && (
                <button className="btn" onClick={() => updateStatus(order, 'preparing')}>Start Preparing</button>
              )}
              {order.status === 'preparing' && (
                <button
                  className="btn"
                  onClick={() =>
                    updateStatus(order, order.fulfillment_type === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup')
                  }
                >
                  {order.fulfillment_type === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup'}
                </button>
              )}
              {(order.status === 'out_for_delivery' || order.status === 'ready_for_pickup') && (
                <button className="btn" onClick={() => updateStatus(order, 'completed')}>Mark Completed</button>
              )}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <button className="btn btn-outline" onClick={() => updateStatus(order, 'cancelled')}>Cancel</button>
              )}
              <a className="btn btn-outline" href={`tel:${order.phone}`}>Call</a>
              <button className="btn btn-outline" onClick={() => openChat(order.id)} style={{ position: 'relative' }}>
                Delivery Notes
                {!!unread[order.id] && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -6,
                      insetInlineEnd: -6,
                      background: 'var(--brand-red)',
                      color: 'white',
                      borderRadius: 999,
                      fontSize: 10,
                      width: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {unread[order.id]}
                  </span>
                )}
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p style={{ color: 'var(--ink-soft)' }}>No orders in this view.</p>}
      </div>

      {openChatOrderId && (
        <OrderChatPanel
          orderId={openChatOrderId}
          socket={socket}
          currentStaffId={staffUser?.id}
          onClose={() => setOpenChatOrderId(null)}
        />
      )}
    </div>
  );
}
