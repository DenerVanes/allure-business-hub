import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BirthdayClient {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
}

export const useBirthdays = () => {
  const { user } = useAuth();
  const currentMonth = new Date().getMonth();

  const { data: aniversariantes = [], isLoading, error } = useQuery<BirthdayClient[]>({
    queryKey: ['birthdays', user?.id, currentMonth],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, birth_date')
        .eq('user_id', user.id)
        .not('birth_date', 'is', null);

      if (error) throw error;

      if (!data) return [];

      const filtered = data.filter((client) => {
        if (!client.birth_date) return false;
        const birthDate = new Date(client.birth_date);
        return birthDate.getMonth() === currentMonth;
      });

      return filtered.sort((a, b) => {
        if (!a.birth_date || !b.birth_date) return 0;
        const dateA = new Date(a.birth_date);
        const dateB = new Date(b.birth_date);
        return dateA.getDate() - dateB.getDate();
      });
    },
    enabled: !!user?.id
  });

  return {
    aniversariantes,
    loading: isLoading,
    error
  };
};

