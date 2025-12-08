import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#C084FC] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl">
        <Card className="border border-[#FBCFE8] shadow-xl bg-white/95 backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-[#1f2937]">
                ✅ POLÍTICA DE PRIVACIDADE – AGENDARIS
              </CardTitle>
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="text-[#F472B6] hover:text-[#d45594]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
            <p className="text-sm text-[#4b5563]">
              Última atualização: 08 de dezembro de 2025
            </p>
          </CardHeader>

          <CardContent className="space-y-6 text-[#1f2937]">
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                Esta Política explica como coletamos, utilizamos e protegemos seus dados dentro do Agendaris, conforme a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">1. Dados que Coletamos</h2>
              
              <p className="text-base leading-relaxed font-semibold">
                Dados do profissional (usuário):
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Nome</li>
                <li>E-mail</li>
                <li>Senha (armazenada criptografada)</li>
                <li>Dados de pagamento da assinatura (processados por terceiros, como Stripe ou Pix)</li>
              </ul>

              <p className="text-base leading-relaxed font-semibold mt-4">
                Dados cadastrados pelo usuário:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Informações de clientes</li>
                <li>Agendamentos</li>
                <li>Serviços e preços</li>
                <li>Histórico financeiro (entradas/saídas)</li>
                <li>Produtos e estoque</li>
                <li>Fotos adicionadas (opcional)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">2. Como Utilizamos os Dados</h2>
              <p className="text-base leading-relaxed">
                Utilizamos suas informações para:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Criar e manter sua conta</li>
                <li>Executar funções do sistema (agendamentos, finanças, estoque etc.)</li>
                <li>Enviar e-mails de confirmação, avisos e redefinição de senha</li>
                <li>Melhorar o desempenho e funcionalidades do sistema</li>
                <li>Prevenir fraudes e garantir segurança</li>
                <li>Oferecer suporte ao usuário</li>
              </ul>
              <p className="text-base leading-relaxed mt-4 font-semibold text-[#9333EA]">
                Nunca vendemos seus dados.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">3. Compartilhamento de Dados</h2>
              <p className="text-base leading-relaxed">
                Compartilhamos dados somente quando necessário, como com:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Fornecedores de hospedagem</li>
                <li>Serviços de e-mail</li>
                <li>Sistemas de pagamento</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                Sempre de forma segura e conforme a LGPD.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">4. Direitos do Usuário (LGPD)</h2>
              <p className="text-base leading-relaxed">
                Você pode solicitar a qualquer momento:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Acesso aos dados</li>
                <li>Correção de informações</li>
                <li>Exclusão da conta</li>
                <li>Portabilidade</li>
                <li>Revogação de consentimento</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                Solicitações devem ser enviadas para:
              </p>
              <p className="text-base leading-relaxed">
                📧 <a href="mailto:suporte.agendaris@gmail.com" className="text-[#F472B6] hover:underline">suporte.agendaris@gmail.com</a>
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">5. Segurança dos Dados</h2>
              <p className="text-base leading-relaxed">
                Utilizamos diversas medidas de segurança:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Criptografia de senhas</li>
                <li>HTTPS em toda comunicação</li>
                <li>Servidores protegidos</li>
                <li>Backup seguro</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                Apesar das medidas, nenhum sistema é 100% inviolável, mas seguimos boas práticas de proteção.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">6. Cookies</h2>
              <p className="text-base leading-relaxed">
                Usamos cookies para:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Manter sessões logadas</li>
                <li>Melhorar a experiência</li>
                <li>Medir desempenho e uso do sistema</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                Você pode desativar cookies, mas o sistema pode não funcionar corretamente.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">7. Exclusão de Dados</h2>
              <p className="text-base leading-relaxed">
                Ao excluir sua conta:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Dados pessoais e operacionais podem ser apagados permanentemente</li>
                <li>Alguns dados só podem ser mantidos por exigência legal</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">8. Alterações na Política</h2>
              <p className="text-base leading-relaxed">
                Podemos atualizar esta Política periodicamente.
              </p>
              <p className="text-base leading-relaxed">
                Ao continuar utilizando o Agendaris, você concorda com as alterações publicadas.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">9. Contato para Privacidade</h2>
              <p className="text-base leading-relaxed">
                📧 <a href="mailto:suporte.agendaris@gmail.com" className="text-[#F472B6] hover:underline">suporte.agendaris@gmail.com</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;

