export const formatPhoneForWhatsApp = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `55${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `55${cleaned}`;
  }
  return cleaned;
};

