
import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit, Trash2, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { NewClientModal } from '@/components/NewClientModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPhone, normalizePhone } from '@/utils/phone';
import type { Database } from '@/integrations/supabase/types';
import { formatDateForDisplay } from '@/utils/date';

type ClientRow = Database['public']['Tables']['clients']['Row'];

const Clientes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [showUnbookedOnly, setShowUnbookedOnly] = useState(false);

  const { data: clients = [], isLoading } = useQuery<ClientRow[]>({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Buscar agendamentos para identificar clientes com agendamentos
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments-for-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('client_id')
        .eq('user_id', user.id)
        .not('client_id', 'is', null);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // IDs de clientes que têm agendamentos
  const clientIdsWithAppointments = useMemo(() => {
    return new Set(appointments.map(apt => apt.client_id).filter(Boolean));
  }, [appointments]);

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      }
      toast({
        title: 'Cliente removido',
        description: 'Cliente foi removido com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o cliente.',
        variant: 'destructive',
      });
    }
  });

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const digitsQuery = normalizePhone(searchTerm);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [clients]);

  const normalizeLetter = useCallback((value: string) => {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .charAt(0)
      .toUpperCase();
  }, []);

  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);

  const filteredClients = useMemo(() => {
    return sortedClients.filter((client) => {
      const name = client.name?.trim() || '';
      const phoneDigits = normalizePhone(client.phone);

      const matchesSearch =
        (!normalizedQuery && !digitsQuery) ||
        name.toLowerCase().includes(normalizedQuery) ||
        phoneDigits.includes(digitsQuery);

      if (!matchesSearch) return false;

      // Filtro de "Não agendados"
      if (showUnbookedOnly) {
        const hasAppointment = clientIdsWithAppointments.has(client.id);
        if (hasAppointment) return false;
      }

      if (!activeLetter) return true;

      const firstLetter = normalizeLetter(name);
      return firstLetter === activeLetter;
    });
  }, [sortedClients, normalizedQuery, digitsQuery, activeLetter, normalizeLetter, showUnbookedOnly, clientIdsWithAppointments]);

  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    sortedClients.forEach((client) => {
      const name = client.name?.trim() || '';
      if (!name) return;
      const normalizedLetter = normalizeLetter(name);
      if (normalizedLetter && alphabet.includes(normalizedLetter)) {
        letters.add(normalizedLetter);
      }
    });
    return letters;
  }, [sortedClients, normalizeLetter, alphabet]);

  const handleOpenNewClient = () => {
    setSelectedClient(null);
    setClientModalOpen(true);
  };

  const handleOpenEditClient = (clientData: ClientRow) => {
    setSelectedClient(clientData);
    setClientModalOpen(true);
  };

  const handleModalChange = (open: boolean) => {
    if (!open) {
      setSelectedClient(null);
    }
    setClientModalOpen(open);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes</p>
        </div>
        <Button onClick={handleOpenNewClient}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant={showUnbookedOnly ? 'default' : 'outline'}
          onClick={() => setShowUnbookedOnly(!showUnbookedOnly)}
          className="whitespace-nowrap"
        >
          {showUnbookedOnly ? '✓ ' : ''}Não Agendados
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={activeLetter === null ? 'default' : 'outline'}
          onClick={() => setActiveLetter(null)}
        >
          Todos
        </Button>
        {alphabet.map((letter) => {
          const hasClients = availableLetters.has(letter);
          return (
            <Button
              key={letter}
              size="sm"
              variant={activeLetter === letter ? 'default' : 'ghost'}
              disabled={!hasClients}
              onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
            >
              {letter}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {showUnbookedOnly ? 'Clientes Não Agendados' : 'Clientes Cadastrados'} ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'Nenhum cliente encontrado com os critérios de busca.' : 'Nenhum cliente cadastrado ainda.'}
              </p>
              <Button onClick={handleOpenNewClient}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Cliente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data de Nascimento</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        {client.notes && (
                          <p className="text-sm text-muted-foreground">{client.notes}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhone(client.phone)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {client.email}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{formatDateForDisplay(client.birth_date)}</TableCell>
                    <TableCell>
                      {format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditClient(client)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteClientMutation.mutate(client.id)}
                          disabled={deleteClientMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewClientModal
        open={clientModalOpen}
        onOpenChange={handleModalChange}
        client={selectedClient}
      />
    </div>
  );
};

export default Clientes;
