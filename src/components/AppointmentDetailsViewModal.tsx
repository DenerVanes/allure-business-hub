import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Scissors, DollarSign, CreditCard, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

interface AppointmentDetailsViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  transactionId?: string | null;
}

interface PaymentDetails {
  id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  payment_methods: {
    id: string;
    name: string;
    has_fee: boolean;
    fee_percentage: number;
  };
}

export const AppointmentDetailsViewModal = ({ 
  open, 
  onOpenChange, 
  appointmentId,
  transactionId
}: AppointmentDetailsViewModalProps) => {
  // Buscar dados do agendamento (se houver)
  const { data: appointment, isLoading: isLoadingAppointment } = useQuery({
    queryKey: ['appointment-details', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services (
            id,
            name,
            price,
            duration,
            service_categories (
              name
            )
          ),
          clients (
            id,
            name,
            phone
          )
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId && open
  });

  // Buscar dados da transação financeira (se for receita manual)
  const { data: transaction, isLoading: isLoadingTransaction } = useQuery({
    queryKey: ['transaction-details', transactionId],
    queryFn: async () => {
      if (!transactionId) return null;

      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!transactionId && open
  });

  // Buscar pagamentos do agendamento
  const { data: appointmentPayments = [] } = useQuery<PaymentDetails[]>({
    queryKey: ['appointment-payments', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return [];

      const { data, error } = await supabase
        .from('appointment_payments')
        .select(`
          *,
          payment_methods (
            id,
            name,
            has_fee,
            fee_percentage
          )
        `)
        .eq('appointment_id', appointmentId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!appointmentId && open
  });

  // Buscar pagamentos da transação financeira (receita manual)
  const { data: transactionPayments = [] } = useQuery<PaymentDetails[]>({
    queryKey: ['transaction-payments', transactionId],
    queryFn: async () => {
      if (!transactionId) return [];

      const { data, error } = await supabase
        .from('transaction_payments')
        .select(`
          *,
          payment_methods (
            id,
            name,
            has_fee,
            fee_percentage
          )
        `)
        .eq('transaction_id', transactionId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!transactionId && open
  });

  const payments = appointmentId ? appointmentPayments : transactionPayments;
  const isLoading = isLoadingAppointment || isLoadingTransaction;
  const isManualTransaction = !!transactionId && !appointmentId;

  if (!open || (!appointmentId && !transactionId)) return null;

  // Calcular totais dos pagamentos
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalFees = payments.reduce((sum, p) => sum + Number(p.fee_amount), 0);
  const totalNet = payments.reduce((sum, p) => sum + Number(p.net_amount), 0);

  // Para receitas manuais: se houver pagamentos, usar valor bruto dos pagamentos. Senão, usar valor da transação
  const originalAmount = isManualTransaction 
    ? (totalPaid > 0 ? totalPaid : (transaction?.amount || 0))
    : (appointment?.services?.price || appointment?.total_amount || 0);
  const finalAmount = isManualTransaction 
    ? (totalPaid > 0 ? totalPaid : (transaction?.amount || 0))
    : (appointment?.total_amount || originalAmount);
  const discountAmount = originalAmount - finalAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isManualTransaction ? 'Detalhes da Receita' : 'Detalhes do Atendimento'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando...
          </div>
        ) : (!appointment && !transaction) ? (
          <div className="py-8 text-center text-muted-foreground">
            {isManualTransaction ? 'Transação não encontrada.' : 'Agendamento não encontrado.'}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {isManualTransaction ? (
              /* Receita Manual */
              <>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold">Detalhes da Receita</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Descrição:</span>
                      <p className="text-base font-semibold mt-1">{transaction?.description}</p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Categoria:</span>
                      <p className="text-base font-semibold mt-1">{transaction?.category}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Data:</span>
                      <span className="font-semibold">
                        {transaction?.transaction_date && format(parseISO(transaction.transaction_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>

                    <Separator />

                    {totalPaid > 0 ? (
                      /* Se houver formas de pagamento, mostrar valor bruto */
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Valor Bruto:</span>
                          <span className="font-semibold">{formatCurrency(totalPaid)}</span>
                        </div>
                        {totalFees > 0 && (
                          <div className="flex justify-between items-center text-sm text-orange-600">
                            <span>Total de Taxas:</span>
                            <span className="font-medium">- {formatCurrency(totalFees)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center text-lg">
                          <span className="font-semibold">Valor Líquido Recebido:</span>
                          <span className="font-bold text-green-600">{formatCurrency(totalNet)}</span>
                        </div>
                      </div>
                    ) : (
                      /* Se não houver formas de pagamento, mostrar apenas o valor da transação */
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Valor Recebido:</span>
                        <span className="font-bold text-purple-600">{formatCurrency(transaction?.amount || 0)}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </>
            ) : (
              /* Agendamento */
              <>
                {/* Informações do Cliente e Serviço */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Cliente</span>
                    </div>
                    <p className="text-base font-semibold">{appointment?.client_name || appointment?.clients?.name || 'Não informado'}</p>
                    {appointment?.clients?.phone && (
                      <p className="text-sm text-muted-foreground mt-1">{appointment.clients.phone}</p>
                    )}
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Scissors className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Serviço</span>
                    </div>
                    <p className="text-base font-semibold">{appointment?.services?.name || 'Não informado'}</p>
                    {appointment?.services?.service_categories?.name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {appointment.services.service_categories.name}
                      </p>
                    )}
                  </Card>
                </div>

                {/* Data e Horário */}
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Data:</span>
                      <span className="font-semibold">
                        {appointment?.appointment_date && format(new Date(appointment.appointment_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Horário:</span>
                      <span className="font-semibold">
                        {appointment?.appointment_time?.split(':').slice(0, 2).join(':')}
                        {appointment?.services?.duration && (() => {
                          const [hours, minutes] = appointment.appointment_time.split(':').map(Number);
                          const startTime = new Date();
                          startTime.setHours(hours, minutes, 0);
                          const endTime = new Date(startTime);
                          endTime.setMinutes(endTime.getMinutes() + appointment.services.duration);
                          return ` - ${format(endTime, 'HH:mm')}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </Card>

                <Separator />

                {/* Valores */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor Original:</span>
                    <span className="font-semibold">{formatCurrency(originalAmount)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-sm">Desconto:</span>
                      <span className="font-semibold">- {formatCurrency(discountAmount)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Valor Final:</span>
                    <span className="font-bold text-purple-600">{formatCurrency(finalAmount)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Formas de Pagamento */}
            {payments.length > 0 && (
              <>
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold">Formas de Pagamento</h3>
                  </div>

                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <Card key={payment.id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {payment.payment_methods?.name || 'Não informado'}
                            </span>
                            <span className="font-semibold">
                              {formatCurrency(Number(payment.amount))}
                            </span>
                          </div>

                          {payment.fee_amount > 0 && (
                            <>
                              <div className="flex justify-between items-center text-sm text-orange-600">
                                <span>Taxa ({payment.payment_methods?.fee_percentage}%):</span>
                                <span>- {formatCurrency(Number(payment.fee_amount))}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm font-medium text-green-600">
                                <span>Valor Líquido:</span>
                                <span>{formatCurrency(Number(payment.net_amount))}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Resumo dos Pagamentos */}
                  {payments.length > 1 && (
                    <Card className="p-4 bg-muted/50">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span>Total Pago:</span>
                          <span className="font-medium">{formatCurrency(totalPaid)}</span>
                        </div>
                        {totalFees > 0 && (
                          <div className="flex justify-between items-center text-sm text-orange-600">
                            <span>Total de Taxas:</span>
                            <span className="font-medium">- {formatCurrency(totalFees)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center font-bold text-green-600">
                          <span>Valor Líquido Recebido:</span>
                          <span>{formatCurrency(totalNet)}</span>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </>
            )}

            {/* Status - Apenas para agendamentos */}
            {!isManualTransaction && appointment && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  <Badge 
                    className={
                      appointment.status === 'finalizado' 
                        ? 'bg-green-500/10 text-green-700 border-green-500/30' 
                        : appointment.status === 'confirmado'
                        ? 'bg-blue-500/10 text-blue-700 border-blue-500/30'
                        : appointment.status === 'cancelado'
                        ? 'bg-red-500/10 text-red-700 border-red-500/30'
                        : 'bg-purple-500/10 text-purple-700 border-purple-500/30'
                    }
                  >
                    {appointment.status === 'finalizado' ? 'Finalizado' :
                     appointment.status === 'confirmado' ? 'Confirmado' :
                     appointment.status === 'cancelado' ? 'Cancelado' : 'Agendado'}
                  </Badge>
                </div>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

