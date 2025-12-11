import { formatBirthday } from './formatBirthday';

export const replaceVariables = (
  template: string,
  nome: string,
  birthDate: string | null,
  link?: string
): string => {
  let result = template;

  // Substituir {nome}
  result = result.replace(/{nome}/g, nome);

  // Substituir {link} se fornecido
  if (link) {
    result = result.replace(/{link}/g, link);
  }

  // Substituir variáveis de data se birthDate existir
  if (birthDate) {
    const [datePart] = birthDate.split('T');
    const [year, month, day] = datePart.split('-');
    
    const dataFormatada = formatBirthday(birthDate);
    const dia = day || '';
    const mes = month || '';

    result = result
      .replace(/{data}/g, dataFormatada)
      .replace(/{dia}/g, dia)
      .replace(/{mes}/g, mes);
  } else {
    result = result
      .replace(/{data}/g, '')
      .replace(/{dia}/g, '')
      .replace(/{mes}/g, '');
  }

  return result;
};

