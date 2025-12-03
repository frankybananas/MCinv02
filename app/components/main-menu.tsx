"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DashboardTab } from "../types";
import {
  CarIcon,
  CheckCircle,
  Clock,
  BookmarkCheck,
  Tag,
  Wand2,
  Users,
  Truck,
  Bell,
  Calendar,
  Shield,
  Wrench,
} from "lucide-react";

interface MainMenuProps {
  activeStatus: DashboardTab;
  onStatusFilterChange: (tab: DashboardTab) => void;
  unreadNotificationsCount?: number;
  todoEnabled?: boolean;
  marketingEnabled?: boolean;
  userRole?: string | null;
  className?: string;
  onAdminNavigate?: () => void;
}

type MenuItemId = DashboardTab;

type MenuItem = {
  id: MenuItemId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: number;
};

const iconProps = "h-4 w-4";

const MENU_ITEM_ID_PREFIX = "main-menu-item-";

function MainMenuComponent({
  activeStatus,
  onStatusFilterChange,
  unreadNotificationsCount = 0,
  todoEnabled = false,
  marketingEnabled = false,
  userRole,
  className,
  onAdminNavigate,
}: MainMenuProps) {
  const router = useRouter();
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  
  const handleAdminNavigate = React.useCallback(() => {
    if (typeof onAdminNavigate === "function") {
      onAdminNavigate();
      return;
    }
    try {
      router.push("/admin");
    } catch (error) {
      console.error("Navigation to admin failed", error);
      // Fallback
      window.location.href = "/admin";
    }
  }, [onAdminNavigate, router]);

  const handleReconNavigate = React.useCallback(() => {
    try {
      router.push("/recon");
    } catch (error) {
      console.error("Navigation to recon failed", error);
      // Fallback
      window.location.href = "/recon";
    }
  }, [router]);

  const menuItems = React.useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { id: "all", label: "All", icon: CarIcon },
      { id: "in-stock", label: "In-Stock", icon: CheckCircle },
      { id: "coming", label: "Coming", icon: Clock },
      { id: "reserved", label: "Reserved", icon: BookmarkCheck },
      { id: "sold", label: "Sold", icon: Tag },
      { id: "demo", label: "Demo", icon: Wand2 },
      { id: "clients", label: "Clients", icon: Users },
      { id: "delivery", label: "Delivery", icon: Truck },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        badge: Math.max(0, unreadNotificationsCount || 0),
      },
    ];

    if (todoEnabled) {
      items.push({ id: "todo", label: "TODO", icon: Calendar });
    }

    // Add marketing after TODO when enabled or active
    if (marketingEnabled || activeStatus === "marketing") {
      items.push({ id: "marketing", label: "Marketing", icon: Wand2 });
    }

    // Add Recon if role permits OR if we are currently on the Recon page
    if (activeStatus === "recon" || userRole === "admin" || userRole === "manager" || userRole === "recon") {
      items.push({ id: "recon", label: "Recon", icon: Wrench });
    }

    // Add Admin if role permits OR if we are currently on the Admin page
    if (activeStatus === "admin" || userRole === "admin") {
      items.push({ id: "admin", label: "Admin", icon: Shield });
    }

    return items;
  }, [todoEnabled, marketingEnabled, unreadNotificationsCount, userRole, activeStatus]);

  React.useEffect(() => {
    try {
      const container = scrollContainerRef.current;
      if (!container) return;
      const targetId = `${MENU_ITEM_ID_PREFIX}${activeStatus}`;
      const target = container.querySelector<HTMLElement>(`#${targetId}`);
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    } catch (error) {
      console.warn("Could not scroll menu into view", error);
    }
  }, [activeStatus]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 sm:px-6",
        className,
      )}
    >
      {/* DEBUG OVERLAY */}
      <div className="fixed left-0 top-1/2 bg-black/80 text-white p-2 text-[10px] z-[9999] pointer-events-none">
        Status: {activeStatus}<br/>
        Role: {String(userRole)}
      </div>

      <div className="pointer-events-auto w-full max-w-4xl pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <nav
          aria-label="Primary navigation"
          className="rounded-3xl border border-white/25 bg-white/55 text-sm font-medium shadow-[0_18px_48px_-24px_rgba(15,23,42,0.6)] backdrop-blur-2xl transition-colors duration-200 supports-[backdrop-filter]:bg-white/35 dark:border-slate-800/60 dark:bg-slate-900/65"
        >
          <div
            ref={scrollContainerRef}
            className="max-[320px]:overflow-visible overflow-x-auto px-3 sm:px-4 scroll-px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <ul className="flex items-center justify-start gap-1.5 py-1.5 sm:py-2 md:justify-center max-[320px]:flex-col max-[320px]:items-stretch">
              {menuItems.map((item) => {
                const isActive = activeStatus === item.id;
                return (
                  <li key={item.id} className="max-[320px]:w-full">
                    <button
                      id={`${MENU_ITEM_ID_PREFIX}${item.id}`}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.label}
                      onClick={() => {
                        if (item.id === "admin") {
                          handleAdminNavigate();
                          return;
                        }
                        if (item.id === "recon") {
                          handleReconNavigate();
                          return;
                        }
                        onStatusFilterChange(item.id as DashboardTab);
                      }}
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs sm:text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
                        isActive
                          ? "bg-slate-950/85 text-white shadow-[0_12px_32px_-16px_RGBA(15,23,42,0.8)]"
                          : "bg-white/15 text-slate-700 hover:bg-white/25 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10",
                      )}
                    >
                      <item.icon
                        aria-hidden="true"
                        className={cn(
                          iconProps,
                          isActive
                            ? "text-white"
                            : "text-slate-600 transition-colors dark:text-slate-300",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span
                          className={cn(
                            "ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
                            isActive
                              ? "bg-white text-slate-900"
                              : "bg-blue-600 text-white dark:bg-blue-500",
                          )}
                          aria-label={`${item.badge} unread notifications`}
                        >
                          {Math.min(item.badge, 99)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-[calc(env(safe-area-inset-bottom))]" aria-hidden="true" />
    </div>
  );
}

export const MainMenu = React.memo(MainMenuComponent);
MainMenu.displayName = "MainMenu";
