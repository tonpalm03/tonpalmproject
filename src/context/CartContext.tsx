'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { OrderItem, MenuItem, MenuItemOption, Shop } from '@/types';
import { soundAlert } from '@/lib/soundAlert';

export interface ShopCartGroup {
  shop: { id: string; name: string; phone?: string; delivery_fee?: number };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

interface CartContextType {
  items: OrderItem[];
  currentShop: { id: string; name: string; phone?: string; delivery_fee?: number } | null;
  groupedItems: ShopCartGroup[];
  shopsInCart: { id: string; name: string; phone?: string; delivery_fee?: number }[];
  deliveryFee: number;
  subtotal: number;
  total: number;
  gpAmount: number;
  addItem: (
    item: MenuItem,
    shop: { id: string; name: string; phone?: string; delivery_fee?: number },
    note?: string,
    selectedOptions?: MenuItemOption[],
    quantity?: number
  ) => { success: boolean; needConfirm?: boolean; message?: string };
  confirmSwitchShopAndAdd: (
    item: MenuItem,
    shop: { id: string; name: string; phone?: string; delivery_fee?: number },
    note?: string,
    selectedOptions?: MenuItemOption[],
    quantity?: number
  ) => void;
  updateQuantity: (cartItemIdOrMenuId: string, delta: number) => void;
  removeItem: (cartItemIdOrMenuId: string) => void;
  clearCart: () => void;
  itemCount: number;
  shopCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const getOptionsSignature = (opts?: MenuItemOption[]) => {
  if (!opts || opts.length === 0) return '';
  return opts
    .map((o) => `${(o as any).group_id || (o as any).group_title || ''}:${(o as any).option_id || o.name}:${o.name}:${o.price}`)
    .sort()
    .join('|');
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const isLoadedRef = useRef(false);

  // Load cart from localStorage and listen to reset events
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hchk_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        const loadedItems = (parsed.items || []).map((it: OrderItem) => ({
          ...it,
          cart_item_id: it.cart_item_id || `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        }));
        setItems(loadedItems);
      }
    } catch (e) {
      console.error('Error loading cart from storage', e);
    } finally {
      isLoadedRef.current = true;
    }

    const handleAuthReset = () => {
      setItems([]);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'hchk_cart' && !e.newValue) {
        setItems([]);
      }
    };

    window.addEventListener('hchk_auth_reset', handleAuthReset);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('hchk_auth_reset', handleAuthReset);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Save cart to localStorage only after initial load
  useEffect(() => {
    if (!isLoadedRef.current) return;
    try {
      localStorage.setItem('hchk_cart', JSON.stringify({ items }));
    } catch (e) {
      console.error('Error saving cart', e);
    }
  }, [items]);

  // Group items by shop
  const groupedItems = useMemo(() => {
    const groups: { [shopId: string]: ShopCartGroup } = {};
    items.forEach((item) => {
      const sId = item.shop_id || 'default_shop';
      if (!groups[sId]) {
        const shopFee = typeof item.shop_delivery_fee === 'number' && item.shop_delivery_fee >= 0
          ? item.shop_delivery_fee
          : 0;
        groups[sId] = {
          shop: {
            id: sId,
            name: item.shop_name || 'ร้านค้าชุมชน',
            phone: item.shop_phone || '',
            delivery_fee: shopFee,
          },
          items: [],
          subtotal: 0,
          deliveryFee: shopFee,
          total: shopFee,
        };
      }
      groups[sId].items.push(item);
      const itemUnitPrice = item.unit_price ?? item.price;
      groups[sId].subtotal += itemUnitPrice * item.quantity;
      groups[sId].total = groups[sId].subtotal + groups[sId].deliveryFee;
    });
    return Object.values(groups);
  }, [items]);

  const shopsInCart = useMemo(() => groupedItems.map((g) => g.shop), [groupedItems]);
  const shopCount = shopsInCart.length;
  const currentShop = shopsInCart.length === 1
    ? shopsInCart[0]
    : shopsInCart.length > 1
    ? { id: 'multi', name: `รวม ${shopCount} ร้านค้า`, phone: '', delivery_fee: 0 }
    : null;

  const subtotal = items.reduce((sum, item) => {
    const itemUnitPrice = item.unit_price ?? item.price;
    return sum + itemUnitPrice * item.quantity;
  }, 0);
  const deliveryFee = groupedItems.reduce((sum, g) => sum + g.deliveryFee, 0);
  const total = subtotal > 0 ? subtotal + deliveryFee : 0;
  const gpAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% of food sales
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const addItem = (
    item: MenuItem,
    shop: { id: string; name: string; phone?: string; delivery_fee?: number },
    note?: string,
    selectedOptions?: MenuItemOption[],
    quantity?: number
  ) => {
    const optionsSig = getOptionsSignature(selectedOptions);
    const itemNote = (note || '').trim();
    const qtyToAdd = quantity && quantity > 0 ? quantity : 1;
    const optionsPrice = (selectedOptions || []).reduce((sum, opt) => sum + (Number(opt.price) || 0), 0);
    const unitPrice = item.price + optionsPrice;
    const shopFee = typeof shop.delivery_fee === 'number' && shop.delivery_fee >= 0 ? shop.delivery_fee : 0;

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) =>
          i.menu_id === item.id &&
          (i.note || '').trim() === itemNote &&
          getOptionsSignature(i.selected_options) === optionsSig
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += qtyToAdd;
        return updated;
      }
      return [
        ...prev,
        {
          cart_item_id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          menu_id: item.id,
          name: item.name,
          price: item.price,
          unit_price: unitPrice,
          image_url: item.image_url,
          selected_options: selectedOptions || [],
          quantity: qtyToAdd,
          note: itemNote,
          shop_id: shop.id,
          shop_name: shop.name,
          shop_phone: shop.phone,
          shop_delivery_fee: shopFee,
        }
      ];
    });

    soundAlert.playAddToCartSound().catch(() => {});
    return { success: true };
  };

  const confirmSwitchShopAndAdd = (
    item: MenuItem,
    shop: { id: string; name: string; phone?: string; delivery_fee?: number },
    note?: string,
    selectedOptions?: MenuItemOption[],
    quantity?: number
  ) => {
    addItem(item, shop, note, selectedOptions, quantity);
  };

  const updateQuantity = (cartItemIdOrMenuId: string, delta: number) => {
    if (delta > 0) {
      soundAlert.playAddToCartSound().catch(() => {});
    }
    setItems((prev) => {
      const hasCartIdMatch = prev.some((i) => i.cart_item_id === cartItemIdOrMenuId);
      return prev
        .map((item) => {
          const isMatch = hasCartIdMatch
            ? item.cart_item_id === cartItemIdOrMenuId
            : item.menu_id === cartItemIdOrMenuId;
          if (isMatch) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const removeItem = (cartItemIdOrMenuId: string) => {
    setItems((prev) => {
      const hasCartIdMatch = prev.some((i) => i.cart_item_id === cartItemIdOrMenuId);
      return prev.filter((i) =>
        hasCartIdMatch
          ? i.cart_item_id !== cartItemIdOrMenuId
          : i.menu_id !== cartItemIdOrMenuId
      );
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  return (
    <CartContext.Provider value={{
      items,
      currentShop,
      groupedItems,
      shopsInCart,
      deliveryFee,
      subtotal,
      total,
      gpAmount,
      addItem,
      confirmSwitchShopAndAdd,
      updateQuantity,
      removeItem,
      clearCart,
      itemCount,
      shopCount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
