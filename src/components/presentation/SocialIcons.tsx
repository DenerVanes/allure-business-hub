import { Instagram, Music2, Facebook, MapPin } from "lucide-react";
import { PresentationSocialLinks } from "@/utils/presentationUtils";

type Props = {
  socialLinks?: PresentationSocialLinks | null;
  color: string;
};

const socials = [
  { key: "instagram", icon: Instagram },
  { key: "tiktok", icon: Music2 },
  { key: "facebook", icon: Facebook },
  { key: "google_maps", icon: MapPin },
];

export const SocialIcons = ({ socialLinks, color }: Props) => {
  if (!socialLinks) return null;

  return (
    <div className="flex items-center justify-center gap-4">
      {socials.map(({ key, icon: Icon }) => {
        const url = (socialLinks as any)?.[key];
        if (!url) return null;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ color }}
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
};

