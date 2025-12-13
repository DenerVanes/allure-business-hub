import { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FolderOpen, 
  Edit2, 
  Trash2, 
  Plus,
  X,
  Tag
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Interface para categorias com tipo de custo
interface CategoryInfo {
  name: string;
  costType: 'fixo' | 'variável' | null;
}

const categorySchema = z.object({
  name: z.string().min(1, 'Nome da categoria é obrigatório'),
  costType: z.enum(['fixo', 'variável']).nullable(),
});

const editCategorySchema = z.object({
  name: z.string().min(1, 'Nome da categoria é obrigatório'),
  costType: z.enum(['fixo', 'variável']).nullable(),
});

type CategoryForm = z.infer<typeof categorySchema>;
type EditCategoryForm = z.infer<typeof editCategorySchema>;

interface ManageExpenseCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryAdded?: (category: string) => void;
}

// Categorias padrão de despesa que não podem ser deletadas
const defaultExpenseCategories = [
  'Produtos',
  'Aluguel',
  'Funcionária',
  'Reposição de Estoque',
  'Energia',
  'Água',
  'Internet',
  'Marketing',
  'Transporte',
  'Manutenção',
  'Equipamentos',
  'Outros'
];

// Categorias padrão de receita que não podem ser deletadas
const defaultIncomeCategories = [
  'Serviços',
  'Produtos',
  'Consultoria',
  'Vendas',
  'Comissões',
  'Outros'
];

// Função auxiliar para converter string[] para CategoryInfo[]
const migrateCategoriesToInfo = (categories: string[]): CategoryInfo[] => {
  return categories.map(cat => typeof cat === 'string' ? { name: cat, costType: null } : cat);
};

// Função auxiliar para obter apenas os nomes das categorias
const getCategoryNames = (categories: CategoryInfo[]): string[] => {
  return categories.map(cat => typeof cat === 'string' ? cat : cat.name);
};

export const ManageExpenseCategoriesModal = ({ 
  open, 
  onOpenChange,
  onCategoryAdded
}: ManageExpenseCategoriesModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryInfo, setEditingCategoryInfo] = useState<CategoryInfo | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<CategoryInfo[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<CategoryInfo[]>([]);

  // Buscar categorias excluídas (padrão ou customizadas)
  const [excludedExpenseCategories, setExcludedExpenseCategories] = useState<string[]>([]);
  const [excludedIncomeCategories, setExcludedIncomeCategories] = useState<string[]>([]);
  
  useEffect(() => {
    if (user?.id && open) {
      // Carregar categorias de despesa
      const storedExpense = localStorage.getItem(`expense-categories-${user.id}`);
      if (storedExpense) {
        try {
          const parsed = JSON.parse(storedExpense);
          // Migrar de string[] para CategoryInfo[] se necessário
          const migrated = Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string'
            ? migrateCategoriesToInfo(parsed)
            : parsed;
          setCustomExpenseCategories(migrated);
        } catch {
          setCustomExpenseCategories([]);
        }
      } else {
        setCustomExpenseCategories([]);
      }
      
      const storedExcludedExpense = localStorage.getItem(`excluded-expense-categories-${user.id}`);
      if (storedExcludedExpense) {
        setExcludedExpenseCategories(JSON.parse(storedExcludedExpense));
      } else {
        setExcludedExpenseCategories([]);
      }

      // Carregar categorias de receita
      const storedIncome = localStorage.getItem(`income-categories-${user.id}`);
      if (storedIncome) {
        try {
          const parsed = JSON.parse(storedIncome);
          // Migrar de string[] para CategoryInfo[] se necessário
          const migrated = Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string'
            ? migrateCategoriesToInfo(parsed)
            : parsed;
          setCustomIncomeCategories(migrated);
        } catch {
          setCustomIncomeCategories([]);
        }
      } else {
        setCustomIncomeCategories([]);
      }
      
      const storedExcludedIncome = localStorage.getItem(`excluded-income-categories-${user.id}`);
      if (storedExcludedIncome) {
        setExcludedIncomeCategories(JSON.parse(storedExcludedIncome));
      } else {
        setExcludedIncomeCategories([]);
      }
    }
  }, [user?.id, open]);

  // Obter categorias visíveis baseado na aba ativa
  const getVisibleCategories = (): string[] => {
    if (activeTab === 'expense') {
      // Filtrar categorias padrão que não foram excluídas
      const visibleDefault = defaultExpenseCategories.filter(cat => !excludedExpenseCategories.includes(cat));
      // Categorias customizadas devem aparecer sempre (mesmo que o nome esteja na lista de excluídas como padrão)
      // porque se foram editadas, são customizadas agora
      const visibleCustom = getCategoryNames(customExpenseCategories);
      // Remover duplicatas caso uma categoria padrão e customizada tenham o mesmo nome
      const allVisible = [...visibleDefault, ...visibleCustom];
      const uniqueCategories = [...new Set(allVisible)];
      // Ordenar alfabeticamente
      return uniqueCategories.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    } else {
      // Filtrar categorias padrão que não foram excluídas
      const visibleDefault = defaultIncomeCategories.filter(cat => !excludedIncomeCategories.includes(cat));
      // Categorias customizadas devem aparecer sempre
      const visibleCustom = getCategoryNames(customIncomeCategories);
      // Remover duplicatas
      const allVisible = [...visibleDefault, ...visibleCustom];
      const uniqueCategories = [...new Set(allVisible)];
      // Ordenar alfabeticamente
      return uniqueCategories.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
  };

  // Obter informações completas de uma categoria
  const getCategoryInfo = (categoryName: string): CategoryInfo | null => {
    const customCategories = activeTab === 'expense' ? customExpenseCategories : customIncomeCategories;
    const found = customCategories.find(cat => cat.name === categoryName);
    if (found) return found;
    // Se não for customizada, retornar padrão sem tipo de custo
    const defaultCategories = activeTab === 'expense' ? defaultExpenseCategories : defaultIncomeCategories;
    if (defaultCategories.includes(categoryName)) {
      return { name: categoryName, costType: null };
    }
    return null;
  };

  const visibleCategories = getVisibleCategories();
  const defaultCategories = activeTab === 'expense' ? defaultExpenseCategories : defaultIncomeCategories;
  const customCategories = activeTab === 'expense' ? customExpenseCategories : customIncomeCategories;
  const excludedCategories = activeTab === 'expense' ? excludedExpenseCategories : excludedIncomeCategories;

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      costType: null,
    },
  });

  const editForm = useForm<EditCategoryForm>({
    resolver: zodResolver(editCategorySchema),
    defaultValues: {
      name: '',
      costType: null,
    },
  });

  const handleSaveCategory = (data: CategoryForm) => {
    if (!user?.id) return;

    const newCategory: CategoryInfo = {
      name: data.name,
      costType: data.costType,
    };

    if (activeTab === 'expense') {
      const newCategories = [...customExpenseCategories, newCategory];
      setCustomExpenseCategories(newCategories);
      localStorage.setItem(`expense-categories-${user.id}`, JSON.stringify(newCategories));
    } else {
      const newCategories = [...customIncomeCategories, newCategory];
      setCustomIncomeCategories(newCategories);
      localStorage.setItem(`income-categories-${user.id}`, JSON.stringify(newCategories));
    }
    
    toast({
      title: 'Categoria criada',
      description: 'Nova categoria adicionada com sucesso.',
    });
    
    form.reset();
    setShowNewCategory(false);
    onCategoryAdded?.(data.name);
  };

  const handleEdit = (category: string) => {
    setEditingCategory(category);
    const categoryInfo = getCategoryInfo(category);
    if (categoryInfo) {
      setEditingCategoryInfo(categoryInfo);
      editForm.reset({ 
        name: categoryInfo.name,
        costType: categoryInfo.costType,
      });
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = (data: EditCategoryForm) => {
    if (!editingCategory || !editingCategoryInfo || !user?.id) return;

    const isDefault = defaultCategories.includes(editingCategory);
    const updatedCategory: CategoryInfo = {
      name: data.name,
      costType: data.costType,
    };
    
    if (activeTab === 'expense') {
      let updatedCustomCategories = [...customExpenseCategories];
      let updatedExcluded = [...excludedExpenseCategories];
      
      if (isDefault) {
        // Se for padrão, excluir da lista padrão (para não aparecer mais como padrão)
        if (!updatedExcluded.includes(editingCategory)) {
          updatedExcluded.push(editingCategory);
        }
        // Adicionar ou atualizar como categoria customizada
        const existingIndex = updatedCustomCategories.findIndex(c => {
          const catName = typeof c === 'string' ? c : c.name;
          return catName === data.name;
        });
        if (existingIndex !== -1) {
          // Se já existe customizada com esse nome, atualizar
          updatedCustomCategories[existingIndex] = updatedCategory;
        } else {
          // Adicionar nova categoria customizada
          updatedCustomCategories.push(updatedCategory);
        }
      } else {
        // Se já for customizada, atualizar na lista
        const index = updatedCustomCategories.findIndex(c => {
          // Comparar com base no nome original (editingCategory)
          const catName = typeof c === 'string' ? c : c.name;
          return catName === editingCategory;
        });
        if (index !== -1) {
          updatedCustomCategories[index] = updatedCategory;
        } else {
          // Se não encontrou (pode ter mudado o nome), adicionar nova
          updatedCustomCategories.push(updatedCategory);
        }
      }
      
      setCustomExpenseCategories(updatedCustomCategories);
      setExcludedExpenseCategories(updatedExcluded);
      localStorage.setItem(`expense-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
      localStorage.setItem(`excluded-expense-categories-${user.id}`, JSON.stringify(updatedExcluded));
    } else {
      let updatedCustomCategories = [...customIncomeCategories];
      let updatedExcluded = [...excludedIncomeCategories];
      
      if (isDefault) {
        // Se for padrão, excluir da lista padrão (para não aparecer mais como padrão)
        if (!updatedExcluded.includes(editingCategory)) {
          updatedExcluded.push(editingCategory);
        }
        // Adicionar ou atualizar como categoria customizada
        const existingIndex = updatedCustomCategories.findIndex(c => {
          const catName = typeof c === 'string' ? c : c.name;
          return catName === data.name;
        });
        if (existingIndex !== -1) {
          // Se já existe customizada com esse nome, atualizar
          updatedCustomCategories[existingIndex] = updatedCategory;
        } else {
          // Adicionar nova categoria customizada
          updatedCustomCategories.push(updatedCategory);
        }
      } else {
        // Se já for customizada, atualizar na lista
        const index = updatedCustomCategories.findIndex(c => {
          // Comparar com base no nome original (editingCategory)
          const catName = typeof c === 'string' ? c : c.name;
          return catName === editingCategory;
        });
        if (index !== -1) {
          updatedCustomCategories[index] = updatedCategory;
        } else {
          // Se não encontrou (pode ter mudado o nome), adicionar nova
          updatedCustomCategories.push(updatedCategory);
        }
      }
      
      setCustomIncomeCategories(updatedCustomCategories);
      setExcludedIncomeCategories(updatedExcluded);
      localStorage.setItem(`income-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
      localStorage.setItem(`excluded-income-categories-${user.id}`, JSON.stringify(updatedExcluded));
    }
    
    toast({
      title: 'Categoria atualizada',
      description: 'Categoria foi atualizada com sucesso.',
    });
    setEditingCategory(null);
    setEditingCategoryInfo(null);
    setShowEditModal(false);
    editForm.reset();
    // Notificar que categoria foi atualizada
    onCategoryAdded?.(data.name);
  };

  const handleDelete = (category: string) => {
    if (!user?.id) return;

    const isDefault = defaultCategories.includes(category);
    
    if (activeTab === 'expense') {
      let updatedExcluded = [...excludedExpenseCategories];
      let updatedCustomCategories = [...customExpenseCategories];
      
      if (isDefault) {
        // Se for padrão, adicionar à lista de excluídas (para não aparecer mais como padrão)
        if (!updatedExcluded.includes(category)) {
          updatedExcluded.push(category);
        }
        // Também remover das customizadas se existir (caso tenha sido editada antes)
        updatedCustomCategories = updatedCustomCategories.filter(c => {
          const catName = typeof c === 'string' ? c : c.name;
          return catName !== category;
        });
        setCustomExpenseCategories(updatedCustomCategories);
        localStorage.setItem(`expense-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
      } else {
        // Se for customizada, remover da lista de customizadas
        updatedCustomCategories = updatedCustomCategories.filter(c => {
          const catName = typeof c === 'string' ? c : c.name;
          return catName !== category;
        });
        setCustomExpenseCategories(updatedCustomCategories);
        localStorage.setItem(`expense-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
      }
      
      // Atualizar lista de excluídas
      setExcludedExpenseCategories(updatedExcluded);
      localStorage.setItem(`excluded-expense-categories-${user.id}`, JSON.stringify(updatedExcluded));
    } else {
      let updatedExcluded = [...excludedIncomeCategories];
      let updatedCustomCategories = [...customIncomeCategories];
      
      if (isDefault) {
        // Se for padrão, adicionar à lista de excluídas (para não aparecer mais como padrão)
        if (!updatedExcluded.includes(category)) {
          updatedExcluded.push(category);
        }
        // Também remover das customizadas se existir (caso tenha sido editada antes)
        updatedCustomCategories = updatedCustomCategories.filter(c => {
          const catName = typeof c === 'string' ? c : c.name;
          return catName !== category;
        });
        setCustomIncomeCategories(updatedCustomCategories);
        localStorage.setItem(`income-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
      } else {
        // Se for customizada, remover da lista de customizadas
        updatedCustomCategories = updatedCustomCategories.filter(c => {
          const catName = typeof c === 'string' ? c : c.name;
          return catName !== category;
        });
        setCustomIncomeCategories(updatedCustomCategories);
        localStorage.setItem(`income-categories-${user.id}`, JSON.stringify(updatedCustomCategories));
      }
      
      // Atualizar lista de excluídas
      setExcludedIncomeCategories(updatedExcluded);
      localStorage.setItem(`excluded-income-categories-${user.id}`, JSON.stringify(updatedExcluded));
    }
    
    toast({
      title: 'Categoria excluída',
      description: 'Categoria foi removida com sucesso.',
    });
    setDeletingCategory(null);
    // Notificar que categoria foi deletada (passar string vazia para forçar atualização)
    onCategoryAdded?.('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col" style={{ borderRadius: '20px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#5A2E98' }}>
              <FolderOpen className="h-5 w-5" style={{ color: '#8E44EC' }} />
              Gerenciar Categorias
            </DialogTitle>
            <DialogDescription className="text-[#5A4A5E]">
              Organize suas categorias de despesa e receita. Adicione novas categorias personalizadas.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'expense' | 'income')} className="flex flex-col flex-1">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-[#F7D5E8] p-1">
              <TabsTrigger 
                value="expense" 
                className="rounded-full data-[state=active]:bg-[#8E44EC] data-[state=active]:text-white"
                style={{ color: activeTab === 'expense' ? 'white' : '#5A4A5E' }}
              >
                Despesa
              </TabsTrigger>
              <TabsTrigger 
                value="income" 
                className="rounded-full data-[state=active]:bg-[#8E44EC] data-[state=active]:text-white"
                style={{ color: activeTab === 'income' ? 'white' : '#5A4A5E' }}
              >
                Receita
              </TabsTrigger>
            </TabsList>

            <TabsContent value="expense" className="flex flex-col gap-4 mt-4 flex-1">
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
                  {visibleCategories.map((category) => {
                    const categoryInfo = getCategoryInfo(category);

                    return (
                      <div
                        key={category}
                        className="flex items-center gap-3 p-3 border rounded-xl hover:bg-[#FCFCFD] transition-colors"
                        style={{ borderColor: '#F7D5E8' }}
                      >
                        <Tag className="h-4 w-4 text-[#5A4A5E] flex-shrink-0" />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#5A2E98]">{category}</span>
                            {categoryInfo?.costType && (
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ 
                                  borderColor: categoryInfo.costType === 'variável' ? '#10B981' : '#8E44EC',
                                  color: categoryInfo.costType === 'variável' ? '#10B981' : '#8E44EC'
                                }}
                              >
                                {categoryInfo.costType === 'variável' ? 'Custo Variável' : 'Custo Fixo'}
                              </Badge>
                            )}
                          </div>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="income" className="flex flex-col gap-4 mt-4 flex-1">
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
                  {visibleCategories.map((category) => {
                    const categoryInfo = getCategoryInfo(category);

                    return (
                      <div
                        key={category}
                        className="flex items-center gap-3 p-3 border rounded-xl hover:bg-[#FCFCFD] transition-colors"
                        style={{ borderColor: '#F7D5E8' }}
                      >
                        <Tag className="h-4 w-4 text-[#5A4A5E] flex-shrink-0" />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#5A2E98]">{category}</span>
                            {categoryInfo?.costType && (
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ 
                                  borderColor: categoryInfo.costType === 'variável' ? '#10B981' : '#8E44EC',
                                  color: categoryInfo.costType === 'variável' ? '#10B981' : '#8E44EC'
                                }}
                              >
                                {categoryInfo.costType === 'variável' ? 'Custo Variável' : 'Custo Fixo'}
                              </Badge>
                            )}
                          </div>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Categoria */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md" style={{ borderRadius: '20px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#5A2E98' }}>
              <Edit2 className="h-5 w-5" style={{ color: '#8E44EC' }} />
              Editar Categoria
            </DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSaveEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Categoria</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Material de Limpeza..." 
                        {...field} 
                        className="text-base"
                        style={{ borderRadius: '12px' }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="costType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Custo</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'null' ? null : value)} 
                      value={field.value || 'null'}
                    >
                      <FormControl>
                        <SelectTrigger className="text-base" style={{ borderRadius: '12px' }}>
                          <SelectValue placeholder="Selecione o tipo de custo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">Não especificado</SelectItem>
                        <SelectItem value="fixo">Custo Fixo</SelectItem>
                        <SelectItem value="variável">Custo Variável</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCategory(null);
                    setEditingCategoryInfo(null);
                  }}
                  className="rounded-full"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="rounded-full px-6"
                  style={{ backgroundColor: '#8E44EC', color: 'white' }}
                >
                  Salvar
                </Button>
              </div>
            </form>
          </Form>
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
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveCategory)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Categoria</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Material de Limpeza, Telefone..." 
                        {...field} 
                        className="text-base"
                        style={{ borderRadius: '12px' }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {activeTab === 'expense' && (
                <FormField
                  control={form.control}
                  name="costType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Custo</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'null' ? null : value)} 
                        value={field.value || 'null'}
                      >
                        <FormControl>
                          <SelectTrigger className="text-base" style={{ borderRadius: '12px' }}>
                            <SelectValue placeholder="Selecione o tipo de custo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="null">Não especificado</SelectItem>
                          <SelectItem value="fixo">Custo Fixo</SelectItem>
                          <SelectItem value="variável">Custo Variável</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
