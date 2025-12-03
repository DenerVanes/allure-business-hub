import { Clock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

export const TrialBanner = () => {
  const { isTrial, daysRemaining, isAdmin, isLoading } = useSubscription();

  // Não mostrar para admin ou se não está em trial
  if (isLoading || isAdmin || !isTrial || daysRemaining === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 text-sm">
      <Clock className="h-4 w-4" />
      <span className="font-medium">
        {daysRemaining === 0 
          ? 'Último dia de teste gratuito' 
          : `${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} de teste gratuito restantes`
        }
      </span>
    </div>
  );
};
