import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBirthdays } from '@/hooks/useBirthdays';
import { getMonthName } from '@/utils/formatBirthday';
import { formatPhone } from '@/utils/phone';
import { BirthdayTable } from './BirthdayTable';

interface BirthdayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BirthdayModal = ({ open, onOpenChange }: BirthdayModalProps) => {
  const { aniversariantes, loading } = useBirthdays();
  const monthName = getMonthName();
  const navigate = useNavigate();

  const handleAgendar = (phone: string) => {
    navigate('/agendamentos', { 
      state: { prefillPhone: formatPhone(phone) } 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Aniversariantes de {monthName}
          </DialogTitle>
          <p className="text-sm text-gray-500 mb-4">
            Clientes que fazem aniversário neste mês.
          </p>
        </DialogHeader>
        <BirthdayTable 
          aniversariantes={aniversariantes} 
          loading={loading}
          onClose={() => onOpenChange(false)}
          onAgendar={handleAgendar}
        />
      </DialogContent>
    </Dialog>
  );
};

