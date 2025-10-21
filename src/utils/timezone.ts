
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Converte data/hora do Supabase para timezone do Brasil
export const convertToLocalTime = (dateString: string): Date => {
  const date = parseISO(dateString);
  // Ajustar para o fuso horário do Brasil (UTC-3)
  const brazilOffset = -3 * 60; // -3 horas em minutos
  const localOffset = date.getTimezoneOffset();
  const totalOffset = brazilOffset + localOffset;
  return new Date(date.getTime() + (totalOffset * 60000));
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

// Obtém a data atual no fuso horário brasileiro
export const getBrazilianDate = (): Date => {
  const now = new Date();
  // Ajustar para o fuso horário do Brasil (UTC-3)
  const brazilOffset = -3 * 60; // -3 horas em minutos
  const localOffset = now.getTimezoneOffset();
  const totalOffset = brazilOffset + localOffset;
  return new Date(now.getTime() + (totalOffset * 60000));
};

// Formata data de transação financeira para exibição brasileira
export const formatTransactionDate = (dateString: string): string => {
  const date = convertToLocalTime(dateString);
  return formatToBrazilianDate(date);
};
