import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const TermosUso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FCE7F3] via-[#F9E0FF] to-[#C084FC] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl">
        <Card className="border border-[#FBCFE8] shadow-xl bg-white/95 backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-[#1f2937]">
                ✅ TERMOS DE USO – AGENDARIS
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
                Bem-vindo ao Agendaris!
              </p>
              <p className="text-base leading-relaxed">
                Ao criar uma conta ou utilizar nossos serviços, você concorda com estes Termos de Uso. Caso não concorde, recomendamos que não utilize o aplicativo.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">1. Sobre o Agendaris</h2>
              <p className="text-base leading-relaxed">
                O Agendaris é um sistema online voltado para profissionais da beleza e salões, permitindo gerenciar:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Agendamentos</li>
                <li>Clientes</li>
                <li>Serviços e preços</li>
                <li>Caixa, entradas e saídas financeiras</li>
                <li>Estoque</li>
                <li>Área do cliente para agendamentos online</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">2. Cadastro do Usuário</h2>
              <p className="text-base leading-relaxed">
                Para usar o Agendaris, você deve:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Informar um e-mail válido</li>
                <li>Criar uma senha segura</li>
                <li>Concordar com estes Termos e com a Política de Privacidade</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                Você é responsável pela segurança da sua conta e senha.
              </p>
              <p className="text-base leading-relaxed">
                O Agendaris não se responsabiliza por acessos indevidos causados por compartilhamento de senha.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">3. Uso Permitido</h2>
              <p className="text-base leading-relaxed">
                Você se compromete a utilizar o Agendaris apenas para fins legais e relacionados ao seu negócio.
              </p>
              <p className="text-base leading-relaxed font-semibold mt-4">
                É proibido:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Usar o sistema para fins fraudulentos</li>
                <li>Tentar invadir, modificar ou copiar partes do sistema</li>
                <li>Burlar pagamentos ou assinaturas</li>
                <li>Usar dados de clientes de maneira inadequada ou ilegal</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">4. Planos, Pagamentos e Assinaturas</h2>
              <p className="text-base leading-relaxed">
                O Agendaris pode oferecer:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Período de teste gratuito</li>
                <li>Planos mensais ou anuais</li>
                <li>Funções gratuitas ou premium</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                O cancelamento pode ser realizado a qualquer momento pelo painel ou solicitando via e-mail.
              </p>
              <p className="text-base leading-relaxed">
                Valores podem ser alterados futuramente, mediante aviso prévio.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">5. Disponibilidade do Serviço</h2>
              <p className="text-base leading-relaxed">
                Trabalhamos para manter o sistema disponível 24h por dia, entretanto:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Podem ocorrer interrupções para manutenção</li>
                <li>Não garantimos funcionamento ininterrupto</li>
                <li>Não nos responsabilizamos por quedas de internet, servidor ou serviços de terceiros</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">6. Conteúdo do Usuário</h2>
              <p className="text-base leading-relaxed">
                Os dados cadastrados por você dentro do sistema — como clientes, agendamentos, valores, históricos e produtos — são de sua responsabilidade.
              </p>
              <p className="text-base leading-relaxed">
                O Agendaris apenas armazena e organiza essas informações.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">7. Privacidade e Tratamento de Dados</h2>
              <p className="text-base leading-relaxed">
                O tratamento de dados segue o que está descrito na Política de Privacidade, de acordo com a LGPD (Lei nº 13.709/2018).
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">8. Cancelamento e Exclusão da Conta</h2>
              <p className="text-base leading-relaxed">
                Você pode excluir sua conta a qualquer momento.
              </p>
              <p className="text-base leading-relaxed font-semibold mt-4">
                Após a exclusão:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Os dados podem ser removidos permanentemente</li>
                <li>Alguns registros podem ser mantidos por obrigação legal (ex.: informações fiscais)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">9. Limitação de Responsabilidade</h2>
              <p className="text-base leading-relaxed">
                O Agendaris não é responsável por:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-base">
                <li>Prejuízos financeiros decorrentes de uso incorreto do sistema</li>
                <li>Informações cadastradas de forma errada pelo usuário</li>
                <li>Indisponibilidade temporária do sistema</li>
              </ul>
              <p className="text-base leading-relaxed mt-4">
                O sistema é uma ferramenta de apoio; a responsabilidade pelo negócio permanece com o usuário.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">10. Alterações nos Termos</h2>
              <p className="text-base leading-relaxed">
                Podemos atualizar estes Termos a qualquer momento.
              </p>
              <p className="text-base leading-relaxed">
                Ao continuar usando o sistema, você concorda com eventuais mudanças.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#9333EA]">11. Contato</h2>
              <p className="text-base leading-relaxed">
                Para dúvidas ou suporte:
              </p>
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

export default TermosUso;

