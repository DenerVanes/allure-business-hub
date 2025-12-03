import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

interface ProfileWithSubscription {
  id: string;
  user_id: string;
  trial_expires_at: string | null;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
}

export const useSubscription = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      
      // Se o trial expirou mas o status ainda está como 'trial', atualizar
      if (data && data.subscription_status === 'trial' && data.trial_expires_at) {
        const expiresAt = new Date(data.trial_expires_at);
        const now = new Date();
        
        if (expiresAt < now) {
          // Atualizar status para expired
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ subscription_status: 'expired' })
            .eq('user_id', user.id);
          
          if (!updateError) {
            return { ...data, subscription_status: 'expired' } as ProfileWithSubscription;
          }
        }
      }
      
      return data as ProfileWithSubscription | null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Verificar a cada minuto
  });

  const isExpired = () => {
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
    return profile?.subscription_status === 'trial';
  };

  const isActive = () => {
    return profile?.subscription_status === 'active';
  };

  return {
    profile,
    isLoading,
    isExpired: isExpired(),
    isTrial: isTrial(),
    isActive: isActive(),
    trialExpiresAt: profile?.trial_expires_at || null,
  };
};

