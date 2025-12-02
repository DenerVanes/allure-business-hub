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
import { Bell, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getBrazilianDate } from '@/utils/timezone';

interface Notification {
  id: string;
  type: 'new_appointment';
  title: string;
  message: string;
  appointmentInfo: string;
  isOnline: boolean;
  timestamp: Date;
  link?: string;
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<Date | null>(null);

  // Buscar agendamentos recentes
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments-notifications', user?.id],
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
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Processar notificações - apenas novos agendamentos
  useEffect(() => {
    const newNotifications: Notification[] = [];
    const now = getBrazilianDate();

    // Novos agendamentos (criados nas últimas 24 horas)
    const recentAppointments = appointments.filter(apt => {
      const createdDate = parseISO(apt.created_at);
      const hoursSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceCreation <= 24 && hoursSinceCreation >= 0;
    });

    recentAppointments.slice(0, 10).forEach(apt => {
      const clientName = (apt.clients as any)?.name || apt.client_name || 'Cliente';
      const appointmentDate = format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR });
      const appointmentTime = apt.appointment_time.slice(0, 5); // HH:mm
      
      // Verificar se foi agendamento online (se não tem client_id, foi criado manualmente)
      const isOnline = apt.client_id !== null;

      newNotifications.push({
        id: `new-${apt.id}`,
        type: 'new_appointment',
        title: 'Novo Agendamento',
        message: `${clientName} fez um novo agendamento`,
        appointmentInfo: `${appointmentDate} às ${appointmentTime}`,
        isOnline,
        timestamp: parseISO(apt.created_at),
        link: '/agendamentos',
      });
    });

    // Ordenar por timestamp (mais recentes primeiro)
    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    setNotifications(newNotifications);
  }, [appointments]);

  // Contar notificações não lidas
  const unreadCount = notifications.filter((n) =>
    !lastSeenAt || n.timestamp > lastSeenAt
  ).length;

  // Marcar como vistas ao abrir
  useEffect(() => {
    if (open) {
      setLastSeenAt(new Date());
    }
  }, [open]);

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
                    "text-blue-600 bg-blue-50"
                  )}
                  onClick={() => {
                    if (notification.link) {
                      window.location.href = notification.link;
                    }
                  }}
                >
                  <div className="p-2 rounded-full text-blue-600 bg-blue-100">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {notification.appointmentInfo}
                      {notification.isOnline && (
                        <span className="ml-1 text-green-600 font-medium">(Online)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {format(notification.timestamp, "dd/MM 'às' HH:mm", { locale: ptBR })}
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
