export const formatDateForDisplay = (value?: string | null) => {
  if (!value) return '-';

  const [datePart] = value.split('T');
  const [year, month, day] = datePart.split('-');

  if (!year || !month || !day) return '-';

  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};



