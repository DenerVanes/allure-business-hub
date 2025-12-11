import { useState } from 'react';
import { Tag, CheckCircle, XCircle, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import {
  validateCupom,
  getPromocao,
  getCupons,
  type CupomMes
} from '@/utils/promotionStorage';
import { syncPromotionToBackend } from '@/utils/promotionApi';

interface CouponInputProps {
  value: string;
  onChange: (value: string) => void;
  onApply: (cupom: CupomMes, desconto: number) => void;
  clienteTelefone?: string;
  clienteNome?: string;
  clienteBirthDate?: string; // Data de nascimento no formato dd/mm/aaaa
  valorServico: number;
  userId: string; // user_id necessário para validar no backend
}

export const CouponInput = ({
  value,
  onChange,
  onApply,
  clienteTelefone,
  clienteNome,
  clienteBirthDate,
  valorServico,
  userId
}: CouponInputProps) => {
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
    debug?: string;
    cupom?: CupomMes;
    percentual?: number;
    desconto?: number;
    valorFinal?: number;
  } | null>(null);

  const handleValidate = async () => {
    if (!value.trim()) {
      setValidationResult(null);
      return;
    }

    // Validar telefone antes de validar cupom
    if (!clienteTelefone || clienteTelefone.replace(/\D/g, '').length < 10) {
      setValidationResult({
        valid: false,
        error: 'Preencha o telefone antes de aplicar o cupom'
      });
      return;
    }

    // Validar data de nascimento antes de validar cupom
    if (!clienteBirthDate || clienteBirthDate.length !== 10) {
      setValidationResult({
        valid: false,
        error: 'Preencha a data de nascimento antes de aplicar o cupom'
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      // Converter data de dd/mm/aaaa para yyyy-MM-dd (formato ISO)
      const [day, month, year] = clienteBirthDate.split('/');
      const isoBirthDate = `${year}-${month}-${day}`;

      // ANTES de validar, garantir que a promoção está sincronizada no backend
      const promocaoLocal = getPromocao();
      if (promocaoLocal.ativa) {
        try {
          console.log('🔄 Verificando sincronização da promoção...');
          await syncPromotionToBackend(userId, {
            ativa: promocaoLocal.ativa,
            percentual_desconto: promocaoLocal.percentualDesconto,
            nome_cupom: promocaoLocal.nomeCupom,
            data_inicio: promocaoLocal.dataInicio,
            data_fim: promocaoLocal.dataFim,
            gerar_cupom_automatico: promocaoLocal.gerarCupomAutomatico,
            prefixo_cupom: promocaoLocal.prefixoCupom || '',
            valido_apenas_no_mes: promocaoLocal.validoApenasNoMes,
            um_uso_por_cliente: promocaoLocal.umUsoPorCliente,
            enviar_por_whatsapp: promocaoLocal.enviarPorWhatsApp
          });
          console.log('✅ Promoção sincronizada');
        } catch (syncError) {
          console.warn('⚠️ Erro ao sincronizar promoção (continuando validação):', syncError);
          // Continuar mesmo se a sincronização falhar
        }
      }

      // Validar cupom no backend usando RPC
      const normalizedPhone = clienteTelefone.replace(/\D/g, '');
      const { data: cupomValidation, error: cupomError } = await supabase
        .rpc('validate_coupon_only', {
          p_user_id: userId,
          p_codigo_cupom: value.trim().toUpperCase(),
          p_cliente_telefone: normalizedPhone,
          p_valor_original: valorServico,
          p_cliente_birth_date: isoBirthDate // Passar data de nascimento
        });

      if (cupomError) {
        console.error('❌ Erro ao validar cupom:', cupomError);
        setValidationResult({
          valid: false,
          error: cupomError.message || 'Erro ao validar cupom'
        });
        // Limpar cupom aplicado quando houver erro
        onApply({} as CupomMes, 0);
        setValidating(false);
        return;
      }

      if (!cupomValidation || !cupomValidation.valid) {
        console.error('❌ Cupom inválido:', {
          validation: cupomValidation,
          error: cupomValidation?.error,
          debug: cupomValidation?.debug,
          codigo: value.trim().toUpperCase(),
          telefone: normalizedPhone,
          birthDate: isoBirthDate,
          userId
        });
        setValidationResult({
          valid: false,
          error: cupomValidation?.error || 'Cupom inválido ou expirado',
          debug: cupomValidation?.debug
        });
        // Limpar cupom aplicado quando inválido
        onApply({} as CupomMes, 0);
        setValidating(false);
        return;
      }

      console.log('✅ Cupom válido:', {
        validation: cupomValidation,
        debug: cupomValidation?.debug
      });

      // Se cupom é válido, criar objeto cupom para compatibilidade
      const cupom: CupomMes = {
        codigo: value.trim().toUpperCase(),
        clienteId: '',
        clienteNome: clienteNome || '',
        clienteTelefone: normalizedPhone,
        percentualDesconto: cupomValidation.percentual || 0,
        dataGeracao: new Date().toISOString(),
        utilizado: false,
        dataUtilizacao: null,
        agendamentoId: null
      };

      const desconto = parseFloat(cupomValidation.desconto || '0');
      const valorFinal = parseFloat(cupomValidation.valor_final || String(valorServico));

      setValidationResult({
        valid: true,
        cupom,
        percentual: cupomValidation.percentual,
        desconto,
        valorFinal
      });

      // Notificar componente pai sobre cupom aplicado
      onApply(cupom, desconto);
    } catch (error: any) {
      setValidationResult({
        valid: false,
        error: error?.message || 'Erro ao validar cupom'
      });
      // Limpar cupom aplicado quando houver erro
      onApply({} as CupomMes, 0);
    } finally {
      setValidating(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setValidationResult(null);
    // Limpar cupom aplicado passando null ou objeto vazio
    onApply({} as CupomMes, 0);
  };

  const descontoCalculado = validationResult?.desconto || 0;
  const valorFinalCalculado = validationResult?.valorFinal || valorServico;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="cupom">Tem um cupom de desconto?</Label>
        <div className="flex gap-2">
          <Input
            id="cupom"
            value={value}
            onChange={(e) => {
              onChange(e.target.value.toUpperCase());
              setValidationResult(null);
            }}
            placeholder="Digite o código do cupom"
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleValidate}
            disabled={!value.trim() || validating}
            className="bg-green-400 hover:bg-green-500 text-white border-green-400 hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validating ? 'Validando...' : 'Aplicar'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Mostrar erro de cupom apenas aqui, não em outros lugares */}
      {validationResult && !validationResult.valid && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            {validationResult.error || 'Cupom inválido ou expirado'}
          </AlertDescription>
        </Alert>
      )}

      {/* Só mostrar preview se cupom for válido */}
      {validationResult?.valid && validationResult.cupom && (
        <Alert className="bg-blue-50 border-blue-200">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="space-y-2">
              <p className="font-semibold">Cupom válido! Preview do desconto:</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Serviço:</p>
                  <p className="font-semibold">R$ {valorServico.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    Desconto ({validationResult.cupom.codigo}):
                  </p>
                  <p className="font-semibold text-green-600">
                    -R$ {descontoCalculado.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total:</p>
                  <p className="font-bold text-lg text-primary">
                    R$ {valorFinalCalculado.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {validationResult?.valid && validationResult.cupom && (
        <div className="p-4 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Economia: R$ {descontoCalculado.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

