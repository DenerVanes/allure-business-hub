import { useState } from 'react';
import { Megaphone, Settings, Gift } from 'lucide-react';
import { useBirthdays } from '@/hooks/useBirthdays';
import { getMonthName } from '@/utils/formatBirthday';
import { BirthdayTable } from '@/components/marketing/BirthdayTable';
import { TemplateManager } from '@/components/marketing/TemplateManager';
import { PromotionManager } from '@/components/marketing/PromotionManager';
import { useNavigate } from 'react-router-dom';
import { formatPhone } from '@/utils/phone';
import { Button } from '@/components/ui/button';

const Birthdays = () => {
  const { aniversariantes, loading } = useBirthdays();
  const monthName = getMonthName();
  const navigate = useNavigate();
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [promotionManagerOpen, setPromotionManagerOpen] = useState(false);

  const handleAgendar = (phone: string) => {
    navigate('/agendamentos', { 
      state: { prefillPhone: formatPhone(phone) } 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Aniversariantes de {monthName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Clientes que fazem aniversário neste mês.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setTemplateManagerOpen(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Gerenciar Templates
          </Button>
          <Button
            variant="outline"
            onClick={() => setPromotionManagerOpen(true)}
            className="gap-2"
          >
            <Gift className="h-4 w-4" />
            Gerenciar Promoções
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-lg border p-6">
        <BirthdayTable 
          aniversariantes={aniversariantes} 
          loading={loading}
          onClose={() => {}}
          onAgendar={handleAgendar}
        />
      </div>

      <TemplateManager
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
      />
      <PromotionManager
        open={promotionManagerOpen}
        onOpenChange={setPromotionManagerOpen}
      />
    </div>
  );
};

export default Birthdays;

