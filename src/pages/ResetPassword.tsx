import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    // Verificar se há um token de recuperação na URL hash
    const checkRecoveryToken = async () => {
      try {
        // O Supabase processa automaticamente o hash da URL quando há um token
        // Verificamos se há uma sessão válida (criada pelo token de recuperação)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Verificar também se há um token no hash da URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        // Se não houver token no hash e não houver sessão, o link é inválido
        if (!accessToken && !session) {
          setError('Link inválido ou expirado. Por favor, solicite um novo link de recuperação.');
          setIsValidating(false);
          return;
        }

        // Se houver token no hash mas ainda não processado, aguardar um pouco
        if (accessToken && type === 'recovery' && !session) {
          // Aguardar o Supabase processar o token
          setTimeout(async () => {
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (!newSession) {
              setError('Link inválido ou expirado. Por favor, solicite um novo link de recuperação.');
            }
            setIsValidating(false);
          }, 1000);
        } else {
          setIsValidating(false);
        }
      } catch (err) {
        setError('Erro ao validar o link. Por favor, tente novamente.');
        setIsValidating(false);
      }
    };

    checkRecoveryToken();
  }, []);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!password || !confirmPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não correspondem. Por favor, verifique e tente novamente.');
      return;
    }

    setIsLoading(true);

    try {
      // Atualizar a senha usando o Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || 'Erro ao redefinir a senha. Tente novamente.');
        setIsLoading(false);
        return;
      }

      // Sucesso
      setIsSuccess(true);
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Sua senha foi alterada. Redirecionando para o login...',
      });

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#C084FC] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        <Card className="border border-[#FBCFE8] shadow-xl bg-white/95 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-[#F472B6] to-[#9333EA] flex items-center justify-center shadow-lg">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-[#1f2937]">
                Redefinir senha
              </CardTitle>
              <CardDescription className="text-sm text-[#4b5563] mt-2">
                Digite sua nova senha abaixo
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {isValidating ? (
              <div className="text-center py-4">
                <p className="text-sm text-[#4b5563]">Validando link de recuperação...</p>
              </div>
            ) : isSuccess ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 font-medium">
                  Senha redefinida com sucesso! Redirecionando para o login...
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold">
                      Nova senha
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                      minLength={8}
                      className="h-11 rounded-xl border-[#F9A8D4] focus-visible:ring-[#F472B6]"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                      Confirmar senha
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Digite a senha novamente"
                      required
                      minLength={8}
                      className="h-11 rounded-xl border-[#F9A8D4] focus-visible:ring-[#F472B6]"
                      disabled={isLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF69B4] via-[#F472B6] to-[#9B59B6] text-white font-semibold shadow-lg shadow-[#F9A8D4]/60 hover:from-[#F472B6] hover:via-[#EC4899] hover:to-[#8B5CF6] transition-all duration-200 border-0"
                  >
                    {isLoading ? 'Alterando senha...' : 'Alterar senha'}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-sm font-semibold text-[#F472B6] hover:text-[#d45594] transition-colors"
                  >
                    Voltar para o login
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;

