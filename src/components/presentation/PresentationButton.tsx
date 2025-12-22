import React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

type Props = {
  label: string;
  href?: string;
  onClick?: () => void;
  color: string;
  icon?: React.ReactNode;
  external?: boolean;
};

export const PresentationButton = ({ label, href, onClick, color, icon, external }: Props) => {
  const baseContent = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <span className="text-white/90">{icon}</span>}
        <span className="font-semibold text-white">{label}</span>
      </div>
      {external && <ArrowUpRight className="h-4 w-4 text-white/80" />}
    </div>
  );

  const style = {
    background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}dd 100%)`,
  };

  const baseClasses = cn(
    "block w-full rounded-2xl p-4 shadow-md transition-all duration-200 active:scale-[0.99]",
    "border border-white/20 backdrop-blur",
    "hover:shadow-lg hover:-translate-y-0.5"
  );

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : "_self"}
        rel="noopener noreferrer"
        onClick={onClick}
        className={baseClasses}
        style={style}
      >
        {baseContent}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={baseClasses}
      style={style}
    >
      {baseContent}
    </button>
  );
};

