import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // 版本信息
  getVersion: () => ipcRenderer.invoke('app-version'),

  // 自動更新
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  restartApp: () => ipcRenderer.send('restart-app'),

  // 離線數據
  getOfflineData: () => ipcRenderer.invoke('get-offline-data'),
  saveOfflineData: (data: any) => ipcRenderer.invoke('save-offline-data', data),

  // 系統信息
  getPlatform: () => process.platform,
  getArch: () => process.arch,
});

declare global {
  interface Window {
    electron: {
      getVersion: () => Promise<{ version: string }>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      restartApp: () => void;
      getOfflineData: () => Promise<any>;
      saveOfflineData: (data: any) => Promise<boolean>;
      getPlatform: () => string;
      getArch: () => string;
    };
  }
}
