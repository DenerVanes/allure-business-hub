export interface PromocaoAniversario {
  ativa: boolean;
  percentualDesconto: number;
  nomeCupom: string;
  dataInicio: string;
  dataFim: string;
  gerarCupomAutomatico: boolean;
  prefixoCupom: string;
  validoApenasNoMes: boolean;
  umUsoPorCliente: boolean;
  enviarPorWhatsApp: boolean;
  limiteCuponsAtivo: boolean;
  limiteCupons: number;
}

export interface CupomMes {
  codigo: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  percentualDesconto: number;
  dataGeracao: string;
  utilizado: boolean; // DEPRECADO: mantido para compatibilidade, usar usosPorTelefone
  dataUtilizacao: string | null; // DEPRECADO: mantido para compatibilidade
  agendamentoId: string | null; // DEPRECADO: mantido para compatibilidade
  status?: 'ativo' | 'pausado' | 'cancelado'; // Novo: status do cupom
  usosPorTelefone?: Array<{ // Novo: rastreia quais telefones já usaram o cupom
    telefone: string;
    dataUtilizacao: string;
    agendamentoId: string;
  }>;
}

// Funções auxiliares para gerar chaves com user_id
const getPromocaoStorageKey = (userId?: string) => {
  return userId ? `promocao_aniversario_${userId}` : 'promocao_aniversario';
};

const getCuponsStorageKey = (userId?: string) => {
  return userId ? `cupons_aniversario_mes_${userId}` : 'cupons_aniversario_mes';
};

const defaultPromocao: PromocaoAniversario = {
  ativa: false,
  percentualDesconto: 15,
  nomeCupom: 'NIVER15',
  dataInicio: new Date().toISOString().split('T')[0],
  dataFim: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  gerarCupomAutomatico: false,
  prefixoCupom: 'NIVER',
  validoApenasNoMes: true,
  umUsoPorCliente: true,
  enviarPorWhatsApp: false,
  limiteCuponsAtivo: false,
  limiteCupons: 0
};

export const getPromocao = (userId?: string): PromocaoAniversario => {
  try {
    const key = getPromocaoStorageKey(userId);
    const stored = localStorage.getItem(key);
    if (!stored) {
      const defaultPromo = defaultPromocao;
      savePromocao(defaultPromo, userId);
      return defaultPromo;
    }
    return JSON.parse(stored);
  } catch {
    return defaultPromocao;
  }
};

export const savePromocao = (promocao: PromocaoAniversario, userId?: string): void => {
  try {
    const key = getPromocaoStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(promocao));
  } catch (error) {
    console.error('Erro ao salvar promoção:', error);
  }
};

export const getCupons = (userId?: string): CupomMes[] => {
  try {
    const key = getCuponsStorageKey(userId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveCupons = (cupons: CupomMes[], userId?: string): void => {
  try {
    const key = getCuponsStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(cupons));
  } catch (error) {
    console.error('Erro ao salvar cupons:', error);
  }
};

export const generateCupomCode = (prefixo: string, nomeCliente: string): string => {
  const nomeLimpo = nomeCliente
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '-')
    .substring(0, 15);
  return `${prefixo}-${nomeLimpo}`;
};

export const generateCuponsForClients = (
  clientes: Array<{ id: string; name: string; phone: string }>,
  promocao: PromocaoAniversario
): CupomMes[] => {
  const now = new Date().toISOString();
  
  if (!promocao.gerarCupomAutomatico) {
    // Cupom único para todos
    return [{
      codigo: promocao.nomeCupom,
      clienteId: '',
      clienteNome: 'Todos os clientes',
      clienteTelefone: '',
      percentualDesconto: promocao.percentualDesconto,
      dataGeracao: now,
      utilizado: false,
      dataUtilizacao: null,
      agendamentoId: null,
      usosPorTelefone: []
    }];
  }
  
  // Cupons personalizados por cliente
  const cupons: CupomMes[] = clientes.map(cliente => {
    const codigo = generateCupomCode(promocao.prefixoCupom, cliente.name);

    return {
      codigo,
      clienteId: cliente.id,
      clienteNome: cliente.name,
      clienteTelefone: cliente.phone,
      percentualDesconto: promocao.percentualDesconto,
      dataGeracao: now,
      utilizado: false,
      dataUtilizacao: null,
      agendamentoId: null,
      usosPorTelefone: []
    };
  });

  return cupons;
};

export const validateCupom = (
  codigo: string,
  promocao: PromocaoAniversario,
  cupons: CupomMes[],
  clienteTelefone?: string,
  clienteNome?: string
): { valid: boolean; error?: string; cupom?: CupomMes } => {
  if (!promocao.ativa) {
    return { valid: false, error: 'Promoção não está ativa' };
  }

  const hoje = new Date();
  const inicio = new Date(promocao.dataInicio);
  const fim = new Date(promocao.dataFim);

  if (hoje < inicio) {
    return { valid: false, error: 'Promoção ainda não iniciou' };
  }

  if (hoje > fim) {
    return { valid: false, error: 'Promoção expirou' };
  }

  const cupom = cupons.find(c => c.codigo === codigo.toUpperCase());

  if (!cupom) {
    return { valid: false, error: 'Cupom inválido' };
  }

  // Nova lógica: verificar se este telefone específico já usou o cupom
  if (promocao.umUsoPorCliente && clienteTelefone) {
    const telefoneNormalizado = clienteTelefone.replace(/\D/g, '');
    const usosPorTelefone = cupom.usosPorTelefone || [];
    
    // Verificar se este telefone já usou o cupom no período vigente
    const jaUsou = usosPorTelefone.some(uso => {
      const telefoneUsoNormalizado = uso.telefone.replace(/\D/g, '');
      if (telefoneUsoNormalizado !== telefoneNormalizado) return false;
      
      // Verificar se o uso foi dentro do período da promoção
      const dataUso = new Date(uso.dataUtilizacao);
      return dataUso >= inicio && dataUso <= fim;
    });
    
    if (jaUsou) {
      return { valid: false, error: 'Cupom já foi utilizado por este cliente' };
    }
  }

  // Verificar se cupom é personalizado e se o telefone corresponde
  // (Apenas se for cupom personalizado, não cupom único)
  // Cupom único não tem clienteTelefone preenchido, então não faz essa validação
  if (promocao.gerarCupomAutomatico && cupom.clienteTelefone && cupom.clienteTelefone.trim() !== '' && clienteTelefone) {
    const telefoneNormalizado = clienteTelefone.replace(/\D/g, '');
    const cupomTelefoneNormalizado = cupom.clienteTelefone.replace(/\D/g, '');
    if (telefoneNormalizado !== cupomTelefoneNormalizado) {
      return { valid: false, error: 'Cupom não é válido para este cliente' };
    }
  }

  // Verificar validade no mês (se configurado)
  if (promocao.validoApenasNoMes) {
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    
    // Verificar se estamos no período válido (mês da promoção)
    const mesInicio = inicio.getMonth();
    const mesFim = fim.getMonth();
    
    // Se o mês atual não está dentro do período, rejeitar
    if (mesAtual < mesInicio || mesAtual > mesFim) {
      return { valid: false, error: 'Cupom válido apenas no período da promoção' };
    }
  }

  return { valid: true, cupom };
};

export const markCupomAsUsed = (
  codigo: string,
  agendamentoId: string,
  clienteTelefone: string,
  userId?: string
): void => {
  const cupons = getCupons(userId);
  const cupom = cupons.find(c => c.codigo === codigo.toUpperCase());
  if (cupom) {
    // Inicializar array se não existir
    if (!cupom.usosPorTelefone) {
      cupom.usosPorTelefone = [];
    }
    
    // Adicionar uso para este telefone
    cupom.usosPorTelefone.push({
      telefone: clienteTelefone,
      dataUtilizacao: new Date().toISOString(),
      agendamentoId: agendamentoId
    });
    
    // Manter compatibilidade com versão antiga
    cupom.utilizado = true;
    cupom.dataUtilizacao = new Date().toISOString();
    cupom.agendamentoId = agendamentoId;
    
    saveCupons(cupons, userId);
  }
};

export const getCupomByClienteId = (clienteId: string, userId?: string): CupomMes | null => {
  const cupons = getCupons(userId);
  return cupons.find(c => c.clienteId === clienteId) || null;
};

export const getCupomByClienteTelefone = (telefone: string, userId?: string): CupomMes | null => {
  const cupons = getCupons(userId);
  const telefoneNormalizado = telefone.replace(/\D/g, '');
  return cupons.find(c => {
    const cupomTelefoneNormalizado = c.clienteTelefone.replace(/\D/g, '');
    return cupomTelefoneNormalizado === telefoneNormalizado;
  }) || null;
};

