import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Phone, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Appointment {
  id: string;
  time: string;
  clientName: string;
  clientPhone: string;
  service: string;
  status: 'agendado' | 'confirmado' | 'finalizado' | 'cancelado';
  observations?: string;
}

const mockAppointments: Appointment[] = [
  {
    id: '1',
    time: '09:00',
    clientName: 'Maria Silva',
    clientPhone: '(11) 99999-9999',
    service: 'Corte + Escova',
    status: 'confirmado'
  },
  {
    id: '2',
    time: '10:30',
    clientName: 'Ana Costa',
    clientPhone: '(11) 88888-8888',
    service: 'Manicure',
    status: 'agendado'
  },
  {
    id: '3',
    time: '14:00',
    clientName: 'Joana Santos',
    clientPhone: '(11) 77777-7777',
    service: 'Corte + Coloração',
    status: 'agendado'
  }
];

export const TodaySchedule = () => {
  const [appointments] = useState<Appointment[]>(mockAppointments);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'agendado':
        return { 
          color: 'bg-blue-100 text-blue-800 border-blue-200', 
          icon: Clock, 
          label: 'Agendado' 
        };
      case 'confirmado':
        return { 
          color: 'bg-green-100 text-green-800 border-green-200', 
          icon: CheckCircle, 
          label: 'Confirmado' 
        };
      case 'finalizado':
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          icon: CheckCircle, 
          label: 'Finalizado' 
        };
      case 'cancelado':
        return { 
          color: 'bg-red-100 text-red-800 border-red-200', 
          icon: XCircle, 
          label: 'Cancelado' 
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-800 border-gray-200', 
          icon: AlertCircle, 
          label: 'Desconhecido' 
        };
    }
  };

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Card className="col-span-full lg:col-span-2 shadow-soft border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Agenda de Hoje
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {appointments.length} agendamentos
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground capitalize">
          {today}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum agendamento para hoje</p>
            <p className="text-sm">Que tal aproveitar para organizar ou relaxar?</p>
          </div>
        ) : (
          appointments.map((appointment) => {
            const statusConfig = getStatusConfig(appointment.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <div 
                key={appointment.id} 
                className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/30 hover:shadow-soft transition-all duration-200"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-center min-w-[60px]">
                    <div className="text-lg font-semibold text-primary">
                      {appointment.time}
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {appointment.clientName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{appointment.clientPhone}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {appointment.service}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="outline" 
                    className={`${statusConfig.color} flex items-center gap-1`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                  
                  {appointment.status === 'agendado' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="soft" className="text-xs">
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        Cancelar
                      </Button>
                    </div>
                  )}
                  
                  {appointment.status === 'confirmado' && (
                    <Button size="sm" variant="default" className="text-xs">
                      Finalizar
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        <div className="pt-4 border-t border-border/30">
          <Button variant="outline" size="sm" className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Ver agenda completa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};