import { useWhisperListener } from '@/hooks/useWhisper';

interface WhisperNotificationProps {
  docketId: string;
}

export function WhisperNotification({ docketId }: WhisperNotificationProps) {
  // This hook sets up the realtime listener and shows toast notifications
  useWhisperListener(docketId);
  
  // This component doesn't render anything visible
  // It just manages the subscription and toast notifications
  return null;
}
