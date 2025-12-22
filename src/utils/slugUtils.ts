/**
 * Gera um slug amigável para URLs a partir de uma string
 * Exemplo: "Salon Line" -> "salon-line"
 */
export const generateSlug = (text: string): string => {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .normalize('NFD') // Normaliza caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais exceto espaços e hífens
    .trim()
    .replace(/\s+/g, '-') // Substitui espaços por hífen
    .replace(/-+/g, '-') // Remove múltiplos hífens consecutivos
    .replace(/^-|-$/g, ''); // Remove hífens no início/fim
};

/**
 * Gera um slug único adicionando um sufixo numérico se necessário
 */
export const generateUniqueSlug = async (
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxAttempts: number = 10
): Promise<string> => {
  let slug = generateSlug(baseSlug);
  
  // Se o slug base já for único, retorna
  const exists = await checkExists(slug);
  if (!exists) return slug;
  
  // Tenta adicionar sufixos numéricos
  for (let i = 1; i <= maxAttempts; i++) {
    const candidate = `${slug}-${i}`;
    const candidateExists = await checkExists(candidate);
    if (!candidateExists) return candidate;
  }
  
  // Se todos os sufixos falharem, adiciona timestamp
  return `${slug}-${Date.now().toString(36).slice(-6)}`;
};

