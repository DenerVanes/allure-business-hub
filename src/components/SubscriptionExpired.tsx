import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Mail, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SubscriptionExpiredProps {
  trialExpiresAt: string | null;
}

export const SubscriptionExpired = ({ trialExpiresAt }: SubscriptionExpiredProps) => {
  const { signOut } = useAuth();

  const formattedDate = trialExpiresAt 
    ? format(new Date(trialExpiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Assinatura Expirada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Seu período de teste gratuito de 14 dias expirou.
            </p>
            {formattedDate && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Expirou em: {formattedDate}</span>
              </div>
            )}
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-semibold">Para continuar usando a plataforma:</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Entre em contato com nossa equipe de suporte</p>
              <p>• Ative sua assinatura para ter acesso completo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
            <Mail className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Contato de Suporte</p>
              <p className="text-xs text-muted-foreground">
                Envie um e-mail para: suporte@beautyhub.com
              </p>
            </div>
          </div>

          <Button
            onClick={signOut}
            variant="outline"
            className="w-full"
          >
            Sair da Conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

