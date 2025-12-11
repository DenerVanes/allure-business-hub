import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PromotionData {
  ativa: boolean;
  percentual_desconto: number;
  nome_cupom: string;
  data_inicio: string;
  data_fim: string;
  gerar_cupom_automatico: boolean;
  prefixo_cupom: string;
  valido_apenas_no_mes: boolean;
  um_uso_por_cliente: boolean;
  enviar_por_whatsapp: boolean;
  limite_cupons_ativo?: boolean;
  limite_cupons?: number;
}

// Sincronizar promoção do localStorage para o backend
export const syncPromotionToBackend = async (userId: string, promotion: PromotionData) => {
  try {
    console.log('🔄 Sincronizando promoção para o backend:', {
      userId,
      promotion,
      nome_cupom: promotion.nome_cupom
    });

    // Buscar promoção existente
    const { data: existing, error: fetchError } = await supabase
      .from('promotions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erro ao buscar promoção existente:', fetchError);
      throw fetchError;
    }

    if (existing) {
      // Atualizar
      console.log('📝 Atualizando promoção existente:', existing.id);
      const { error } = await supabase
        .from('promotions')
        .update(promotion)
        .eq('id', existing.id);

      if (error) {
        console.error('❌ Erro ao atualizar promoção:', error);
        throw error;
      }
      console.log('✅ Promoção atualizada com sucesso');
      return existing.id;
    } else {
      // Criar
      console.log('➕ Criando nova promoção no backend');
      const { data, error } = await supabase
        .from('promotions')
        .insert({
          user_id: userId,
          ...promotion
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Erro ao criar promoção:', error);
        throw error;
      }
      console.log('✅ Promoção criada com sucesso:', data.id);
      return data.id;
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar promoção:', error);
    throw error;
  }
};

// Buscar promoção do backend
export const getPromotionFromBackend = async (userId: string): Promise<PromotionData | null> => {
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data as PromotionData | null;
  } catch (error) {
    console.error('Erro ao buscar promoção:', error);
    return null;
  }
};

// Validar cupom no backend (chamada RPC)
export const validateCouponOnBackend = async (
  userId: string,
  codigoCupom: string,
  clienteTelefone: string,
  valorOriginal: number
) => {
  try {
    const { data, error } = await supabase.rpc('validate_and_use_coupon', {
      p_user_id: userId,
      p_codigo_cupom: codigoCupom,
      p_cliente_telefone: clienteTelefone,
      p_valor_original: valorOriginal,
      p_appointment_id: null
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Erro ao validar cupom:', error);
    throw error;
  }
};

