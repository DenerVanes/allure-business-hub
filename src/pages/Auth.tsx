import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CheckCircle, Eye, EyeOff, Circle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpPassword, setSignUpPassword] = useState('');

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    setForgotEmail(email || '');

    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    // Se login bem-sucedido, o redirecionamento acontece automaticamente via user state
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setShowSuccessMessage(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = signUpPassword || (formData.get('password') as string);
    const businessName = formData.get('businessName') as string;

    const { error } = await signUp(email, password, businessName);
    setIsLoading(false);

    if (!error) {
      // Conta criada com sucesso
      setShowSuccessMessage(true);
      
      // Limpar formulário
      e.currentTarget.reset();
      setSignUpPassword('');
      
      // Mudar para aba de login após 2 segundos
      setTimeout(() => {
        setActiveTab('signin');
        setShowSuccessMessage(false);
      }, 2000);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({
        title: 'Informe um e-mail',
        description: 'Digite o e-mail cadastrado para receber o link.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingReset(true);
    // Sempre usar a URL atual (produção ou desenvolvimento)
    // Se estiver em produção, usar a URL de produção, senão usar localhost
    const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
    const redirectUrl = isProduction 
      ? `${window.location.origin}/reset-password`
      : `${window.location.origin}/reset-password`;
    
    console.log('Enviando email de recuperação:');
    console.log('- Hostname:', window.location.hostname);
    console.log('- Origin:', window.location.origin);
    console.log('- RedirectTo:', redirectUrl);
    console.log('- IsProduction:', isProduction);
    
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: redirectUrl,
    });
    setIsSendingReset(false);

    if (error) {
      toast({
        title: 'Erro ao enviar link',
        description: error.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'E-mail enviado!',
      description: 'Verifique sua caixa de entrada para redefinir a senha.',
    });
    setShowForgotPassword(false);
  };

  // Funções de validação de senha
  const hasNumber = (password: string) => /\d/.test(password);
  const hasLetter = (password: string) => /[a-zA-Z]/.test(password);
  const hasSpecialChar = (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#C084FC] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden min-h-[560px]">
          {/* Left column – Login / Sign up */}
          <div className="w-full lg:w-[40%] px-8 sm:px-10 py-8 sm:py-10 flex flex-col justify-between bg-white">
            <div className="space-y-6">
              {/* Logo + Heading */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#9333EA] flex items-center justify-center shadow-md relative overflow-hidden">
                  {/* Calendário com checkmark - SVG customizado */}
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-white"
                  >
                    {/* Abas do calendário no topo */}
                    <rect x="5" y="3" width="4" height="3" rx="0.5" fill="currentColor" />
                    <rect x="19" y="3" width="4" height="3" rx="0.5" fill="currentColor" />
                    {/* Corpo do calendário */}
                    <rect x="4" y="6" width="20" height="18" rx="2.5" fill="rgba(255,255,255,0.25)" />
                    <rect x="4" y="6" width="20" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
                    {/* Checkmark centralizado */}
                    <path
                      d="M10 14.5L12.5 17L18 11.5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#9333EA] leading-tight mb-1 tracking-tight">
                    Agendaris
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground/80">
                    Plataforma para profissionais da beleza
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Bem-vinda ao seu negócio
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Gerencie seus agendamentos, clientes e receitas em um só lugar.
                </p>
              </div>

              {/* Auth Forms */}
              <Card className="border border-[#FBCFE8] shadow-md">
                <CardHeader className="pb-3">
                  <CardDescription className="text-xs uppercase tracking-[0.2em] text-[#F472B6]">
                    Acesse ou crie sua conta
                  </CardDescription>
                  <CardTitle className="text-lg font-semibold mt-1">
                    Área do salão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2 bg-[#FDF2FF]">
                      <TabsTrigger value="signin">Entrar</TabsTrigger>
                      <TabsTrigger value="signup">Criar conta</TabsTrigger>
                    </TabsList>

                    {/* Sign In Tab */}
                    <TabsContent value="signin" className="space-y-4">
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signin-email" className="text-sm font-semibold">
                            E-mail
                          </Label>
                          <Input
                            id="signin-email"
                            name="email"
                            type="email"
                            placeholder="voce@seusalao.com"
                            required
                            className="h-11 rounded-xl border-[#F9A8D4] focus-visible:ring-[#F472B6]"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signin-password" className="text-sm font-semibold">
                            Senha
                          </Label>
                          <div className="relative">
                            <Input
                              id="signin-password"
                              name="password"
                              type={showSignInPassword ? "text" : "password"}
                              placeholder="Sua senha secreta"
                              required
                              className="h-11 rounded-xl border-[#F9A8D4] focus-visible:ring-[#F472B6] pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignInPassword(!showSignInPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9333EA] hover:text-[#7C3AED] transition-colors"
                              aria-label={showSignInPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {showSignInPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            onClick={() => setShowForgotPassword(true)}
                          >
                            Recuperar senha
                          </button>
                        </div>

                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF69B4] via-[#F472B6] to-[#9B59B6] text-white font-semibold shadow-lg shadow-[#F9A8D4]/60 hover:from-[#F472B6] hover:via-[#EC4899] hover:to-[#8B5CF6] transition-all duration-200 border-0"
                        >
                          {isLoading ? 'Entrando...' : 'Entrar'}
                        </Button>
                      </form>
                    </TabsContent>

                    {/* Sign Up Tab */}
                    <TabsContent value="signup" className="space-y-4">
                      {showSuccessMessage && (
                        <Alert className="bg-green-50 border-green-200">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            Conta criada com sucesso! Redirecionando para login...
                          </AlertDescription>
                        </Alert>
                      )}
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-business" className="text-sm font-semibold">
                            Nome do negócio
                          </Label>
                          <Input
                            id="signup-business"
                            name="businessName"
                            type="text"
                            placeholder="Salão da Maria"
                            required
                            className="h-11 rounded-xl border-[#F9A8D4] focus-visible:ring-[#F472B6]"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-email" className="text-sm font-semibold">
                            E-mail
                          </Label>
                          <Input
                            id="signup-email"
                            name="email"
                            type="email"
                            placeholder="voce@seusalao.com"
                            required
                            className="h-11 rounded-xl border-[#F9A8D4] focus-visible:ring-[#F472B6]"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="signup-password" className="text-sm font-semibold">
                            Senha
                          </Label>
                          <div className="relative">
                            <Input
                              id="signup-password"
                              name="password"
                              type={showSignUpPassword ? "text" : "password"}
                              placeholder="Mínimo 8 caracteres"
                              required
                              minLength={8}
                              value={signUpPassword}
                              onChange={(e) => setSignUpPassword(e.target.value)}
                              className="h-11 rounded-xl border-[#F9A8D4] focus-visible:ring-[#F472B6] pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9333EA] hover:text-[#7C3AED] transition-colors"
                              aria-label={showSignUpPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {showSignUpPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                          {signUpPassword && (
                            <div className="space-y-1.5 mt-2">
                              <div className={`flex items-center gap-2 text-xs transition-colors ${
                                hasNumber(signUpPassword) ? 'text-green-600' : 'text-muted-foreground'
                              }`}>
                                {hasNumber(signUpPassword) ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-muted-foreground" fill="none" />
                                )}
                                <span>Contém número</span>
                              </div>
                              <div className={`flex items-center gap-2 text-xs transition-colors ${
                                hasLetter(signUpPassword) ? 'text-green-600' : 'text-muted-foreground'
                              }`}>
                                {hasLetter(signUpPassword) ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-muted-foreground" fill="none" />
                                )}
                                <span>Contém letra</span>
                              </div>
                              <div className={`flex items-center gap-2 text-xs transition-colors ${
                                hasSpecialChar(signUpPassword) ? 'text-green-600' : 'text-muted-foreground'
                              }`}>
                                {hasSpecialChar(signUpPassword) ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-muted-foreground" fill="none" />
                                )}
                                <span>Contém caractere especial</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF69B4] via-[#F472B6] to-[#9B59B6] text-white font-semibold shadow-lg shadow-[#F9A8D4]/60 hover:from-[#F472B6] hover:via-[#EC4899] hover:to-[#8B5CF6] transition-all duration-200 border-0"
                        >
                          {isLoading ? 'Criando conta...' : 'Criar conta'}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Terms / Privacy */}
            <div className="pt-4 text-xs text-muted-foreground">
              <p>
                Ao entrar ou criar sua conta, você concorda com nossos{' '}
                <Link
                  to="/termos-de-uso"
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  Termos de Uso
                </Link>{' '}
                e{' '}
                <Link
                  to="/politica-de-privacidade"
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Right column – Illustration area */}
          <div className="hidden md:flex flex-1 items-center justify-center bg-gradient-to-br from-[#FCE7F3] via-[#F472B6] to-[#9333EA] relative">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_#fff,_transparent_55%),radial-gradient(circle_at_bottom,_#F9A8D4,_transparent_55%)]" />

            <div className="relative z-10 max-w-md w-full px-10 py-10 text-white space-y-4">
              <p className="text-xs uppercase tracking-[0.25em] text-pink-100/90">
                Painel premium para salões
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold leading-snug">
                Visualize sua agenda, organize seus clientes e acompanhe suas
                receitas em tempo real.
              </h2>
              <p className="text-sm text-pink-50/90">
                Ideal para salões, estúdios de beleza e profissionais que
                desejam um controle moderno e elegante do negócio.
              </p>

              {/* IMAGE AREA: aqui será inserida uma ilustração personalizada */}
              <div className="mt-6 w-full h-80 sm:h-96 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md overflow-hidden">
                <img
                  src="/mulher.jpg.png"
                  alt="Profissional de beleza usando o Agendaris no celular"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#1f2937]">Recuperar senha</DialogTitle>
            <p className="text-sm text-[#4b5563]">
              Informe seu e-mail cadastrado. Você receberá um link para redefinir sua senha.
            </p>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-sm font-semibold">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="h-11 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={isSendingReset}
              className="w-full h-11 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold"
            >
              {isSendingReset ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;