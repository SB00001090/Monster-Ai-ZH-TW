import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface GuestContextType {
  isGuest: boolean;
  guestId: string;
  setAsGuest: () => void;
  exitGuest: () => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [guestId, setGuestId] = useState('');

  // Initialize from localStorage
  useEffect(() => {
    const storedGuestMode = localStorage.getItem('guest_mode');
    const storedGuestId = localStorage.getItem('guest_id');
    
    if (storedGuestMode === 'true' && storedGuestId) {
      setIsGuest(true);
      setGuestId(storedGuestId);
    }
  }, []);

  const setAsGuest = () => {
    const newGuestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('guest_mode', 'true');
    localStorage.setItem('guest_id', newGuestId);
    setIsGuest(true);
    setGuestId(newGuestId);
  };

  const exitGuest = () => {
    localStorage.removeItem('guest_mode');
    localStorage.removeItem('guest_id');
    setIsGuest(false);
    setGuestId('');
  };

  return (
    <GuestContext.Provider value={{ isGuest, guestId, setAsGuest, exitGuest }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  const context = useContext(GuestContext);
  if (!context) {
    throw new Error('useGuest must be used within GuestProvider');
  }
  return context;
}
