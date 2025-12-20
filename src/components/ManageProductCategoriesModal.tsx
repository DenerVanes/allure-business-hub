import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
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
import { FolderOpen, Plus, Edit2, Trash2, Tag, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const categorySchema = z.object({
  name: z.string().min(1, 'Nome da categoria é obrigatório'),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface ManageProductCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryAdded?: (category: string) => void;
}

export const ManageProductCategoriesModal = ({ 
  open, 
  onOpenChange,
  onCategoryAdded
}: ManageProductCategoriesModalProps) => {
  const { user } = useAuth();
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
    },
  });

  const editForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });
  
  // Categorias padrão antigas (para filtrar do localStorage se existirem)
  const oldDefaultCategories = [
    'Cabelo',
    'Unha',
    'Pele',
    'Maquiagem',
    'Acessórios',
    'Equipamentos',
    'Produtos Químicos',
    'Higiene',
    'Geral'
  ];

  useEffect(() => {
    if (user?.id && open) {
      const stored = localStorage.getItem(`product-categories-${user.id}`);
      if (stored) {
        const categories = JSON.parse(stored);
        // Filtrar categorias padrão antigas caso ainda existam no localStorage
        const filteredCategories = categories.filter((cat: string) => 
          !oldDefaultCategories.includes(cat)
        );
        setCustomCategories(filteredCategories);
        // Se foram filtradas, atualizar o localStorage
        if (filteredCategories.length !== categories.length) {
          localStorage.setItem(`product-categories-${user.id}`, JSON.stringify(filteredCategories));
        }
      } else {
        setCustomCategories([]);
      }
    }
  }, [user?.id, open]);

  // Usar apenas categorias customizadas
  const allCategories = customCategories;

  const handleSubmit = (data: CategoryForm) => {
    if (!user?.id) return;

    if (allCategories.includes(data.name)) {
      toast({
        title: 'Categoria já existe',
        description: 'Esta categoria já está cadastrada.',
        variant: 'destructive',
      });
      return;
    }

    const newCategories = [...customCategories, data.name];
    setCustomCategories(newCategories);
    localStorage.setItem(`product-categories-${user.id}`, JSON.stringify(newCategories));
    // Disparar evento customizado para atualizar outros componentes
    window.dispatchEvent(new Event('categoryUpdated'));
    
    toast({
      title: 'Categoria adicionada',
      description: 'Nova categoria adicionada com sucesso.',
    });
    
    form.reset();
    setShowNewCategory(false);
    onCategoryAdded?.(data.name);
  };

  const handleEdit = (category: string) => {
    setEditingCategory(category);
    editForm.reset({ name: category });
  };

  const handleSaveEdit = (data: CategoryForm) => {
    if (!editingCategory || !user?.id) return;

    // Verificar se o novo nome já existe
    if (data.name !== editingCategory && allCategories.includes(data.name)) {
      toast({
        title: 'Categoria já existe',
        description: 'Esta categoria já está cadastrada.',
        variant: 'destructive',
      });
      return;
    }

    // Atualizar na lista de customizadas
    const index = customCategories.indexOf(editingCategory);
    if (index !== -1) {
      const updatedCustomCategories = [...customCategories];
      updatedCustomCategories[index] = data.name;
      setCustomCategories(updatedCustomCategories);
      localStorage.setItem(`product-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
      // Disparar evento customizado para atualizar outros componentes
      window.dispatchEvent(new Event('categoryUpdated'));
    }
    
    toast({
      title: 'Categoria atualizada',
      description: 'Categoria foi renomeada com sucesso.',
    });
    setEditingCategory(null);
    editForm.reset();
    onCategoryAdded?.(data.name);
  };

  const handleDelete = (category: string) => {
    if (!user?.id) return;

    // Remover da lista de customizadas
    const updatedCustomCategories = customCategories.filter(c => c !== category);
    setCustomCategories(updatedCustomCategories);
    localStorage.setItem(`product-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
    // Disparar evento customizado para atualizar outros componentes
    window.dispatchEvent(new Event('categoryUpdated'));
    
    toast({
      title: 'Categoria excluída',
      description: 'Categoria foi removida com sucesso.',
    });
    setDeletingCategory(null);
    onCategoryAdded?.('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col" style={{ borderRadius: '20px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#5A2E98' }}>
              <FolderOpen className="h-5 w-5" style={{ color: '#8E44EC' }} />
              Gerenciar Categorias de Produtos
            </DialogTitle>
            <DialogDescription className="text-[#5A4A5E]">
              Organize suas categorias de produtos. Adicione novas categorias personalizadas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Button
              onClick={() => setShowNewCategory(true)}
              className="w-full rounded-full flex-shrink-0"
              style={{ backgroundColor: '#8E44EC', color: 'white' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>

            <div 
              className="overflow-y-auto pr-2 custom-scrollbar"
              style={{ 
                maxHeight: '400px'
              }}
            >
              <div className="space-y-2">
                {allCategories.map((category) => {
                  const isEditing = editingCategory === category;

                  return (
                    <div
                      key={category}
                      className="flex items-center gap-3 p-3 border rounded-xl hover:bg-[#FCFCFD] transition-colors"
                      style={{ borderColor: '#F7D5E8' }}
                    >
                      <Tag className="h-4 w-4 text-[#5A4A5E] flex-shrink-0" />
                      
                      {isEditing ? (
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
                                    <Input {...field} autoFocus style={{ borderRadius: '12px' }} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="rounded-full"
                              style={{ backgroundColor: '#8E44EC', color: 'white' }}
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
                            <span className="font-medium text-[#5A2E98]">{category}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(category);
                              }}
                              className="h-8 w-8 p-0 hover:bg-[#F7D5E8] transition-colors"
                              title="Editar categoria"
                            >
                              <Edit2 
                                className="h-4 w-4" 
                                style={{ color: '#5A4A5E' }} 
                              />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingCategory(category);
                              }}
                              className="h-8 w-8 p-0 hover:bg-[#F7D5E8] transition-colors"
                              title="Excluir categoria"
                            >
                              <Trash2 
                                className="h-4 w-4" 
                                style={{ color: '#EB67A3' }} 
                              />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Categoria */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent className="sm:max-w-md" style={{ borderRadius: '20px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#5A2E98' }}>
              <Tag className="h-5 w-5" style={{ color: '#8E44EC' }} />
              Nova Categoria
            </DialogTitle>
            <DialogDescription className="text-[#5A4A5E]">
              Adicione uma nova categoria de produto.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Cabelo, Unha, Pele..." 
                        {...field} 
                        className="text-base"
                        style={{ borderRadius: '12px' }}
                      />
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
                  className="rounded-full"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="rounded-full px-6"
                  style={{ backgroundColor: '#8E44EC', color: 'white' }}
                >
                  Criar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Alert de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent style={{ borderRadius: '20px' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCategory && handleDelete(deletingCategory)}
              className="rounded-full"
              style={{ backgroundColor: '#EB67A3', color: 'white' }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

