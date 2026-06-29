import { useEffect, useState } from 'react';

declare global {
  interface Window {
    electron?: {
      getOfflineData: () => Promise<any>;
      saveOfflineData: (data: any) => Promise<boolean>;
    };
  }
}

interface OfflineData {
  conversations: any[];
  characters: any[];
  messages: any[];
  lastSync: number;
}

export function useOfflineData() {
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // 監聽網絡狀態
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 加載離線數據
  const loadOfflineData = async () => {
    if (!window.electron) return;
    try {
      const data = await window.electron.getOfflineData();
      if (data) {
        setOfflineData(data);
      }
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  // 保存離線數據
  const saveOfflineData = async (data: Partial<OfflineData>) => {
    if (!window.electron) return false;
    try {
      setIsSyncing(true);
      const merged: OfflineData = {
        conversations: data.conversations || offlineData?.conversations || [],
        characters: data.characters || offlineData?.characters || [],
        messages: data.messages || offlineData?.messages || [],
        lastSync: Date.now(),
      };
      const success = await window.electron.saveOfflineData(merged);
      if (success) {
        setOfflineData(merged);
      }
      return success;
    } catch (error) {
      console.error('Failed to save offline data:', error);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // 初始化時加載離線數據
  useEffect(() => {
    loadOfflineData();
  }, []);

  return {
    offlineData,
    isOnline,
    isSyncing,
    loadOfflineData,
    saveOfflineData,
  };
}
