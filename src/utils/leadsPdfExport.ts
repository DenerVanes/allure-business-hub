import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  salon_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: string;
  heat_score: number;
  origin: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  novo_lead: 'Novo Lead',
  contato_realizado: 'Contato Realizado',
  aguardando_resposta: 'Aguardando Resposta',
  interesse_medio: 'Período de teste',
  interesse_alto: 'Interesse Alto',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

export function generateLeadsPdf(leads: Lead[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(90, 46, 152); // #5A2E98
  doc.text('Relatório do Funil de Vendas', pageWidth / 2, y, { align: 'center' });
  
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(90, 74, 94); // #5A4A5E
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, y, { align: 'center' });

  // Métricas
  y += 20;
  doc.setFontSize(14);
  doc.setTextColor(90, 46, 152);
  doc.text('Resumo', margin, y);

  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(90, 74, 94);

  const total = leads.length;
  const porStatus = Object.entries(statusLabels).map(([status, label]) => ({
    label,
    count: leads.filter(l => l.status === status).length
  }));
  const quentes = leads.filter(l => l.heat_score >= 70).length;
  const mornos = leads.filter(l => l.heat_score >= 30 && l.heat_score < 70).length;
  const frios = leads.filter(l => l.heat_score < 30).length;
  const convertidos = leads.filter(l => l.status === 'fechado').length;
  const taxaConversao = total > 0 ? ((convertidos / total) * 100).toFixed(1) : '0';

  doc.text(`Total de Leads: ${total}`, margin, y);
  y += 6;
  doc.text(`Leads Quentes (70%+): ${quentes}`, margin, y);
  y += 6;
  doc.text(`Leads Mornos (30-69%): ${mornos}`, margin, y);
  y += 6;
  doc.text(`Leads Frios (0-29%): ${frios}`, margin, y);
  y += 6;
  doc.text(`Convertidos: ${convertidos}`, margin, y);
  y += 6;
  doc.text(`Taxa de Conversão: ${taxaConversao}%`, margin, y);

  // Leads por Status
  y += 15;
  doc.setFontSize(14);
  doc.setTextColor(90, 46, 152);
  doc.text('Leads por Status', margin, y);

  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(90, 74, 94);

  porStatus.forEach(({ label, count }) => {
    doc.text(`${label}: ${count}`, margin, y);
    y += 6;
  });

  // Lista de Leads
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(90, 46, 152);
  doc.text('Lista de Leads', margin, y);

  y += 10;
  doc.setFontSize(9);

  // Header da tabela
  const colWidths = [50, 30, 35, 30, 25];
  const headers = ['Nome', 'Telefone', 'Cidade', 'Status', 'Score'];
  
  doc.setFillColor(247, 213, 232); // #F7D5E8
  doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(90, 46, 152);

  let x = margin;
  headers.forEach((header, i) => {
    doc.text(header, x + 2, y);
    x += colWidths[i];
  });

  y += 8;
  doc.setTextColor(90, 74, 94);

  // Rows
  leads.forEach(lead => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    x = margin;
    const row = [
      lead.salon_name.slice(0, 25),
      lead.phone || '-',
      lead.city?.slice(0, 15) || '-',
      statusLabels[lead.status] || lead.status,
      `${lead.heat_score}%`
    ];

    row.forEach((cell, i) => {
      doc.text(cell, x + 2, y);
      x += colWidths[i];
    });

    y += 6;
  });

  // Salvar
  doc.save(`funil-vendas-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
