import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Star, StarOff, X, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  getTemplates,
  saveTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  type Template
} from '@/utils/templateStorage';
import { replaceVariables } from '@/utils/templateParser';
import { toast } from '@/hooks/use-toast';

interface TemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelect?: (template: Template) => void;
}

export const TemplateManager = ({ open, onOpenChange, onTemplateSelect }: TemplateManagerProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState({ nome: 'Cliente Exemplo', data: '10/12' });
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = () => {
    setTemplates(getTemplates());
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setIsFormOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleSaveTemplate = (formData: { nome: string; texto: string }) => {
    if (!formData.nome.trim() || !formData.texto.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome e texto são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, formData);
      toast({
        title: 'Template atualizado',
        description: 'Template foi atualizado com sucesso.',
      });
    } else {
      const newTemplate = addTemplate({
        ...formData,
        ativo: true,
        padrao: templates.length === 0
      });
      toast({
        title: 'Template criado',
        description: 'Template foi criado com sucesso.',
      });
    }

    loadTemplates();
    setIsFormOpen(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
    loadTemplates();
    setDeleteConfirm(null);
    toast({
      title: 'Template deletado',
      description: 'Template foi removido com sucesso.',
    });
  };

  const handleToggleActive = (id: string, ativo: boolean) => {
    updateTemplate(id, { ativo: !ativo });
    loadTemplates();
  };

  const handleSetDefault = (id: string) => {
    setDefaultTemplate(id);
    loadTemplates();
    toast({
      title: 'Template padrão definido',
      description: 'Template padrão foi atualizado.',
    });
  };

  const handleSelectTemplate = (template: Template) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Gerenciar Templates de Mensagens
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Crie e gerencie templates personalizados para mensagens de aniversário
              </p>
              <Button onClick={handleNewTemplate} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            </div>

            <div className="space-y-2">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum template criado. Clique em "Novo Template" para começar.
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{template.nome}</h3>
                          {template.padrao && (
                            <Badge variant="default" className="text-xs">
                              Padrão
                            </Badge>
                          )}
                          {!template.ativo && (
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">
                          {template.texto}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Variáveis disponíveis: {'{nome}'}, {'{data}'}, {'{dia}'}, {'{mes}'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(template.id)}
                          title="Definir como padrão"
                          disabled={template.padrao}
                        >
                          {template.padrao ? (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Ativo</span>
                          <Switch
                            checked={template.ativo}
                            onCheckedChange={() => handleToggleActive(template.id, template.ativo)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(template.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isFormOpen && (
        <TemplateForm
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTemplate(null);
          }}
          previewData={previewData}
        />
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteTemplate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

interface TemplateFormProps {
  template: Template | null;
  onSave: (data: { nome: string; texto: string }) => void;
  onClose: () => void;
  previewData: { nome: string; data: string };
}

const TemplateForm = ({ template, onSave, onClose, previewData }: TemplateFormProps) => {
  const [nome, setNome] = useState(template?.nome || '');
  const [texto, setTexto] = useState(template?.texto || '');
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ nome, texto });
  };

  // Mock link para preview
  const previewLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/agendar/seu-slug-aqui`
    : 'https://exemplo.com/agendar/seu-slug-aqui';
  
  const preview = replaceVariables(texto, previewData.nome, `2000-12-10T00:00:00`, previewLink);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar Template' : 'Novo Template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Template</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Parabéns Simples"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="texto">Texto da Mensagem</Label>
            <Textarea
              id="texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Olá {nome}! 🎉 Feliz aniversário!"
              rows={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use variáveis: {'{nome}'}, {'{data}'}, {'{dia}'}, {'{mes}'}, {'{link}'} (link de agendamento)
            </p>
          </div>

          {texto && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Preview</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {showPreview ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
              {showPreview && (
                <p className="text-sm whitespace-pre-wrap">{preview}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

