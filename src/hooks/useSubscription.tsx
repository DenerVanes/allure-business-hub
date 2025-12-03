import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAdmin } from './useAdmin';

interface ProfileWithSubscription {
  id: string;
  user_id: string;
  trial_expires_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled' | null;
  plan_expires_at: string | null;
  plan_status: 'active' | 'expired' | 'none' | null;
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
        .select('id, user_id, trial_expires_at, subscription_status, plan_expires_at, plan_status')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) return null;

      const now = new Date();
      
      // Atualizar plan_status se necessário (verificar se expirou)
      if (data.plan_status === 'active' && data.plan_expires_at) {
        const expiresAt = new Date(data.plan_expires_at);
        if (expiresAt < now) {
          // Atualizar status para expired
          await supabase
            .from('profiles')
            .update({ plan_status: 'expired' })
            .eq('user_id', user.id);
          
          return { ...data, plan_status: 'expired' } as ProfileWithSubscription;
        }
      }

      // Se o trial expirou mas o status ainda está como 'trial', atualizar
      if (data.subscription_status === 'trial' && data.trial_expires_at) {
        const expiresAt = new Date(data.trial_expires_at);
        
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
    
    // Prioridade: verificar plan_expires_at e plan_status (sistema novo de planos)
    if (profile.plan_expires_at) {
      const expiresAt = new Date(profile.plan_expires_at);
      const now = new Date();
      
      // Se plan_expires_at existe e expirou, ou se plan_status é 'expired'
      if (expiresAt < now || profile.plan_status === 'expired') {
        return true;
      }
      
      // Se plan_expires_at existe e ainda não expirou, e status é 'active'
      if (expiresAt >= now && profile.plan_status === 'active') {
        return false;
      }
    }
    
    // Se plan_expires_at é NULL, verificar se plan_status é 'none' ou 'expired'
    if (!profile.plan_expires_at) {
      if (profile.plan_status === 'expired') {
        return true;
      }
      if (profile.plan_status === 'none' || !profile.plan_status) {
        // Se não tem plano, verificar trial
        // Se o status já está como expired, retorna true
        if (profile.subscription_status === 'expired') return true;
        
        // Se está em trial, verifica se a data expirou
        if (profile.subscription_status === 'trial' && profile.trial_expires_at) {
          return new Date(profile.trial_expires_at) < new Date();
        }
        
        // Se não tem trial nem plano, bloquear
        return true;
      }
    }
    
    return false;
  };

  const isTrial = () => {
    if (isAdmin) return false;
    // Se tem plano ativo, não está em trial
    if (profile?.plan_status === 'active' && profile?.plan_expires_at) {
      return false;
    }
    return profile?.subscription_status === 'trial';
  };

  const isActive = () => {
    if (isAdmin) return true;
    // Verificar se tem plano ativo
    if (profile?.plan_status === 'active' && profile?.plan_expires_at) {
      const expiresAt = new Date(profile.plan_expires_at);
      return expiresAt >= new Date();
    }
    return profile?.subscription_status === 'active';
  };

  const getDaysRemaining = () => {
    if (isAdmin) return null;
    
    // Prioridade: usar plan_expires_at se existir
    if (profile?.plan_expires_at) {
      const expiresAt = new Date(profile.plan_expires_at);
      const now = new Date();
      const diffTime = expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    
    // Fallback: usar trial_expires_at
    if (profile?.trial_expires_at) {
      const expiresAt = new Date(profile.trial_expires_at);
      const now = new Date();
      const diffTime = expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    
    return null;
  };

  const getExpiresAt = () => {
    // Prioridade: usar plan_expires_at se existir
    if (profile?.plan_expires_at) {
      return profile.plan_expires_at;
    }
    // Fallback: usar trial_expires_at
    return profile?.trial_expires_at || null;
  };

  return {
    profile,
    isLoading: isLoading || adminLoading,
    isExpired: isExpired(),
    isTrial: isTrial(),
    isActive: isActive(),
    trialExpiresAt: getExpiresAt(),
    planExpiresAt: profile?.plan_expires_at || null,
    daysRemaining: getDaysRemaining(),
    isAdmin,
  };
};
