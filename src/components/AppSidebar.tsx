
import { Calendar, LayoutDashboard, Scissors, Package, DollarSign, Users, Settings, Sparkles, UserCheck } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard
  },
  {
    title: 'Agendamentos',
    url: '/agendamentos',
    icon: Calendar
  },
  {
    title: 'Serviços',
    url: '/servicos',
    icon: Scissors
  },
  {
    title: 'Estoque',
    url: '/estoque',
    icon: Package
  },
  {
    title: 'Financeiro',
    url: '/financeiro',
    icon: DollarSign
  },
  {
    title: 'Clientes',
    url: '/clientes',
    icon: Users
  },
  {
    title: 'Colaboradores',
    url: '/colaboradores',
    icon: UserCheck
  },
  {
    title: 'Configurações',
    url: '/configuracoes',
    icon: Settings
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === 'collapsed';
  const { user } = useAuth();

  // Buscar nome do salão do perfil
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const businessName = profile?.business_name || 'Agendari';

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r border-border/50 bg-card/30 backdrop-blur-sm">
      <SidebarHeader className="border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-lg font-semibold bg-gradient-primary bg-clip-text text-transparent">
                {businessName}
              </h2>
              <p className="text-xs text-muted-foreground">
                Gestão de Beleza
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={`transition-all duration-200 hover:shadow-soft rounded-lg ${
                      isActive(item.url) 
                        ? 'bg-primary-light text-primary font-medium shadow-soft border border-primary/20' 
                        : 'hover:bg-accent'
                    }`}
                  >
                    <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2">
                      <item.icon className={`h-5 w-5 ${isActive(item.url) ? 'text-primary' : ''}`} />
                      {!collapsed && (
                        <span className="text-sm">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
