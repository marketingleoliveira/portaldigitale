import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, AlertTriangle } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  countdown: number;
  onDismiss: () => void;
}

const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  countdown,
  onDismiss,
}) => {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-warning/20">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <AlertDialogTitle className="text-xl">
              Sessão Inativa
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Você está inativo há 5 minutos. Por motivos de segurança, você será
            desconectado automaticamente em:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-3 px-6 py-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <Clock className="w-8 h-8 text-destructive" />
            <span className="text-4xl font-mono font-bold text-destructive">
              {formatTime(countdown)}
            </span>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={onDismiss}
            className="w-full"
          >
            Continuar Navegando
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default InactivityWarningModal;
