export interface Template {
  id: string;
  nome: string;
  texto: string;
  ativo: boolean;
  padrao: boolean;
}

const STORAGE_KEY = 'birthday_templates';

const defaultTemplates: Template[] = [
  {
    id: '1',
    nome: 'Parabéns Simples',
    texto: 'Olá {nome}! 🎉 Feliz aniversário! Desejamos um dia maravilhoso!',
    ativo: true,
    padrao: true
  },
  {
    id: '2',
    nome: 'Cupom 20% OFF',
    texto: 'Parabéns {nome}! 🎂 Ganhe 20% de desconto no seu aniversário! Válido até {data}. 🎁',
    ativo: true,
    padrao: false
  }
];

export const getTemplates = (): Template[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      saveTemplates(defaultTemplates);
      return defaultTemplates;
    }
    return JSON.parse(stored);
  } catch {
    return defaultTemplates;
  }
};

export const saveTemplates = (templates: Template[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Erro ao salvar templates:', error);
  }
};

export const addTemplate = (template: Omit<Template, 'id'>): Template => {
  const templates = getTemplates();
  const newTemplate: Template = {
    ...template,
    id: Date.now().toString()
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  return newTemplate;
};

export const updateTemplate = (id: string, updates: Partial<Template>): void => {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === id);
  if (index !== -1) {
    templates[index] = { ...templates[index], ...updates };
    saveTemplates(templates);
  }
};

export const deleteTemplate = (id: string): void => {
  const templates = getTemplates();
  const filtered = templates.filter(t => t.id !== id);
  saveTemplates(filtered);
};

export const setDefaultTemplate = (id: string): void => {
  const templates = getTemplates();
  templates.forEach(t => {
    t.padrao = t.id === id;
  });
  saveTemplates(templates);
};

export const getDefaultTemplate = (): Template | null => {
  const templates = getTemplates();
  return templates.find(t => t.padrao && t.ativo) || templates.find(t => t.ativo) || null;
};

export const getActiveTemplates = (): Template[] => {
  return getTemplates().filter(t => t.ativo);
};

