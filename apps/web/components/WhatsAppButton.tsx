import { getBrandInfo } from "@/lib/site-settings";

/**
 * Botón flotante de WhatsApp en la esquina inferior derecha.
 * Se renderiza en server (en el layout) y sólo aparece si:
 *  - brand_info.show_whatsapp_floating = true
 *  - brand_info.whatsapp tiene un número configurado
 */
export default async function WhatsAppButton() {
  const brand = await getBrandInfo();
  if (!brand.show_whatsapp_floating) return null;
  if (!brand.whatsapp || !brand.whatsapp.trim()) return null;

  // Normalizamos: sacamos +, espacios, paréntesis y guiones para wa.me
  const phone = brand.whatsapp.replace(/[^0-9]/g, "");
  if (!phone) return null;

  const msg = encodeURIComponent(brand.whatsapp_default_message || "");
  const href = `https://wa.me/${phone}${msg ? `?text=${msg}` : ""}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="Escribinos por WhatsApp"
      className="group fixed bottom-5 right-5 z-40"
    >
      {/* Glow verde pulsante detrás del botón */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-[#25D366]/50 blur-xl animate-soft-pulse pointer-events-none"
      />

      <span className="relative flex items-center rounded-full bg-gradient-to-br from-[#2BE070] via-[#25D366] to-[#128C7E] text-white shadow-[0_12px_36px_-8px_rgba(37,211,102,0.65)] ring-1 ring-white/25 transition-all duration-300 group-hover:scale-105 group-active:scale-95">
        {/* Etiqueta que se despliega al hover (desktop) */}
        <span className="hidden md:block max-w-0 opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:pl-6 overflow-hidden whitespace-nowrap text-sm font-bold tracking-wide transition-all duration-300">
          Escribinos
        </span>

        <span className="relative w-16 h-16 md:w-[4.25rem] md:h-[4.25rem] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 32 32" className="w-9 h-9 md:w-10 md:h-10 fill-white drop-shadow-sm">
            <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.426.741 4.683 2.008 6.566L4 29l7.65-2c1.804.984 3.86 1.55 6.014 1.55h.014C24.305 28.55 30 23.176 30 16.55 30 9.923 24.305 4.55 17.679 4.55L16.001 3zm.014 22.99c-1.94 0-3.842-.524-5.502-1.515l-.394-.234-4.41 1.156 1.18-4.298-.257-.44A10.36 10.36 0 016.34 15c0-5.715 4.65-10.366 10.36-10.366 5.71 0 10.36 4.651 10.36 10.366 0 5.716-4.65 10.99-10.046 10.99zm5.65-8.214c-.31-.156-1.83-.904-2.115-1.008-.284-.103-.49-.155-.696.156-.207.31-.797 1.008-.978 1.215-.18.207-.36.233-.67.077-.31-.155-1.31-.483-2.494-1.54-.922-.823-1.544-1.84-1.726-2.15-.18-.31-.02-.477.137-.632.14-.139.31-.36.466-.54.155-.18.207-.31.31-.517.104-.207.052-.388-.026-.543-.077-.156-.696-1.683-.955-2.305-.252-.605-.508-.523-.696-.532l-.595-.011a1.15 1.15 0 00-.834.388c-.284.31-1.087 1.061-1.087 2.586 0 1.525 1.113 2.999 1.268 3.206.155.207 2.193 3.347 5.31 4.693.742.32 1.32.512 1.772.655.745.237 1.422.204 1.957.124.597-.089 1.83-.747 2.09-1.469.258-.722.258-1.34.18-1.469-.077-.13-.283-.207-.595-.36z"/>
          </svg>

          {/* Badge de "1 mensaje" en rosa de la marca */}
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-deep ring-2 ring-white text-[9px] font-black flex items-center justify-center leading-none">
            1
          </span>
        </span>
      </span>
    </a>
  );
}
