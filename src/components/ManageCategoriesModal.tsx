import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
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
  FolderOpen, 
  Edit2, 
  Trash2, 
  GripVertical,
  Plus,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const categorySchema = z.object({
  name: z.string().min(1, 'Nome da categoria é obrigatório'),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: any[];
}

export const ManageCategoriesModal = ({ 
  open, 
  onOpenChange, 
  services 
}: ManageCategoriesModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);

  const { data: categories = [], isLoading, refetch } = useQuery({
    queryKey: ['service-categories', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
    },
  });

  const editForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });

  // Contar serviços por categoria
  const getServiceCount = (categoryId: string, categoryName: string) => {
    return services.filter(service => 
      service.category_id === categoryId || 
      (service.category === categoryName && !service.category_id)
    ).length;
  };

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('service_categories')
        .update({ name })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: 'Categoria atualizada',
        description: 'Categoria foi renomeada com sucesso.',
      });
      setEditingCategory(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar a categoria.',
        variant: 'destructive',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!user?.id) return;

      // Primeiro, mover serviços para "Sem categoria"
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        const { error: updateError } = await supabase
          .from('services')
          .update({ 
            category: 'Sem categoria',
            category_id: null 
          })
          .eq('category_id', categoryId)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      }

      // Depois, deletar a categoria
      const { error } = await supabase
        .from('service_categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      return categoryId; // Retornar o ID para usar no onSuccess
    },
    onSuccess: async (categoryId: string) => {
      // Remover a categoria da lista imediatamente
      queryClient.setQueryData(['service-categories', user?.id], (oldData: any[]) => {
        if (!oldData) return [];
        return oldData.filter(cat => cat.id !== categoryId);
      });
      
      // Invalidar queries para garantir sincronização
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      
      // Forçar refetch para garantir que a lista seja atualizada do servidor
      await refetch();
      
      toast({
        title: 'Categoria excluída',
        description: 'Os serviços foram movidos para "Sem categoria".',
      });
      setDeletingCategory(null);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a categoria.',
        variant: 'destructive',
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryForm) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('service_categories')
        .insert({
          user_id: user.id,
          name: data.name,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      toast({
        title: 'Categoria criada',
        description: 'Nova categoria adicionada com sucesso.',
      });
      form.reset();
      setShowNewCategory(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (category: any) => {
    setEditingCategory(category.id);
    editForm.reset({ name: category.name });
  };

  const handleSaveEdit = (data: CategoryForm) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory, name: data.name });
    }
  };

  const handleDelete = (categoryId: string) => {
    deleteCategoryMutation.mutate(categoryId);
  };

  const handleNewCategory = (data: CategoryForm) => {
    createCategoryMutation.mutate(data);
  };

  const serviceCount = deletingCategory 
    ? getServiceCount(
        deletingCategory, 
        categories.find(c => c.id === deletingCategory)?.name || ''
      )
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Gerenciar Categorias
            </DialogTitle>
            <DialogDescription>
              Organize suas categorias de serviços. Renomeie, exclua ou reordene conforme necessário.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <Button
              onClick={() => setShowNewCategory(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>

            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma categoria cadastrada ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      
                      {editingCategory === category.id ? (
                        <Form {...editForm}>
                          <form 
                            onSubmit={editForm.handleSubmit(handleSaveEdit)}
                            className="flex-1 flex items-center gap-2"
                          >
                            <FormField
                              control={editForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input {...field} autoFocus />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={updateCategoryMutation.isPending}
                            >
                              Salvar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCategory(null);
                                editForm.reset();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </form>
                        </Form>
                      ) : (
                        <>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{category.name}</span>
                              <Badge variant="secondary">
                                {getServiceCount(category.id, category.name)} serviço(s)
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingCategory(category.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Categoria */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleNewCategory)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Categoria</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Cortes, Coloração, Tratamentos..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCategory(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending ? 'Criando...' : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Alert de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {serviceCount > 0 ? (
                <>
                  Excluir esta categoria moverá <strong>{serviceCount} serviço(s)</strong> para a categoria "Sem categoria".
                  <br />
                  <br />
                  Deseja continuar?
                </>
              ) : (
                'Esta ação não pode ser desfeita. Deseja continuar?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCategory && handleDelete(deletingCategory)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

