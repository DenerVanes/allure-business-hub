import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConfirmWithClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceName: string;
  appointmentId: string;
  onMessageSent?: () => void;
  defaultMessage?: string;
  storageKeySuffix?: string;
}

const DEFAULT_MESSAGE_TOMORROW = `Olá, {cliente}! 💜
Gostaríamos de confirmar seu agendamento para amanhã, às {horário}, para {serviço}.

Ficaremos felizes em recebê-la 💫
Podemos confirmar sua presença?`;

const DEFAULT_MESSAGE_TODAY = `Oi, {cliente}! 🌷
Tudo bem? Estou passando rapidinho para confirmar seu atendimento hoje às {horário}, para {serviço}.
Já está tudo prontinho por aqui 💕 Pode me confirmar sua presença, por favor? 😊`;

const STORAGE_KEY_PREFIX = 'whatsapp_confirmation_message_';
const STORAGE_KEY_PREFIX_TODAY = 'whatsapp_confirmation_message_today_';
const SENT_MESSAGES_KEY = 'whatsapp_confirmation_sent_';

export const ConfirmWithClientModal = ({
  open,
  onOpenChange,
  clientName,
  clientPhone,
  appointmentDate,
  appointmentTime,
  serviceName,
  appointmentId,
  onMessageSent,
  defaultMessage,
  storageKeySuffix = '',
}: ConfirmWithClientModalProps) => {
  const { user } = useAuth();
  const finalDefaultMessage = defaultMessage || DEFAULT_MESSAGE_TOMORROW;
  const storageKey = storageKeySuffix 
    ? `${STORAGE_KEY_PREFIX_TODAY}${storageKeySuffix}${user?.id || ''}`
    : `${STORAGE_KEY_PREFIX}${user?.id || ''}`;
  
  const [message, setMessage] = useState(finalDefaultMessage);
  const [isEditing, setIsEditing] = useState(false);

  // Carregar mensagem salva
  useEffect(() => {
    if (user?.id && open) {
      const savedMessage = localStorage.getItem(storageKey);
      if (savedMessage) {
        setMessage(savedMessage);
      } else {
        setMessage(finalDefaultMessage);
      }
    }
  }, [user?.id, open, storageKey, finalDefaultMessage]);

  // Formatizar mensagem com placeholders
  const formatMessage = (template: string): string => {
    // Formatar data do agendamento
    const appointmentDateObj = new Date(appointmentDate + 'T00:00:00');
    const formattedDate = format(appointmentDateObj, "dd/MM/yyyy", { locale: ptBR });
    
    return template
      .replace(/{cliente}/g, clientName)
      .replace(/{horário}/g, appointmentTime)
      .replace(/{serviço}/g, serviceName)
      .replace(/amanhã/gi, formattedDate) // Substituir "amanhã" pela data formatada do agendamento
      .replace(/hoje/gi, 'hoje'); // Manter "hoje" como está na mensagem
  };

  // Salvar mensagem padrão
  const handleSaveMessage = () => {
    if (user?.id) {
      localStorage.setItem(storageKey, message);
      setIsEditing(false);
    }
  };

  // Abrir WhatsApp Web
  const handleOpenWhatsApp = () => {
    const formattedMessage = formatMessage(message);
    const encodedMessage = encodeURIComponent(formattedMessage);
    // Remover caracteres não numéricos do telefone
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    
    // Salvar mensagem se estava editando
    if (isEditing) {
      handleSaveMessage();
    }
    
    // Marcar que a mensagem foi enviada
    if (user?.id) {
      const sentMessagesKey = `${SENT_MESSAGES_KEY}${user.id}`;
      const sentMessages = JSON.parse(localStorage.getItem(sentMessagesKey) || '[]');
      if (!sentMessages.includes(appointmentId)) {
        sentMessages.push(appointmentId);
        localStorage.setItem(sentMessagesKey, JSON.stringify(sentMessages));
      }
    }
    
    // Notificar que a mensagem foi enviada
    if (onMessageSent) {
      onMessageSent();
    }
    
    // Não confirmar agendamento automaticamente - apenas fechar o modal
    // O usuário deve confirmar manualmente após receber a resposta do cliente
    onOpenChange(false);
  };

  const finalMessage = formatMessage(message);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Confirmar Agendamento via WhatsApp</DialogTitle>
          <DialogDescription>
            Configure sua mensagem padrão de confirmação e envie para o cliente via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Mensagem de Confirmação</Label>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Editar
                </Button>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder={finalDefaultMessage}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveMessage} size="sm">
                    Salvar Mensagem
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMessage(finalDefaultMessage);
                      setIsEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use os placeholders: {'{cliente}'}, {'{horário}'}, {'{serviço}'}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm">
                {finalMessage}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleOpenWhatsApp}
              className="bg-[#25D366] hover:bg-[#20BA5A] text-white"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Abrir WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

