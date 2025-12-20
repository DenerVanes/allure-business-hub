import { useState } from 'react';
import { Megaphone, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export const MarketingMenu = () => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = location.pathname === '/marketing/aniversariantes' || location.pathname === '/marketing/upsell-downsell';

  const handleClick = () => {
    if (!collapsed) {
      setIsOpen(!isOpen);
    }
  };

  const handleAniversariantesClick = () => {
    navigate('/marketing/aniversariantes');
  };

  const handleUpsellDownsellClick = () => {
    navigate('/marketing/upsell-downsell');
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleClick}
          className="w-full justify-between transition-all duration-200 hover:bg-accent rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Megaphone className="h-5 w-5" />
            {!collapsed && <span className="text-sm">Marketing</span>}
          </div>
          {!collapsed && (
            <div className={cn(
              "transition-transform duration-200",
              isOpen ? "rotate-0" : "-rotate-90"
            )}>
              <ChevronDown className="h-4 w-4" />
            </div>
          )}
        </SidebarMenuButton>
        {isOpen && !collapsed && (
          <SidebarMenuSub className="mt-2">
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                onClick={handleAniversariantesClick}
                className={cn(
                  "pl-8 transition-all duration-200 rounded-lg cursor-pointer py-2",
                  location.pathname === '/marketing/aniversariantes'
                    ? "bg-primary-light text-primary font-medium" 
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="text-sm">Aniversariantes</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                onClick={handleUpsellDownsellClick}
                className={cn(
                  "pl-8 transition-all duration-200 rounded-lg cursor-pointer py-2",
                  location.pathname === '/marketing/upsell-downsell'
                    ? "bg-primary-light text-primary font-medium" 
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="text-sm">Upsell / Downsell</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

