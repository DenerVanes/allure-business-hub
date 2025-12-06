import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  AlertCircle
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

  // Mutation para atualizar lead
  const updateLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('leads' as any)
        .update({ 
          status: currentStatus, 
          heat_score: heatScore,
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]" style={{ borderRadius: '20px' }}>
        <DialogHeader>
          <DialogTitle className="text-xl" style={{ color: '#5A2E98' }}>
            {lead.salon_name}
          </DialogTitle>
          {lead.contact_name && (
            <p className="text-sm text-[#5A4A5E]">{lead.contact_name}</p>
          )}
        </DialogHeader>

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
        </div>

        {/* Status e Heat Score */}
        <div className="grid grid-cols-2 gap-4 py-4 border-y" style={{ borderColor: '#F7D5E8' }}>
          <div>
            <Label className="text-sm font-medium text-[#5A4A5E]">Status</Label>
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
            <Label className="text-sm font-medium text-[#5A4A5E] flex items-center gap-2">
              Temperatura
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
              className="mt-3"
            />
          </div>
        </div>

        <Button 
          onClick={() => updateLeadMutation.mutate()}
          disabled={updateLeadMutation.isPending}
          className="w-full rounded-full"
          style={{ backgroundColor: '#8E44EC', color: 'white' }}
        >
          Salvar Alterações
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
              <div className="flex gap-2">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[140px]" style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">💬 Mensagem</SelectItem>
                    <SelectItem value="call">📞 Ligação</SelectItem>
                    <SelectItem value="meeting">🤝 Reunião</SelectItem>
                    <SelectItem value="objection">⚠️ Objeção</SelectItem>
                    <SelectItem value="action">✅ Ação</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Adicionar nota..."
                  className="flex-1"
                  style={{ borderRadius: '12px', borderColor: '#F7D5E8' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newNote.trim()) {
                      addNoteMutation.mutate();
                    }
                  }}
                />
                <Button
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  size="icon"
                  className="rounded-full"
                  style={{ backgroundColor: '#8E44EC' }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Timeline de notas */}
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {notes.map(note => (
                  <div 
                    key={note.id} 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: '#F7D5E8' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs">
                        {note.note_type === 'message' ? '💬' : 
                         note.note_type === 'call' ? '📞' :
                         note.note_type === 'meeting' ? '🤝' :
                         note.note_type === 'objection' ? '⚠️' : '✅'}
                      </span>
                      <span className="text-xs text-[#5A4A5E]">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-[#5A2E98]">{note.content}</p>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-center text-sm text-[#5A4A5E] py-8">
                    Nenhuma nota ainda. Adicione a primeira!
                  </p>
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
      </DialogContent>
    </Dialog>
  );
}
