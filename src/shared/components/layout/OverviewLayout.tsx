import { useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@shared/lib/cn";
import { useScrollToTop } from "@shared/hooks/useScrollToTop";
import { OverviewSidebar } from "./OverviewSidebar";
import { NavbarOverview } from "./NavbarOverview";

export function OverviewLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useScrollToTop();

  return (
    <div className="flex h-dvh overflow-hidden bg-base font-sans">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/80 sm:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 shadow-2xl transition-transform duration-300",
          "sm:sticky sm:top-0 sm:h-dvh sm:shrink-0 sm:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Sidebar"
      >
        <OverviewSidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col bg-base">
        <NavbarOverview onMenuClick={() => setSidebarOpen(true)} />

        <main
          id="main"
          className="flex-1 scrollbar-gutter-stable overflow-y-scroll px-4 pt-4 pb-12 sm:px-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
