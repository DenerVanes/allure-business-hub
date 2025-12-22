export type PresentationButton = {
  id: string;
  label: string;
  type: 'online' | 'whatsapp' | 'external';
  url?: string | null;
  route?: string | null;
  active: boolean;
  order: number;
};

export type PresentationSocialLinks = {
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  google_maps?: string | null;
};

export const normalizeHexColor = (color?: string | null) => {
  if (!color) return '#9333EA';
  if (/^#([0-9A-Fa-f]{6})$/.test(color)) return color;
  return '#9333EA';
};

export const formatWhatsAppNumber = (number?: string | null) => {
  if (!number) return null;
  const digits = number.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
};

export const buildWhatsAppLink = (number?: string | null) => {
  const formatted = formatWhatsAppNumber(number);
  if (!formatted) return null;
  return `https://wa.me/${formatted}`;
};

export const getDefaultButtons = (slug: string, whatsappNumber?: string | null): PresentationButton[] => {
  const buttons: PresentationButton[] = [
    {
      id: 'online',
      label: 'Agendamento Online',
      type: 'online',
      route: `/agendar/${slug}`,
      active: true,
      order: 0,
    },
  ];

  const waLink = buildWhatsAppLink(whatsappNumber);
  if (waLink) {
    buttons.push({
      id: 'whatsapp',
      label: 'Agendamento WhatsApp',
      type: 'whatsapp',
      url: waLink,
      active: true,
      order: 1,
    });
  }

  return buttons;
};

export const mergeButtons = (
  slug: string,
  customButtons: PresentationButton[] | null | undefined,
  whatsappNumber?: string | null
): PresentationButton[] => {
  const defaults = getDefaultButtons(slug, whatsappNumber);
  const mappedCustom = (customButtons || []).map((btn, idx) => ({
    ...btn,
    order: btn.order ?? idx + defaults.length,
  }));

  // Garantir que o botão online existe e é ativo
  const hasOnline = mappedCustom.some((btn) => btn.type === 'online');
  const combined = hasOnline ? mappedCustom : [...defaults, ...mappedCustom];

  return combined
    .filter((btn) => btn.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const validateHex = (color?: string | null) =>
  !color || /^#([0-9A-Fa-f]{6})$/.test(color);

export const validateUrl = (url?: string | null) => {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

