import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useAdmin = () => {
  const { user } = useAuth();

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['user-role-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .rpc('has_role', { 
          _user_id: user.id, 
          _role: 'admin' 
        });
      
      if (error) {
        console.error('Erro ao verificar role:', error);
        return false;
      }
      
      return data === true;
    },
    enabled: !!user?.id
  });

  return { isAdmin: isAdmin ?? false, isLoading };
};
