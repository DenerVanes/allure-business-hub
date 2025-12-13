import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentCard } from './AppointmentCard';
import { Clock } from 'lucide-react';

interface TimeSlotAppointmentsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: any[];
  time: string;
  date: Date;
  onAppointmentClick?: (appointment: any) => void;
}

export const TimeSlotAppointmentsDrawer = ({
  open,
  onOpenChange,
  appointments,
  time,
  date,
  onAppointmentClick,
}: TimeSlotAppointmentsDrawerProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Agendamentos - {time}
          </SheetTitle>
          <SheetDescription>
            {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum agendamento neste horário</p>
            </div>
          ) : (
            appointments.map((appointment) => (
              <div
                key={appointment.id}
                onClick={() => {
                  onAppointmentClick?.(appointment);
                  onOpenChange(false);
                }}
                className="cursor-pointer"
              >
                <AppointmentCard
                  appointment={appointment}
                  className="w-full"
                />
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

