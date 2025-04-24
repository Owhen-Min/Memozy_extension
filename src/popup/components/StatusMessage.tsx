import { useEffect, useState } from 'react';
import { NotificationType } from '../../types';

interface StatusMessageProps {
  type: NotificationType;
  message: string;
  duration?: number;
  onClose?: () => void;
}

const StatusMessage: React.FC<StatusMessageProps> = ({ 
  type, 
  message, 
  duration = 3000, 
  onClose 
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const styles = type === 'success' 
    ? 'bg-green-50 text-success border-l-2 border-success' 
    : 'bg-red-50 text-error border-l-2 border-error';

  return (
    <div className={`py-2 px-3 rounded mb-1.5 text-xs ${styles}`}>
      {message}
    </div>
  );
};

export default StatusMessage; 