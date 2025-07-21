import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Heart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

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
    
    await signIn(email, password);
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const businessName = formData.get('businessName') as string;
    
    await signUp(email, password, businessName);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-3 bg-gradient-primary rounded-xl">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Beauty Hub
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Bem-vinda ao seu negócio
          </h1>
          <p className="text-muted-foreground">
            Gerencie agendamentos, clientes e receitas em um só lugar
          </p>
        </div>

        {/* Auth Forms */}
        <Card className="shadow-medium border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Heart className="h-4 w-4 text-primary" />
              <span>Feito com amor para profissionais da beleza</span>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>
              
              {/* Sign In Tab */}
              <TabsContent value="signin" className="space-y-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl">Entrar na conta</CardTitle>
                  <CardDescription>
                    Digite suas credenciais para acessar
                  </CardDescription>
                </div>
                
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-mail</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      required
                      className="transition-all duration-200 focus:shadow-soft"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Senha</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      className="transition-all duration-200 focus:shadow-soft"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    variant="default"
                  >
                    {isLoading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>
              
              {/* Sign Up Tab */}
              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl">Criar nova conta</CardTitle>
                  <CardDescription>
                    Cadastre-se e comece a gerenciar seu negócio
                  </CardDescription>
                </div>
                
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-business">Nome do Negócio</Label>
                    <Input
                      id="signup-business"
                      name="businessName"
                      type="text"
                      placeholder="Salão da Maria"
                      required
                      className="transition-all duration-200 focus:shadow-soft"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      required
                      className="transition-all duration-200 focus:shadow-soft"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      required
                      minLength={8}
                      className="transition-all duration-200 focus:shadow-soft"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    variant="default"
                  >
                    {isLoading ? 'Criando conta...' : 'Criar Conta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Ao se cadastrar, você concorda com nossos</p>
          <p>
            <span className="text-primary hover:underline cursor-pointer">Termos de Uso</span>
            {' e '}
            <span className="text-primary hover:underline cursor-pointer">Política de Privacidade</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;