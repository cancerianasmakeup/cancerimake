import Link from "next/link";
import { Instagram, Music2, Heart, Mail } from "lucide-react";
import { getBrandInfo } from "@/lib/site-settings";

export default async function Footer() {
  const brand = await getBrandInfo();

  return (
    <footer className="mt-16 border-t border-rose-pastel bg-rose-whisper/50">
      <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
        <div>
          <img src={brand.logo_url} alt={brand.name} className="h-10 w-auto object-contain mb-3" />
          {brand.contact_email && (
            <a href={`mailto:${brand.contact_email}`} className="text-xs text-ink-soft hover:text-rose-deep inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {brand.contact_email}
            </a>
          )}
        </div>
        <div>
          <h4 className="font-display font-semibold text-ink-primary mb-3">Tienda</h4>
          <ul className="space-y-2 text-sm text-ink-secondary">
            <li><Link href="/shop" className="hover:text-rose-deep">Ver toda la tienda</Link></li>
            <li><Link href="/category/cosmetica" className="hover:text-rose-deep">Cosmética</Link></li>
            <li><Link href="/category/accesorios" className="hover:text-rose-deep">Accesorios</Link></li>
            <li><Link href="/category/promos" className="hover:text-rose-deep">Promos</Link></li>
            <li><Link href="/live" className="hover:text-rose-deep">LIVE</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold text-ink-primary mb-3">Conectá</h4>
          <div className="flex gap-3">
            {brand.show_instagram && brand.instagram_url && (
              <a href={brand.instagram_url} target="_blank" rel="noopener" className="p-2 rounded-full bg-white shadow-soft hover:shadow-lift transition" aria-label="Instagram">
                <Instagram className="w-5 h-5 text-rose-deep" />
              </a>
            )}
            {brand.show_tiktok && brand.tiktok_url && (
              <a href={brand.tiktok_url} target="_blank" rel="noopener" className="p-2 rounded-full bg-white shadow-soft hover:shadow-lift transition" aria-label="TikTok">
                <Music2 className="w-5 h-5 text-rose-deep" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-rose-pastel py-4 text-center text-xs text-ink-soft flex items-center justify-center gap-2">
        Hecho con <Heart className="w-3 h-3 text-rose-deep fill-rose-deep" /> en Buenos Aires · {new Date().getFullYear()}
      </div>
    </footer>
  );
}
