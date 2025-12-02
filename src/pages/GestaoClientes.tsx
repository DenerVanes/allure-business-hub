import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Users, UserCheck, UserX, Loader2, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ClientProfile {
  id: string;
  user_id: string;
  business_name: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  created_at: string;
  last_activity_at: string;
}

const ITEMS_PER_PAGE = 10;

export default function GestaoClientes() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('atuais');

  // Buscar todos os profiles via RPC
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['admin-all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_all_profiles');
      
      if (error) {
        console.error('Erro ao buscar profiles:', error);
        throw error;
      }
      
      return data as ClientProfile[];
    },
    enabled: isAdmin
  });

  // Data de corte para ativo/inativo (3 dias atrás)
  const cutoffDate = subDays(new Date(), 3);

  // Filtrar e classificar clientes
  const { clientesAtuais, clientesAtivos, clientesInativos } = useMemo(() => {
    if (!profiles) return { clientesAtuais: [], clientesAtivos: [], clientesInativos: [] };

    const filtered = profiles.filter(profile => {
      const searchLower = searchTerm.toLowerCase();
      return (
        profile.business_name?.toLowerCase().includes(searchLower) ||
        profile.full_name?.toLowerCase().includes(searchLower) ||
        profile.email?.toLowerCase().includes(searchLower)
      );
    });

    // Todos (ordenados por data de criação, mais recente primeiro)
    const atuais = [...filtered].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Ativos (atividade nos últimos 3 dias)
    const ativos = filtered
      .filter(profile => isAfter(parseISO(profile.last_activity_at), cutoffDate))
      .sort((a, b) => 
        new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
      );

    // Inativos (sem atividade nos últimos 3 dias)
    const inativos = filtered
      .filter(profile => !isAfter(parseISO(profile.last_activity_at), cutoffDate))
      .sort((a, b) => 
        new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime()
      );

    return { clientesAtuais: atuais, clientesAtivos: ativos, clientesInativos: inativos };
  }, [profiles, searchTerm, cutoffDate]);

  // Paginação
  const getCurrentPageData = (data: ClientProfile[]) => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };

  const getTotalPages = (data: ClientProfile[]) => Math.ceil(data.length / ITEMS_PER_PAGE);

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect se não for admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const renderTable = (data: ClientProfile[], showLastActivity: boolean = true) => {
    const pageData = getCurrentPageData(data);
    const totalPages = getTotalPages(data);

    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome/Empresa</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Criado em</TableHead>
              {showLastActivity && <TableHead>Última Atividade</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showLastActivity ? 5 : 4} className="text-center text-muted-foreground py-8">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{profile.business_name}</p>
                      {profile.full_name && (
                        <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{profile.email}</TableCell>
                  <TableCell>{profile.phone || '-'}</TableCell>
                  <TableCell>{formatDate(profile.created_at)}</TableCell>
                  {showLastActivity && (
                    <TableCell>{formatDate(profile.last_activity_at)}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, data.length)} de {data.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-primary rounded-lg">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Clientes</h1>
          <p className="text-muted-foreground">Área administrativa - Visualize todos os clientes da plataforma</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesAtuais.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{clientesAtivos.length}</div>
            <p className="text-xs text-muted-foreground">Últimos 3 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes Inativos</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{clientesInativos.length}</div>
            <p className="text-xs text-muted-foreground">Sem atividade há mais de 3 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            Gerencie e monitore a atividade dos clientes da plataforma
          </CardDescription>
          
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="atuais" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Atuais
                <Badge variant="secondary" className="ml-1">{clientesAtuais.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="ativos" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Ativos
                <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">{clientesAtivos.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="inativos" className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Inativos
                <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">{clientesInativos.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {profilesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <TabsContent value="atuais">
                  {renderTable(clientesAtuais)}
                </TabsContent>
                <TabsContent value="ativos">
                  {renderTable(clientesAtivos)}
                </TabsContent>
                <TabsContent value="inativos">
                  {renderTable(clientesInativos)}
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
