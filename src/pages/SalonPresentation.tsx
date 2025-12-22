import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PresentationButton } from "@/components/presentation/PresentationButton";
import { SocialIcons } from "@/components/presentation/SocialIcons";
import {
  mergeButtons,
  normalizeHexColor,
  PresentationButton as ButtonType,
} from "@/utils/presentationUtils";

interface PublicProfile {
  user_id: string;
  slug: string;
  business_name: string;
  about: string | null;
  agendamento_online_ativo: boolean;
}

interface Presentation {
  profile_image_url?: string | null;
  title?: string | null;
  description?: string | null;
  primary_color?: string | null;
  buttons?: ButtonType[] | null;
  social_links?: any;
  whatsapp_number?: string | null;
  is_active: boolean;
}

export default function SalonPresentation() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["public-profile-presentation", slug],
    queryFn: async (): Promise<PublicProfile | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, slug, business_name, about, agendamento_online_ativo")
        .eq("slug", slug)
        .eq("agendamento_online_ativo", true)
        .maybeSingle();

      if (error) throw error;
      return data as PublicProfile | null;
    },
    enabled: !!slug,
    retry: false,
  });

  const { data: presentation, isLoading: presentationLoading } = useQuery({
    queryKey: ["salon-presentation", profile?.user_id],
    queryFn: async (): Promise<Presentation | null> => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase
        .from("salon_presentation")
        .select("*")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      if (error) throw error;
      return data as Presentation | null;
    },
    enabled: !!profile?.user_id,
    retry: false,
  });

  // Redireciona para agendamento se não houver vitrine ativa
  useEffect(() => {
    if (!slug || profileLoading || presentationLoading) return;
    if (!presentation || !presentation.is_active) {
      navigate(`/agendar/${slug}`, { replace: true });
    }
  }, [navigate, presentation, presentationLoading, profileLoading, slug]);

  useEffect(() => {
    if (presentation?.title || profile?.business_name) {
      document.title = presentation?.title || profile?.business_name;
    }
  }, [presentation?.title, profile?.business_name]);

  const primaryColor = normalizeHexColor(presentation?.primary_color);

  const buttons = useMemo(
    () => mergeButtons(slug || "", presentation?.buttons, presentation?.whatsapp_number),
    [presentation?.buttons, presentation?.whatsapp_number, slug]
  );

  const heroGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 50%, #ffffff 100%)`;

  const loading = profileLoading || presentationLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f7e8ff] via-[#fce7f3] to-[#e9d5ff] flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-6 animate-pulse">
          <div className="h-28 rounded-3xl bg-white/60" />
          <div className="h-16 rounded-2xl bg-white/60" />
          <div className="h-16 rounded-2xl bg-white/60" />
          <div className="h-10 rounded-full bg-white/60" />
        </div>
      </div>
    );
  }

  if (!presentation || !presentation.is_active || !profile) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full px-4 py-8 flex justify-center"
      style={{ background: heroGradient }}
    >
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center gap-6 text-center mb-6">
          <div className="h-28 w-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white/60 flex items-center justify-center">
            {presentation.profile_image_url ? (
              <img
                src={presentation.profile_image_url}
                alt={presentation.title || profile.business_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-3xl font-bold text-white drop-shadow-sm">
                {profile.business_name?.charAt(0)}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">
              {presentation.title || profile.business_name}
            </h1>
            {presentation.description && (
              <p className="text-white/90 leading-relaxed">{presentation.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {buttons.map((btn) => {
            const href =
              btn.type === "online"
                ? `/agendar/${slug}`
                : btn.type === "whatsapp"
                ? btn.url
                : btn.url || "/";
            return (
              <PresentationButton
                key={btn.id}
                label={btn.label}
                href={href || undefined}
                color={primaryColor}
                external={btn.type !== "online"}
              />
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center gap-6">
          <SocialIcons socialLinks={presentation.social_links} color={primaryColor} />
          <div className="w-full h-32 rounded-3xl overflow-hidden shadow-lg">
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
                  parent.innerHTML = `
                    <div class="footer-fallback w-full h-full rounded-3xl bg-white/25 border border-white/30 shadow-inner backdrop-blur">
                      <div class="h-full w-full rounded-3xl bg-gradient-to-r from-white/60 via-white/30 to-white/10"></div>
                    </div>
                  `;
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

