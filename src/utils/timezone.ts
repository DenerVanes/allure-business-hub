
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Converte data/hora do Supabase para timezone do Brasil
export const convertToLocalTime = (dateString: string): Date => {
  const date = parseISO(dateString);
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
};

// Formata data para exibição no Brasil
export const formatToBrazilianDate = (date: Date): string => {
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

// Formata data e hora para exibição no Brasil
export const formatToBrazilianDateTime = (date: Date): string => {
  return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

// Converte data para formato do Supabase
export const convertToSupabaseDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// Converte horário para formato do Supabase
export const convertToSupabaseTime = (time: string): string => {
  return time;
};
