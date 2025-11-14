export const normalizePhone = (phone: string | null | undefined) => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

export const formatPhone = (phone: string | null | undefined) => {
  const digits = normalizePhone(phone);

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length === 9) {
    return digits.replace(/(\d{5})(\d{4})/, '$1-$2');
  }

  if (digits.length === 8) {
    return digits.replace(/(\d{4})(\d{4})/, '$1-$2');
  }

  return phone || '';
};


