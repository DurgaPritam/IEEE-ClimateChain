"use client";
import { TopBar } from "@/components/shell/TopBar";
import { useApp } from "@/components/shell/AppState";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { backendError } = useApp();
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      {backendError && (
        <div className="border-b border-block bg-block-bg px-7 py-2.5 text-small">{backendError}</div>
      )}
      {children}
    </div>
  );
}
