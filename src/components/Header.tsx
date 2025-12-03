import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NotificationsDropdown } from './NotificationsDropdown';
import { TrialBanner } from './TrialBanner';
import { useSubscription } from '@/hooks/useSubscription';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
export const Header = () => {
  const {
    user,
    signOut
  } = useAuth();

  // Buscar perfil do usuário
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name, full_name')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Buscar informações do plano
  const { planExpiresAt, isAdmin, isActive } = useSubscription();

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const businessName = profile?.business_name || 'Salon Line';

  return <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        <SidebarTrigger className="lg:hidden" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-foreground truncate">
            {businessName}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Plan Expiration Banner */}
        {!isAdmin && planExpiresAt && isActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">
              Plano ativo até {format(parseISO(planExpiresAt), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
        )}

        {/* Trial Banner */}
        <TrialBanner />

        {/* Notifications */}
        <NotificationsDropdown />
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-auto">
              <Avatar className="h-8 w-8 border-2 border-primary-light">
                <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-foreground">
                  {displayName}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>;
};