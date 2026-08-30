'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { OrderMessage } from '@rihasham/shared';
import { api } from '@/lib/api';
import { uploadChatMedia } from '@/lib/storage';

interface Props {
  orderId: string;
  socket: Socket | null;
  currentStaffId?: string;
  onClose: () => void;
}

/** The staff-side view of an order's delivery-notes chat — opened from an order card in the live queue. */
export default function OrderChatPanel({ orderId, socket, currentStaffId, onClose }: Props) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/api/orders/${orderId}/messages`).then((res) => setMessages(res.data));
  }, [orderId]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: OrderMessage & { orderId: string }) => {
      if (msg.orderId === orderId) setMessages((prev) => [...prev, msg]);
    };
    socket.on('order:message', onMessage);
    return () => {
      socket.off('order:message', onMessage);
    };
  }, [socket, orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendText() {
    if (!text.trim()) return;
    const body = text.trim();
    setText('');
    const { data } = await api.post(`/api/orders/${orderId}/messages`, { type: 'text', body });
    setMessages((prev) => [...prev, data]);
  }

  async function sendFile(file: File) {
    const kind = file.type.startsWith('video') ? 'video' : 'image';
    setUploading(true);
    try {
      const mediaUrl = await uploadChatMedia(orderId, file);
      const { data } = await api.post(`/api/orders/${orderId}/messages`, { type: kind, mediaUrl });
      setMessages((prev) => [...prev, data]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', insetInlineEnd: 0, top: 0, bottom: 0, width: 360, background: 'white', borderInlineStart: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Delivery Notes</strong>
        <button className="btn-outline btn" onClick={onClose}>Close</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m) => {
          const mine = m.senderId === currentStaffId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div
                style={{
                  background: mine ? 'var(--brand-red)' : 'var(--bg)',
                  color: mine ? 'white' : 'var(--ink)',
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                }}
              >
                {m.type === 'text' && <span>{m.body}</span>}
                {m.type === 'image' && <img src={m.mediaUrl} alt="" style={{ maxWidth: 220, borderRadius: 8 }} />}
                {m.type === 'video' && <video src={m.mediaUrl} controls style={{ maxWidth: 220, borderRadius: 8 }} />}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && sendFile(e.target.files[0])}
        />
        <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? '…' : '📎'}
        </button>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
          placeholder="Reply…"
        />
        <button className="btn" onClick={sendText}>Send</button>
      </div>
    </div>
  );
}
