import { Calendar, LayoutDashboard, Scissors, Package, DollarSign, Users, Settings, UserCheck, Shield, CreditCard, CheckCircle } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';

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

const adminMenuItems = [
  {
    title: 'Gestão de Clientes',
    url: '/gestao-clientes',
    icon: Shield
  },
  {
    title: 'Gerenciar Planos',
    url: '/admin/planos',
    icon: CreditCard
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === 'collapsed';
  const { user } = useAuth();
  const { isAdmin } = useAdmin();


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
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#9333EA] flex items-center justify-center shadow-md relative overflow-hidden">
            {/* Calendário com checkmark - mesma logo da tela de login */}
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
          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-[#F472B6] to-[#9333EA] bg-clip-text text-transparent">
                Agendaris
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

        {/* Admin Menu - Only visible to admins */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {adminMenuItems.map((item) => (
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
        )}
      </SidebarContent>
    </Sidebar>
  );
}
