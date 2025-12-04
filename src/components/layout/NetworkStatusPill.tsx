import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function NetworkStatusPill() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return (
    <div 
      className={`network-pill ${isOnline ? 'network-online' : 'network-offline'}`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-court-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-court-success"></span>
          </span>
          <Wifi className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Live Sync</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-court-warning"></span>
          </span>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Bunker Mode</span>
        </>
      )}
    </div>
  );
}