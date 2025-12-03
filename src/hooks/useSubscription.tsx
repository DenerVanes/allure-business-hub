import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAdmin } from './useAdmin';

interface ProfileWithSubscription {
  id: string;
  user_id: string;
  trial_expires_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, trial_expires_at, subscription_status')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) return null;

      // Se o trial expirou mas o status ainda está como 'trial', atualizar
      if (data.subscription_status === 'trial' && data.trial_expires_at) {
        const expiresAt = new Date(data.trial_expires_at);
        const now = new Date();
        
        if (expiresAt < now) {
          // Atualizar status para expired
          await supabase
            .from('profiles')
            .update({ subscription_status: 'expired' })
            .eq('user_id', user.id);
          
          return { ...data, subscription_status: 'expired' } as ProfileWithSubscription;
        }
      }
      
      return data as ProfileWithSubscription;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Verificar a cada minuto
  });

  const isExpired = () => {
    // Admin nunca expira
    if (isAdmin) return false;
    
    if (!profile) return false;
    
    // Se o status já está como expired, retorna true
    if (profile.subscription_status === 'expired') return true;
    
    // Se está em trial, verifica se a data expirou
    if (profile.subscription_status === 'trial' && profile.trial_expires_at) {
      return new Date(profile.trial_expires_at) < new Date();
    }
    
    // Se está active, não está expirado
    if (profile.subscription_status === 'active') return false;
    
    return false;
  };

  const isTrial = () => {
    if (isAdmin) return false;
    return profile?.subscription_status === 'trial';
  };

  const isActive = () => {
    if (isAdmin) return true;
    return profile?.subscription_status === 'active';
  };

  const getDaysRemaining = () => {
    if (!profile?.trial_expires_at || isAdmin) return null;
    
    const expiresAt = new Date(profile.trial_expires_at);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  return {
    profile,
    isLoading: isLoading || adminLoading,
    isExpired: isExpired(),
    isTrial: isTrial(),
    isActive: isActive(),
    trialExpiresAt: profile?.trial_expires_at || null,
    daysRemaining: getDaysRemaining(),
    isAdmin,
  };
};
