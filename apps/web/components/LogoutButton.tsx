"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.replace("/");
      }}
      className="card flex items-center gap-3 hover:shadow-lift transition w-full text-left text-ink-secondary"
    >
      <LogOut className="w-5 h-5" /> Cerrar sesión
    </button>
  );
}
