"use client";
import { TopBar } from "@/components/shell/TopBar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar publicLink />
      {children}
    </div>
  );
}
