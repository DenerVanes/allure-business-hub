import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PresentationButton } from "@/components/presentation/PresentationButton";
import { SocialIcons } from "@/components/presentation/SocialIcons";
import {
  buildWhatsAppLink,
  getDefaultButtons,
  normalizeHexColor,
  PresentationButton as Btn,
  PresentationSocialLinks,
  validateHex,
  validateUrl,
} from "@/utils/presentationUtils";
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Plus, Save, Trash2 } from "lucide-react";

const buttonSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Informe o texto do botão"),
  type: z.enum(["online", "whatsapp", "external"]),
  url: z.string().optional().refine(validateUrl, "URL inválida"),
  active: z.boolean(),
  order: z.number().optional(),
});

const socialSchema = z.object({
  instagram: z.string().optional().refine(validateUrl, "URL inválida"),
  tiktok: z.string().optional().refine(validateUrl, "URL inválida"),
  facebook: z.string().optional().refine(validateUrl, "URL inválida"),
  google_maps: z.string().optional().refine(validateUrl, "URL inválida"),
});

const formSchema = z.object({
  title: z.string().min(1, "Nome é obrigatório"),
  description: z.string().max(160, "Máximo 160 caracteres").optional(),
  primary_color: z
    .string()
    .optional()
    .refine(validateHex, "Use o formato #RRGGBB"),
  whatsapp_number: z
    .string()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Informe ao menos 10 dígitos"),
  is_active: z.boolean().default(false),
  buttons: z.array(buttonSchema).max(10, "Limite de 10 botões"),
  social_links: socialSchema.optional(),
  profile_image_url: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

export default function PresentationSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("slug, business_name, agendamento_online_ativo, user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0, // Sempre recarregar ao voltar para a página
    refetchOnMount: true,
  });

  const { data: presentation, isLoading: presentationLoading } = useQuery({
    queryKey: ["salon-presentation-admin", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("salon_presentation")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 0, // Sempre recarregar ao voltar para a página
    refetchOnMount: true,
  });

  const defaultButtons = useMemo(
    () => getDefaultButtons(profile?.slug || "", presentation?.whatsapp_number || undefined),
    [presentation?.whatsapp_number, profile?.slug]
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: presentation?.title || profile?.business_name || "",
      description: presentation?.description || "",
      primary_color: presentation?.primary_color || "#9333EA",
      whatsapp_number: presentation?.whatsapp_number || "",
      is_active: presentation?.is_active || false,
      buttons: presentation?.buttons || [],
      social_links: presentation?.social_links || {},
      profile_image_url: presentation?.profile_image_url || "",
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "buttons",
  });

  const createId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `btn-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    // Sempre resetar quando os dados chegarem, mesmo que sejam null/undefined
    if (profile) {
      const resetData = {
        title: presentation?.title || profile?.business_name || "",
        description: presentation?.description || "",
        primary_color: presentation?.primary_color || "#9333EA",
        whatsapp_number: presentation?.whatsapp_number || "",
        is_active: presentation?.is_active || false,
        buttons: Array.isArray(presentation?.buttons) ? presentation?.buttons : [],
        social_links: presentation?.social_links || {},
        profile_image_url: presentation?.profile_image_url || "",
      };
      form.reset(resetData);
    }
  }, [presentation, profile]);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) throw new Error("Use JPG, PNG ou WEBP");
      if (file.size > 5 * 1024 * 1024) throw new Error("Máximo 5MB");

      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `presentations/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("photos").getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (err: any) {
      console.error("Erro ao fazer upload", err);
      toast({
        title: "Erro no upload",
        description: err?.message || "Não foi possível enviar a imagem",
        variant: "destructive",
      });
      return null;
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (!user?.id) throw new Error("Usuário não encontrado");

      const safeButtons = values.buttons.slice(0, 10).map((btn, idx) => ({
        ...btn,
        order: btn.order ?? idx + defaultButtons.length,
      }));

      // O slug agora é gerado automaticamente, então sempre permite ativar
      // se houver nome do salão configurado
      const canActivate = !!(profile?.slug || profile?.business_name);
      const finalIsActive = values.is_active && canActivate;

      const payload = {
        user_id: user.id,
        title: values.title,
        description: values.description,
        primary_color: normalizeHexColor(values.primary_color),
        whatsapp_number: values.whatsapp_number || null,
        is_active: finalIsActive,
        buttons: safeButtons,
        social_links: values.social_links || {},
        profile_image_url: values.profile_image_url || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("salon_presentation")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salon-presentation-admin", user?.id] });
      toast({ title: "Vitrine salva", description: "Alterações publicadas com sucesso." });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível salvar a vitrine",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (fields.length > 10) {
      toast({
        title: "Limite excedido",
        description: "Máximo de 10 botões personalizados.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data);
  };

  const previewButtons = useMemo(() => {
    if (!profile?.slug) {
      // Retornar botão padrão mesmo sem slug para evitar preview vazio
      // Mas tentar obter WhatsApp do presentation se disponível
      const fallbackWhatsApp = presentation?.whatsapp_number || undefined;
      return getDefaultButtons("", fallbackWhatsApp);
    }
    
    // Usar valores do form se disponíveis, senão usar presentation diretamente
    // Isso garante que sempre temos valores mesmo quando o form ainda não foi resetado
    const formWhatsApp = form.watch("whatsapp_number");
    const formButtons = form.watch("buttons");
    
    // Priorizar: form > presentation > undefined
    // IMPORTANTE: Sempre tentar obter do presentation primeiro se o form estiver vazio
    // Isso garante que o WhatsApp apareça mesmo quando o form ainda não foi resetado
    const whatsappFromForm = formWhatsApp && formWhatsApp.trim().length > 0 ? formWhatsApp : null;
    const whatsappFromPresentation = presentation?.whatsapp_number && presentation.whatsapp_number.trim().length > 0 
      ? presentation.whatsapp_number 
      : null;
    
    // Usar o que estiver disponível (form tem prioridade, mas presentation é fallback importante)
    const whatsappNumber = whatsappFromForm || whatsappFromPresentation || undefined;
    
    const customButtons = (Array.isArray(formButtons) && formButtons.length > 0) 
      ? formButtons 
      : (Array.isArray(presentation?.buttons) ? presentation?.buttons : []);
    
    // Sempre obter botões padrão (online e whatsapp se houver número)
    // Passar o número para garantir que o WhatsApp apareça quando houver número configurado
    const defaultBtns = getDefaultButtons(profile.slug, whatsappNumber);
    
    // Filtrar botões customizados ativos que não sejam duplicatas dos padrões
    const activeCustomBtns = customButtons.filter((b: any) => {
      if (!b || b.active === false) return false;
      // Não incluir se já existe um padrão do mesmo tipo (online ou whatsapp)
      const hasDefaultOfType = defaultBtns.some((db) => db.type === b.type);
      return !hasDefaultOfType;
    });
    
    // Combinar: padrões primeiro (sempre presentes), depois customizados
    const allButtons = [...defaultBtns, ...activeCustomBtns];
    
    // Ordenar por order (botões padrão têm order 0 e 1)
    return allButtons.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [
    profile?.slug, 
    form.watch("whatsapp_number"), 
    form.watch("buttons"), 
    presentation?.whatsapp_number, 
    presentation?.buttons
  ]);

  // Usar cor do form ou fallback para presentation
  const primaryColor = normalizeHexColor(
    form.watch("primary_color") || presentation?.primary_color || "#9333EA"
  );

  // Estado de loading
  const isLoading = profileLoading || presentationLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tela de Apresentação</h1>
          <p className="text-muted-foreground">
            Personalize a vitrine pública antes do agendamento.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/configuracoes")}>
          Voltar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label>Foto do salão</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-muted overflow-hidden border">
                    {form.watch("profile_image_url") ? (
                      <img
                        src={form.watch("profile_image_url") || ""}
                        alt="Foto do salão"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                        Sem foto
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setFileName(file.name);
                      const url = await uploadImage(file);
                      setUploading(false);
                      if (url) form.setValue("profile_image_url", url, { shouldDirty: true });
                    }}
                    disabled={uploading}
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {fileName ? `Trocar foto (${fileName})` : "Escolher foto"}
                  </Button>
                </div>
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando imagem...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nome do salão</Label>
                <Input placeholder="Ex: Studio Bela" {...form.register("title")} />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Descrição curta</Label>
                <Textarea
                  placeholder="Breve apresentação (máx 160 caracteres)"
                  maxLength={160}
                  {...form.register("description")}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Cor primária</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    className="w-16 p-1"
                    value={form.watch("primary_color") || "#9333EA"}
                    onChange={(e) => form.setValue("primary_color", e.target.value, { shouldDirty: true })}
                  />
                  <Input placeholder="#9333EA" {...form.register("primary_color")} />
                </div>
                {form.formState.errors.primary_color && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.primary_color.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Número do WhatsApp</Label>
                <Input placeholder="5511999999999" {...form.register("whatsapp_number")} />
                {form.formState.errors.whatsapp_number && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.whatsapp_number.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Botões personalizados (máx 10)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      append({
                        id: createId(),
                        label: "Novo botão",
                        type: "external",
                        url: "https://",
                        active: true,
                        order: fields.length + defaultButtons.length,
                      })
                    }
                    disabled={fields.length >= 10}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-lg border p-3 space-y-3 bg-muted/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Botão {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={index === 0}
                            onClick={() => move(index, index - 1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={index === fields.length - 1}
                            onClick={() => move(index, index + 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Texto</Label>
                        <Input {...form.register(`buttons.${index}.label` as const)} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <select
                            className="h-10 w-full rounded-md border bg-background px-3"
                            {...form.register(`buttons.${index}.type` as const)}
                          >
                            <option value="external">Link externo</option>
                            <option value="online">Agendamento Online</option>
                            <option value="whatsapp">WhatsApp</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label>URL</Label>
                          <Input
                            placeholder="https://"
                            {...form.register(`buttons.${index}.url` as const)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={form.watch(`buttons.${index}.active` as const)}
                          onCheckedChange={(checked) =>
                            form.setValue(`buttons.${index}.active` as const, !!checked, {
                              shouldDirty: true,
                            })
                          }
                        />
                        <span className="text-sm">Ativo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Redes sociais</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Instagram" {...form.register("social_links.instagram")} />
                  <Input placeholder="TikTok" {...form.register("social_links.tiktok")} />
                  <Input placeholder="Facebook" {...form.register("social_links.facebook")} />
                  <Input placeholder="Google Maps" {...form.register("social_links.google_maps")} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.watch("is_active")}
                    disabled={!profile?.business_name}
                    onCheckedChange={(checked) =>
                      form.setValue("is_active", !!checked, { shouldDirty: true })
                    }
                  />
                  <span>Ativar vitrine pública</span>
                </div>
                {!profile?.business_name && (
                  <p className="text-sm text-amber-600 dark:text-amber-500 ml-6">
                    ⚠️ Para ativar a vitrine, configure o nome do salão nas{" "}
                    <a 
                      href="/configuracoes" 
                      className="underline font-medium hover:text-amber-700"
                    >
                      Configurações gerais
                    </a>
                    . O slug será gerado automaticamente a partir do nome.
                  </p>
                )}
                {profile?.slug && (
                  <p className="text-sm text-muted-foreground ml-6">
                    ✓ Slug gerado automaticamente: <code className="bg-muted px-1 rounded">{profile.slug}</code>
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Vitrine
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle>Preview (mobile)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !profile?.slug ? (
              <div className="mx-auto w-[360px] rounded-3xl border bg-white shadow-2xl overflow-hidden p-6">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="mx-auto w-[360px] rounded-3xl border bg-white shadow-2xl overflow-hidden">
              <div
                className="p-6"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 55%, #ffffff 100%)`,
                }}
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="h-20 w-20 rounded-full bg-white/40 border-4 border-white overflow-hidden shadow">
                    {(form.watch("profile_image_url") || presentation?.profile_image_url) ? (
                      <img
                        src={form.watch("profile_image_url") || presentation?.profile_image_url || ""}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-white/80 m-auto" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {form.watch("title") || presentation?.title || profile?.business_name || "Seu salão"}
                    </h2>
                    {(form.watch("description") || presentation?.description) && (
                      <p className="text-white/90 text-sm mt-1">
                        {form.watch("description") || presentation?.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3 bg-white">
                {previewButtons.length > 0 ? (
                  previewButtons.map((btn) => {
                    // Usar valores do form ou fallback para presentation
                    // Garantir que sempre temos o número do WhatsApp quando disponível
                    const formWhatsApp = form.watch("whatsapp_number");
                    const presentationWhatsApp = presentation?.whatsapp_number;
                    const whatsappNumber = formWhatsApp || presentationWhatsApp || undefined;
                    
                    // Garantir que o número seja válido (não vazio)
                    const validWhatsAppNumber = whatsappNumber && whatsappNumber.trim().length > 0 
                      ? whatsappNumber 
                      : undefined;
                    
                    const href =
                      btn.type === "online"
                        ? `/agendar/${profile?.slug || ""}`
                        : btn.type === "whatsapp"
                        ? buildWhatsAppLink(validWhatsAppNumber) || btn.url
                        : btn.url;
                    return (
                      <PresentationButton
                        key={btn.id}
                        label={btn.label}
                        href={href || undefined}
                        color={primaryColor}
                        external={btn.type !== "online"}
                      />
                    );
                  })
                ) : (
                  // Fallback: sempre mostrar pelo menos o botão online
                  profile?.slug ? (
                    <>
                      <PresentationButton
                        label="Agendamento Online"
                        href={`/agendar/${profile.slug}`}
                        color={primaryColor}
                        external={false}
                      />
                      {/* Mostrar WhatsApp também se houver número */}
                      {(form.watch("whatsapp_number") || presentation?.whatsapp_number) && (
                        <PresentationButton
                          label="Agendamento WhatsApp"
                          href={buildWhatsAppLink(form.watch("whatsapp_number") || presentation?.whatsapp_number) || undefined}
                          color={primaryColor}
                          external={true}
                        />
                      )}
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      Carregando...
                    </div>
                  )
                )}
                <div className="pt-4 pb-2 flex flex-col items-center gap-4">
                  <SocialIcons 
                    socialLinks={(form.watch("social_links") || presentation?.social_links || {}) as PresentationSocialLinks} 
                    color={primaryColor} 
                  />
                  <div className="w-full h-20 rounded-2xl overflow-hidden">
                    <img
                      src="/footer-image.jpg"
                      alt="Rodapé"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback para placeholder se a imagem não existir
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.footer-fallback')) {
                          parent.innerHTML = '<div class="footer-fallback w-full h-full rounded-2xl bg-gradient-to-r from-gray-100 to-gray-200"></div>';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

