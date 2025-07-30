
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ServiceCombobox } from './ServiceCombobox';
import { CollaboratorSelector } from './CollaboratorSelector';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category: string;
  category_id: string;
}

interface SelectedService {
  id: string;
  serviceId: string;
  service: Service;
  collaboratorIds?: string[];
}

interface ServiceSelectorProps {
  selectedServices: SelectedService[];
  onServicesChange: (services: SelectedService[]) => void;
}

export const ServiceSelector = ({ selectedServices, onServicesChange }: ServiceSelectorProps) => {
  const { user } = useAuth();

  const { data: services = [] } = useQuery({
    queryKey: ['services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          service_categories(name)
        `)
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data?.map(service => ({
        ...service,
        category: service.service_categories?.name || service.category
      })) || [];
    },
    enabled: !!user?.id,
  });

  const addServiceSlot = () => {
    const newService: SelectedService = {
      id: Math.random().toString(36).substr(2, 9),
      serviceId: '',
      service: {} as Service,
      collaboratorIds: []
    };
    onServicesChange([...selectedServices, newService]);
  };

  const removeServiceSlot = (id: string) => {
    onServicesChange(selectedServices.filter(s => s.id !== id));
  };

  const updateService = (id: string, serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    onServicesChange(
      selectedServices.map(s => 
        s.id === id 
          ? { ...s, serviceId, service, collaboratorIds: [] }
          : s
      )
    );
  };

  const updateCollaborators = (serviceId: string, collaboratorIds: string[]) => {
    onServicesChange(
      selectedServices.map(s => 
        s.id === serviceId 
          ? { ...s, collaboratorIds }
          : s
      )
    );
  };

  const getTotalAmount = () => {
    return selectedServices.reduce((total, selectedService) => {
      return total + (selectedService.service?.price || 0);
    }, 0);
  };

  const getTotalDuration = () => {
    return selectedServices.reduce((total, selectedService) => {
      return total + (selectedService.service?.duration || 0);
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {selectedServices.map((selectedService, index) => (
          <div key={selectedService.id} className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <ServiceCombobox
                  services={services.filter(service => 
                    !selectedServices.some(s => s.serviceId === service.id && s.id !== selectedService.id)
                  )}
                  value={selectedService.serviceId}
                  onChange={(value) => updateService(selectedService.id, value)}
                  placeholder={`Selecione o ${index === 0 ? 'primeiro' : `${index + 1}º`} serviço`}
                />
              </div>
              
              {selectedServices.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeServiceSlot(selectedService.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Seletor de profissionais para o serviço específico */}
            {selectedService.serviceId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Profissional</label>
                <CollaboratorSelector
                  serviceCategory={selectedService.service.category}
                  selectedCollaboratorIds={selectedService.collaboratorIds || []}
                  onCollaboratorsChange={(collaboratorIds) => 
                    updateCollaborators(selectedService.id, collaboratorIds)
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addServiceSlot}
        className="w-full gap-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar Outro Serviço
      </Button>

      {selectedServices.some(s => s.service?.price) && (
        <div className="p-3 bg-muted/30 rounded-lg space-y-1">
          <div className="flex justify-between text-sm">
            <span>Duração Total:</span>
            <span className="font-medium">{getTotalDuration()} minutos</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>Valor Total:</span>
            <span>R$ {getTotalAmount().toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
