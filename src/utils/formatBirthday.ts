export const formatBirthday = (birthDate: string | null): string => {
  if (!birthDate) return '';
  
  const [datePart] = birthDate.split('T');
  const [year, month, day] = datePart.split('-');
  
  if (!year || !month || !day) return '';
  
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
};

export const getMonthName = (): string => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[new Date().getMonth()];
};

