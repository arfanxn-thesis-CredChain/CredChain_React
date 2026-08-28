import { Outlet } from "react-router-dom";
import { CopyrightFooter } from "@shared/components/CopyrightFooter";
import { useScrollToTop } from "@shared/hooks/useScrollToTop";
import { NavbarPublic } from "./NavbarPublic";

export function PublicLayout() {
  useScrollToTop();
  return (
    <div
      id="main"
      className="flex h-dvh flex-col overflow-y-scroll scrollbar-gutter-stable bg-base text-navy"
    >
      <NavbarPublic />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-4 pb-12 sm:px-8">
        <Outlet />
      </main>

      <CopyrightFooter />
    </div>
  );
}
