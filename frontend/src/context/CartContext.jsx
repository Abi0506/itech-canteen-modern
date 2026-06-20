import React, { createContext, useState, useContext, useEffect } from 'react';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  // Load cart from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('canteen_cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {
        setCart([]);
      }
    }
  }, []);

  // Save cart to local storage
  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('canteen_cart', JSON.stringify(newCart));
  };

  const addToCart = (item, quantity = 1) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      const updated = cart.map(i => 
        i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
      );
      saveCart(updated);
    } else {
      saveCart([...cart, { ...item, quantity }]);
    }
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      const updated = cart.map(i => 
        i.id === itemId ? { ...i, quantity } : i
      );
      saveCart(updated);
    }
  };

  const removeFromCart = (itemId) => {
    const updated = cart.filter(i => i.id !== itemId);
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart, getCartTotal, getCartCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
