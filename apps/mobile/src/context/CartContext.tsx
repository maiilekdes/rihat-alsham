import React, { createContext, useContext, useMemo, useState } from 'react';
import { CartItem } from '@rihasham/shared';

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clear: () => void;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(item: CartItem) {
    setItems((prev) => [...prev, item]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function updateQuantity(index: number, quantity: number) {
    if (quantity < 1) return removeItem(index);
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity } : it)));
  }
  function clear() {
    setItems([]);
  }

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
        return sum + (item.unitPrice + extrasTotal) * item.quantity;
      }, 0),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clear, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
