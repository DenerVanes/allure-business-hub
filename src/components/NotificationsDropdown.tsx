import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Calendar, Clock, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, addHours, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getBrazilianDate, convertToSupabaseDate } from '@/utils/timezone';

interface Notification {
  id: string;
  type: 'new_appointment' | 'upcoming_appointment' | 'low_stock' | 'out_of_stock';
  title: string;
  message: string;
  timestamp: Date;
  link?: string;
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<Date | null>(null);

  // Buscar agendamentos
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services (name),
          clients (name)
        `)
        .eq('user_id', user.id)
        .in('status', ['agendado', 'confirmado'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Buscar produtos com estoque baixo
  const { data: products = [] } = useQuery({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('quantity', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Atualizar a cada minuto
  });

  // Processar notificações
  useEffect(() => {
    const newNotifications: Notification[] = [];
    const today = getBrazilianDate();
    const now = today;
    const oneHourFromNow = addHours(now, 1);
    const todayString = convertToSupabaseDate(today);

    // Novos agendamentos (criados nas últimas 24 horas)
    const recentAppointments = appointments.filter(apt => {
      const createdDate = parseISO(apt.created_at);
      const hoursSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceCreation <= 24 && hoursSinceCreation >= 0;
    });

    // Limitar a 5 notificações de novos agendamentos
    recentAppointments.slice(0, 5).forEach(apt => {
      newNotifications.push({
        id: `new-${apt.id}`,
        type: 'new_appointment',
        title: 'Novo Agendamento',
        message: `${(apt.clients as any)?.name || 'Cliente'} fez um novo agendamento online. Confira na sua agenda.`,
        timestamp: parseISO(apt.created_at),
        link: '/agendamentos',
      });
    });

    // Agendamentos na próxima hora (apenas hoje)
    const upcomingAppointments = appointments.filter(apt => {
      if (apt.appointment_date !== todayString) return false;
      
      const [hours, minutes] = apt.appointment_time.split(':').map(Number);
      const appointmentDateTime = new Date(today);
      appointmentDateTime.setHours(hours, minutes, 0, 0);
      
      // Obter hora atual em minutos desde meia-noite
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const oneHourFromNowMinutes = nowMinutes + 60;
      const appointmentMinutes = hours * 60 + minutes;
      
      // Verificar se está entre agora e 1 hora a partir de agora
      return appointmentMinutes >= nowMinutes && appointmentMinutes <= oneHourFromNowMinutes;
    });

    upcomingAppointments.forEach(apt => {
      newNotifications.push({
        id: `upcoming-${apt.id}`,
        type: 'upcoming_appointment',
        title: 'Agendamento em Breve',
        message: `${(apt.clients as any)?.name || 'Cliente'} tem agendamento às ${apt.appointment_time} - ${(apt.services as any)?.name || 'serviço'}`,
        timestamp: new Date(),
        link: '/agendamentos',
      });
    });

    // Alertas de estoque
    products.forEach(product => {
      if (product.quantity === 0) {
        newNotifications.push({
          id: `out-of-stock-${product.id}`,
          type: 'out_of_stock',
          title: 'Produto Sem Estoque',
          message: `${product.name} está sem estoque`,
          timestamp: new Date(),
          link: '/estoque',
        });
      } else if (product.quantity <= (product.min_quantity || 0)) {
        newNotifications.push({
          id: `low-stock-${product.id}`,
          type: 'low_stock',
          title: 'Estoque Baixo',
          message: `${product.name} está com estoque baixo (${product.quantity} unidades)`,
          timestamp: new Date(),
          link: '/estoque',
        });
      }
    });

    // Ordenar por timestamp (mais recentes primeiro)
    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    setNotifications(newNotifications);
  }, [appointments, products]);

  // Contar apenas notificações mais recentes que o último momento em que o usuário abriu o dropdown
  const unreadCount = notifications.filter((n) =>
    !lastSeenAt || n.timestamp > lastSeenAt
  ).length;

  // Quando o dropdown abre, marcar todas as notificações atuais como vistas
  useEffect(() => {
    if (open) {
      setLastSeenAt(new Date());
    }
  }, [open]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'new_appointment':
      case 'upcoming_appointment':
        return <Calendar className="h-4 w-4" />;
      case 'low_stock':
      case 'out_of_stock':
        return <Package className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'new_appointment':
        return 'text-blue-600 bg-blue-50';
      case 'upcoming_appointment':
        return 'text-orange-600 bg-orange-50';
      case 'low_stock':
        return 'text-yellow-600 bg-yellow-50';
      case 'out_of_stock':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-2 py-1.5">
          <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors",
                    getNotificationColor(notification.type)
                  )}
                  onClick={() => {
                    if (notification.link) {
                      window.location.href = notification.link;
                    }
                  }}
                >
                  <div className={cn("p-2 rounded-full", getNotificationColor(notification.type))}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(notification.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

