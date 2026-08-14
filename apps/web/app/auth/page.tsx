"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { BRAND } from "@/lib/brand";
import { storeHomePath } from "@/lib/stores";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={BRAND.logoUrl} alt={BRAND.name} className="h-14 mx-auto mb-4 object-contain" />
          <p className="text-ink-secondary italic">{BRAND.tagline}</p>
        </div>

        <div className="card">
          <AuthForm onSuccess={() => router.replace(redirect)} />
        </div>

        <p className="text-center mt-6">
          <a href={storeHomePath()} className="text-sm text-ink-soft hover:text-rose-deep">← Volver a la tienda</a>
        </p>
      </div>
    </div>
  );
}
