
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
  collaboratorId?: string;
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

  // Buscar colaboradores disponíveis
  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const addServiceSlot = () => {
    const newService: SelectedService = {
      id: Math.random().toString(36).substr(2, 9),
      serviceId: '',
      service: {} as Service
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
          ? { ...s, serviceId, service, collaboratorId: '' }
          : s
      )
    );
  };

  const updateCollaborator = (serviceId: string, collaboratorId: string) => {
    onServicesChange(
      selectedServices.map(s => 
        s.id === serviceId 
          ? { ...s, collaboratorId }
          : s
      )
    );
  };

  // Filtrar colaboradores que têm especialidade compatível com o serviço
  const getAvailableCollaborators = (service: Service) => {
    if (!service.category) return collaborators;
    
    return collaborators.filter(collaborator => {
      if (!collaborator.specialty || collaborator.specialty.length === 0) {
        return true; // Colaborador sem especialidade pode fazer qualquer serviço
      }
      
      return collaborator.specialty.some((spec: string) => 
        spec.toLowerCase() === service.category.toLowerCase()
      );
    });
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
      <div className="space-y-3">
        {selectedServices.map((selectedService, index) => (
          <div key={selectedService.id} className="space-y-2 p-3 border rounded-lg">
            <div className="flex gap-2 items-center">
              <Select 
                value={selectedService.serviceId} 
                onValueChange={(value) => updateService(selectedService.id, value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={`Selecione o ${index === 0 ? 'primeiro' : `${index + 1}º`} serviço`} />
                </SelectTrigger>
                <SelectContent>
                  {services
                    .filter(service => !selectedServices.some(s => s.serviceId === service.id && s.id !== selectedService.id))
                    .map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex flex-col">
                          <span>{service.name} - R$ {service.price} ({service.duration}min)</span>
                          <span className="text-xs text-muted-foreground">Categoria: {service.category}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              
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

            {/* Seletor de profissional para o serviço específico */}
            {selectedService.serviceId && (
              <div className="ml-4">
                <Select 
                  value={selectedService.collaboratorId || ''} 
                  onValueChange={(value) => updateCollaborator(selectedService.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Profissional específico (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Qualquer profissional</SelectItem>
                    {getAvailableCollaborators(selectedService.service).map((collaborator) => (
                      <SelectItem key={collaborator.id} value={collaborator.id}>
                        <div className="flex items-center gap-2">
                          {collaborator.photo_url ? (
                            <img
                              src={collaborator.photo_url}
                              alt={collaborator.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-200" />
                          )}
                          <span>{collaborator.name}</span>
                          {collaborator.specialty?.includes(selectedService.service.category) && (
                            <span className="text-xs text-green-600">✓</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
