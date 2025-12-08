import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Agendamentos from "./pages/Agendamentos";
import Servicos from "./pages/Servicos";
import Estoque from "./pages/Estoque";
import Financeiro from "./pages/Financeiro";
import Clientes from "./pages/Clientes";
import Colaboradores from "./pages/Colaboradores";
import Configuracoes from "./pages/Configuracoes";
import GestaoClientes from "./pages/GestaoClientes";
import GerenciarPlanos from "./pages/GerenciarPlanos";
import FunilLeads from "./pages/FunilLeads";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AgendamentoPublico from "./pages/AgendamentoPublico";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <Routes>
              {/* Rota pública de autenticação /login */}
              <Route path="/login" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/agendar/:slug" element={<AgendamentoPublico />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Index />} />
                <Route path="agendamentos" element={<Agendamentos />} />
                <Route path="servicos" element={<Servicos />} />
                <Route path="estoque" element={<Estoque />} />
                <Route path="financeiro" element={<Financeiro />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="colaboradores" element={<Colaboradores />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="gestao-clientes" element={<GestaoClientes />} />
                <Route path="admin/planos" element={<GerenciarPlanos />} />
                <Route path="funil-leads" element={<FunilLeads />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
