import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Instagram, 
  Calendar as CalendarIcon,
  MessageSquare,
  Plus,
  Flame,
  Thermometer,
  Snowflake,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Target,
  TrendingUp,
  Edit,
  Trash2,
  MoreVertical,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Lead } from '@/pages/FunilLeads';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  note_type: string;
  created_at: string;
}

interface LeadTask {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

interface LeadDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}

const statusOptions = [
  { value: 'novo_lead', label: 'Novo Lead' },
  { value: 'contato_realizado', label: 'Contato Realizado' },
  { value: 'aguardando_resposta', label: 'Aguardando Resposta' },
  { value: 'interesse_medio', label: 'Interesse Médio' },
  { value: 'interesse_alto', label: 'Interesse Alto' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'perdido', label: 'Perdido' },
];

export function LeadDetailModal({ open, onOpenChange, lead }: LeadDetailModalProps) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('message');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>(undefined);
  const [currentStatus, setCurrentStatus] = useState(lead.status);
  const [heatScore, setHeatScore] = useState(lead.heat_score);
  const [seller, setSeller] = useState(lead.seller ? lead.seller : 'sem_vendedor');
  const [nextActionDate, setNextActionDate] = useState<Date | undefined>(
    lead.next_action_at ? new Date(lead.next_action_at) : undefined
  );
  const [nextActionDescription, setNextActionDescription] = useState(lead.next_action_description || '');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editingNoteType, setEditingNoteType] = useState('message');
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [showDeleteLeadDialog, setShowDeleteLeadDialog] = useState(false);

  // Buscar notas do lead
  const { data: notes = [] } = useQuery({
    queryKey: ['lead-notes', lead.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('lead_notes' as any)
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false }));
      
      if (error) throw error;
      return (data as unknown as LeadNote[]) || [];
    }
  });

  // Buscar tarefas do lead
  const { data: tasks = [] } = useQuery({
    queryKey: ['lead-tasks', lead.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('lead_tasks' as any)
        .select('*')
        .eq('lead_id', lead.id)
        .order('due_date', { ascending: true }));
      
      if (error) throw error;
      return (data as unknown as LeadTask[]) || [];
    }
  });

  // Mutation para adicionar nota
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('lead_notes' as any)
        .insert({
          lead_id: lead.id,
          content: newNote,
          note_type: noteType,
        }));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-notes', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setNewNote('');
      toast({ title: 'Nota adicionada com sucesso' });
    }
  });

  // Mutation para adicionar tarefa
  const addTaskMutation = useMutation({
    mutationFn: async () => {
      if (!newTaskDate) throw new Error('Data é obrigatória');
      
      const { error } = await (supabase
        .from('lead_tasks' as any)
        .insert({
          lead_id: lead.id,
          title: newTaskTitle,
          due_date: newTaskDate.toISOString(),
        }));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead.id] });
      setNewTaskTitle('');
      setNewTaskDate(undefined);
      toast({ title: 'Lembrete criado com sucesso' });
    }
  });

  // Mutation para completar tarefa
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await (supabase
        .from('lead_tasks' as any)
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', taskId));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead.id] });
      toast({ title: 'Tarefa concluída!' });
    }
  });

  // Mutation para atualizar nota
  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content, noteType }: { noteId: string; content: string; noteType: string }) => {
      const { error } = await (supabase
        .from('lead_notes' as any)
        .update({ content, note_type: noteType })
        .eq('id', noteId));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-notes', lead.id] });
      setEditingNoteId(null);
      setEditingNoteContent('');
      toast({ title: 'Observação atualizada com sucesso' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro', 
        description: error.message || 'Não foi possível atualizar a observação.',
        variant: 'destructive'
      });
    }
  });

  // Mutation para excluir nota
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await (supabase
        .from('lead_notes' as any)
        .delete()
        .eq('id', noteId));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-notes', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setDeleteNoteId(null);
      toast({ title: 'Observação excluída com sucesso' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro', 
        description: error.message || 'Não foi possível excluir a observação.',
        variant: 'destructive'
      });
    }
  });

  // Mutation para excluir lead
  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('leads' as any)
        .delete()
        .eq('id', lead.id));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowDeleteLeadDialog(false);
      onOpenChange(false);
      toast({ title: 'Lead excluído com sucesso' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro', 
        description: error.message || 'Não foi possível excluir o lead.',
        variant: 'destructive'
      });
    }
  });

  // Mutation para atualizar lead
  const updateLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('leads' as any)
        .update({ 
          status: currentStatus, 
          heat_score: heatScore,
          seller: seller === 'sem_vendedor' || !seller ? null : seller,
          next_action_at: nextActionDate ? nextActionDate.toISOString() : null,
          next_action_description: nextActionDescription || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead atualizado com sucesso' });
    }
  });

  // Iniciar edição de nota
  const startEditingNote = (note: LeadNote) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
    setEditingNoteType(note.note_type);
  };

  // Cancelar edição
  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditingNoteContent('');
    setEditingNoteType('message');
  };

  // Salvar edição
  const saveEditing = () => {
    if (editingNoteId && editingNoteContent.trim()) {
      updateNoteMutation.mutate({
        noteId: editingNoteId,
        content: editingNoteContent,
        noteType: editingNoteType
      });
    }
  };

  // Heat score info
  const getHeatInfo = (score: number) => {
    if (score >= 70) return { icon: Flame, color: '#EF4444', label: 'Quente' };
    if (score >= 30) return { icon: Thermometer, color: '#F59E0B', label: 'Morno' };
    return { icon: Snowflake, color: '#9CA3AF', label: 'Frio' };
  };

  const heatInfo = getHeatInfo(heatScore);
  const HeatIcon = heatInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh]" style={{ borderRadius: '20px' }}>
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl" style={{ color: '#5A2E98' }}>
                {lead.salon_name}
              </DialogTitle>
              {lead.contact_name && (
                <p className="text-sm text-[#5A4A5E]">{lead.contact_name}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  style={{ color: '#8E44EC' }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteLeadDialog(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          {/* Info Cards */}
          <div className="flex flex-wrap gap-3 py-2">
            {lead.phone && (
              <div className="flex items-center gap-1 text-sm text-[#5A4A5E]">
                <Phone className="h-4 w-4" style={{ color: '#8E44EC' }} />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-1 text-sm text-[#5A4A5E]">
                <Mail className="h-4 w-4" style={{ color: '#8E44EC' }} />
                <span>{lead.email}</span>
              </div>
            )}
            {lead.city && (
              <div className="flex items-center gap-1 text-sm text-[#5A4A5E]">
                <MapPin className="h-4 w-4" style={{ color: '#8E44EC' }} />
                <span>{lead.city}{lead.neighborhood ? ` - ${lead.neighborhood}` : ''}</span>
              </div>
            )}
            {lead.instagram && (
              <div className="flex items-center gap-1 text-sm text-[#5A4A5E]">
                <Instagram className="h-4 w-4" style={{ color: '#8E44EC' }} />
                <span>@{lead.instagram.replace('@', '')}</span>
              </div>
            )}
            {lead.first_contact_date && (
              <div className="flex items-center gap-1 text-sm text-[#5A4A5E]">
                <CalendarIcon className="h-4 w-4" style={{ color: '#8E44EC' }} />
                <span>1º contato: {format(new Date(lead.first_contact_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
              </div>
            )}
          </div>

          {/* Status, Vendedor e Temperatura */}
          <div className="grid grid-cols-3 gap-4 py-4 border-y" style={{ borderColor: '#F7D5E8' }}>
            <div>
              <Label className="text-sm font-medium text-[#5A4A5E]">Status do Lead</Label>
              <Select value={currentStatus} onValueChange={setCurrentStatus}>
                <SelectTrigger className="mt-1" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#5A4A5E]">Vendedor</Label>
              <Select value={seller} onValueChange={(value) => setSeller(value === 'sem_vendedor' ? 'sem_vendedor' : value)}>
                <SelectTrigger className="mt-1" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_vendedor">Sem vendedor</SelectItem>
                  <SelectItem value="Dener Vanes">Dener Vanes</SelectItem>
                  <SelectItem value="Larissa Botelho">Larissa Botelho</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#5A4A5E] flex items-center gap-2 mb-3">
                <Target className="h-4 w-4" style={{ color: heatInfo.color }} />
                Temperatura de Fechamento
                <div className="flex items-center gap-1" style={{ color: heatInfo.color }}>
                  <HeatIcon className="h-4 w-4" />
                  <span className="text-xs font-semibold">{heatScore}%</span>
                </div>
              </Label>
              <Slider
                value={[heatScore]}
                onValueChange={(v) => setHeatScore(v[0])}
                max={100}
                step={5}
                className="mt-1"
              />
              <div className="flex justify-between text-xs text-[#5A4A5E] mt-1">
                <span>Frio (0%)</span>
                <span>Morno (50%)</span>
                <span>Quente (100%)</span>
              </div>
            </div>
          </div>

          {/* Próxima Ação */}
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" style={{ color: '#8E44EC' }} />
              <Label className="text-sm font-medium text-[#5A4A5E]">Próxima Ação Planejada</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#5A4A5E] mb-1 block">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextActionDate ? format(nextActionDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={nextActionDate}
                      onSelect={setNextActionDate}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-[#5A4A5E] mb-1 block">Descrição</Label>
                <Input
                  value={nextActionDescription}
                  onChange={(e) => setNextActionDescription(e.target.value)}
                  placeholder="Ex: Ligar para apresentar proposta"
                  style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                />
              </div>
            </div>
          </div>

          <Button 
            onClick={() => updateLeadMutation.mutate()}
            disabled={updateLeadMutation.isPending}
            className="w-full rounded-full mb-4"
            style={{ backgroundColor: '#8E44EC', color: 'white' }}
          >
            {updateLeadMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>

        {/* Tabs */}
        <Tabs defaultValue="notes" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="notes" className="flex-1">Notas ({notes.length})</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1">Lembretes ({tasks.filter(t => !t.completed).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4">
            {/* Adicionar nota */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4" style={{ color: '#8E44EC' }} />
                <Label className="text-sm font-medium text-[#5A4A5E]">Observações do Andamento</Label>
              </div>
              <div className="space-y-2">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-full" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">💬 Mensagem</SelectItem>
                    <SelectItem value="call">📞 Ligação</SelectItem>
                    <SelectItem value="meeting">🤝 Reunião</SelectItem>
                    <SelectItem value="objection">⚠️ Objeção</SelectItem>
                    <SelectItem value="action">✅ Ação Realizada</SelectItem>
                    <SelectItem value="status_change">🔄 Mudança de Status</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Descreva o andamento da negociação, objeções levantadas, próximos passos, etc..."
                  className="min-h-[100px]"
                  style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                />
                <Button
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  className="w-full rounded-full"
                  style={{ backgroundColor: '#8E44EC', color: 'white' }}
                >
                  {addNoteMutation.isPending ? 'Adicionando...' : 'Adicionar Observação'}
                </Button>
              </div>
            </div>

            {/* Timeline de notas */}
            <ScrollArea className="h-[250px]">
              <div className="space-y-3">
                {notes.map(note => (
                  <div 
                    key={note.id} 
                    className="p-4 rounded-lg border-l-4 relative group"
                    style={{ 
                      backgroundColor: '#F7D5E8',
                      borderLeftColor: note.note_type === 'objection' ? '#EF4444' :
                                     note.note_type === 'action' ? '#10B981' :
                                     note.note_type === 'meeting' ? '#8E44EC' :
                                     note.note_type === 'call' ? '#3B82F6' : '#8E44EC'
                    }}
                  >
                    {editingNoteId === note.id ? (
                      // Modo de edição
                      <div className="space-y-2">
                        <Select value={editingNoteType} onValueChange={setEditingNoteType}>
                          <SelectTrigger className="w-full" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="message">💬 Mensagem</SelectItem>
                            <SelectItem value="call">📞 Ligação</SelectItem>
                            <SelectItem value="meeting">🤝 Reunião</SelectItem>
                            <SelectItem value="objection">⚠️ Objeção</SelectItem>
                            <SelectItem value="action">✅ Ação Realizada</SelectItem>
                            <SelectItem value="status_change">🔄 Mudança de Status</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          className="min-h-[80px]"
                          style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={saveEditing}
                            disabled={!editingNoteContent.trim() || updateNoteMutation.isPending}
                            size="sm"
                            className="flex-1 rounded-full"
                            style={{ backgroundColor: '#8E44EC', color: 'white' }}
                          >
                            {updateNoteMutation.isPending ? 'Salvando...' : 'Salvar'}
                          </Button>
                          <Button
                            onClick={cancelEditing}
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            style={{ borderColor: '#C9A7FD', color: '#8E44EC' }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Modo de visualização
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {note.note_type === 'message' ? '💬' : 
                               note.note_type === 'call' ? '📞' :
                               note.note_type === 'meeting' ? '🤝' :
                               note.note_type === 'objection' ? '⚠️' : 
                               note.note_type === 'action' ? '✅' : '🔄'}
                            </span>
                            <span className="text-xs font-medium text-[#5A2E98]">
                              {note.note_type === 'message' ? 'Mensagem' : 
                               note.note_type === 'call' ? 'Ligação' :
                               note.note_type === 'meeting' ? 'Reunião' :
                               note.note_type === 'objection' ? 'Objeção' : 
                               note.note_type === 'action' ? 'Ação' : 'Mudança de Status'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#5A4A5E]">
                              {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ color: '#8E44EC' }}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => startEditingNote(note)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteNoteId(note.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className="text-sm text-[#5A2E98] whitespace-pre-wrap">{note.content}</p>
                        <span className="text-xs text-[#5A4A5E] mt-1 block">
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </>
                    )}
                  </div>
                ))}
                {notes.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2" style={{ color: '#C9A7FD' }} />
                    <p className="text-sm text-[#5A4A5E]">
                      Nenhuma observação ainda. Adicione a primeira para acompanhar o andamento!
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            {/* Adicionar tarefa */}
            <div className="flex gap-2 mb-4">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Ex: Ligar amanhã"
                className="flex-1"
                style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[120px]"
                    style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {newTaskDate ? format(newTaskDate, 'dd/MM') : 'Data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newTaskDate}
                    onSelect={setNewTaskDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <Button
                onClick={() => addTaskMutation.mutate()}
                disabled={!newTaskTitle.trim() || !newTaskDate || addTaskMutation.isPending}
                size="icon"
                className="rounded-full"
                style={{ backgroundColor: '#8E44EC' }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Lista de tarefas */}
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ 
                      backgroundColor: task.completed ? '#E5E7EB' : '#F7D5E8',
                      opacity: task.completed ? 0.7 : 1
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => !task.completed && completeTaskMutation.mutate(task.id)}
                      disabled={task.completed}
                    >
                      {task.completed ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2" style={{ borderColor: '#8E44EC' }} />
                      )}
                    </Button>
                    <div className="flex-1">
                      <p className={`text-sm ${task.completed ? 'line-through text-[#9CA3AF]' : 'text-[#5A2E98]'}`}>
                        {task.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#5A4A5E]">
                      <Clock className="h-3 w-3" />
                      {format(new Date(task.due_date), 'dd/MM', { locale: ptBR })}
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className="text-center text-sm text-[#5A4A5E] py-8">
                    Nenhum lembrete. Crie um para não esquecer!
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        </ScrollArea>
      </DialogContent>

      {/* Dialog de confirmação para excluir nota */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent style={{ borderRadius: '20px' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Observação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta observação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeleteNoteId(null)}
              style={{ borderRadius: '12px' }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNoteId && deleteNoteMutation.mutate(deleteNoteId)}
              disabled={deleteNoteMutation.isPending}
              style={{ 
                backgroundColor: '#EF4444', 
                color: 'white',
                borderRadius: '12px'
              }}
            >
              {deleteNoteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação para excluir lead */}
      <AlertDialog open={showDeleteLeadDialog} onOpenChange={setShowDeleteLeadDialog}>
        <AlertDialogContent style={{ borderRadius: '20px' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{lead.salon_name}</strong>? 
              Esta ação não pode ser desfeita e excluirá todas as observações e lembretes associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowDeleteLeadDialog(false)}
              style={{ borderRadius: '12px' }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLeadMutation.mutate()}
              disabled={deleteLeadMutation.isPending}
              style={{ 
                backgroundColor: '#EF4444', 
                color: 'white',
                borderRadius: '12px'
              }}
            >
              {deleteLeadMutation.isPending ? 'Excluindo...' : 'Excluir Lead'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
