"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Instagram, Music2, Heart, Mail } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { DEFAULT_BRAND, type BrandInfo } from "@/lib/site-settings-types";
import StoreSwitchLink from "./StoreSwitchLink";
import { showsPortal } from "@/lib/stores";

export default function Footer() {
  const [brand, setBrand] = useState<BrandInfo>(DEFAULT_BRAND);
  // Solo tiene sentido ofrecer el cambio donde hay más de una tienda y este
  // deploy es el que tiene el selector.
  const showStoreSwitch = showsPortal();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "brand_info")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setBrand((prev) => ({ ...prev, ...data.value }));
      });
  }, []);

  return (
    <footer className="mt-16 border-t border-rose-primary/20 bg-[#0B0509]/95 backdrop-blur-sm text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
        <div>
          <img src={brand.logo_url} alt={brand.name} className="h-10 w-auto object-contain mb-3" />
          {brand.contact_email && (
            <a href={`mailto:${brand.contact_email}`} className="text-xs text-white/55 hover:text-rose-primary transition inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {brand.contact_email}
            </a>
          )}
        </div>
        <div>
          <h4 className="font-display font-semibold text-white mb-3">Tienda</h4>
          <ul className="space-y-2 text-sm text-white/65">
            <li><Link href="/shop" className="hover:text-rose-primary transition">Ver toda la tienda</Link></li>
            <li><Link href="/category/cosmetica" className="hover:text-rose-primary transition">Cosmética</Link></li>
            <li><Link href="/category/accesorios" className="hover:text-rose-primary transition">Accesorios</Link></li>
            <li><Link href="/category/promos" className="hover:text-rose-primary transition">Promos</Link></li>
            <li><Link href="/live" className="hover:text-rose-primary transition">LIVE</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold text-white mb-3">Conectá</h4>
          <div className="flex gap-3">
            {brand.show_instagram && brand.instagram_url && (
              <a href={brand.instagram_url} target="_blank" rel="noopener" className="p-2 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition" aria-label="Instagram">
                <Instagram className="w-5 h-5 text-rose-primary" />
              </a>
            )}
            {brand.show_tiktok && brand.tiktok_url && (
              <a href={brand.tiktok_url} target="_blank" rel="noopener" className="p-2 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition" aria-label="TikTok">
                <Music2 className="w-5 h-5 text-rose-primary" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/45 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2">
          Hecho con <Heart className="w-3 h-3 text-rose-deep fill-rose-deep" /> en Buenos Aires · {new Date().getFullYear()}
        </span>
        {showStoreSwitch && (
          <>
            <span aria-hidden>·</span>
            <StoreSwitchLink />
          </>
        )}
      </div>
    </footer>
  );
}
