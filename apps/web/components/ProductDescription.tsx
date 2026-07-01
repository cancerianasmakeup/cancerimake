// Renderiza la descripción del producto de forma elegante y legible.
// Las descripciones vienen con un mini-markdown:
//   - **negrita**
//   - líneas que empiezan con "- " → viñetas (con emoji opcional como marcador)
//   - líneas cortas terminadas en ":" → subtítulos de sección
//   - "Modo de uso: ..." / "Tip: ..." → párrafo con etiqueta en negrita
//   - "Ítem ..." → caption discreto al final
// Server component (sin interactividad).

import React from "react";

// Convierte **negrita** en <strong> dentro de un fragmento de texto.
function renderInline(text: string, kp: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((part, i) => {
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      if (m) {
        return (
          <strong key={`${kp}-b${i}`} className="font-semibold text-ink-primary">
            {m[1]}
          </strong>
        );
      }
      return <React.Fragment key={`${kp}-t${i}`}>{part}</React.Fragment>;
    });
}

// Extrae un emoji inicial (para usarlo como marcador de viñeta).
function leadingEmoji(text: string): { emoji: string | null; rest: string } {
  const m = text.match(/^(\p{Extended_Pictographic}️?)\s*/u);
  if (m) return { emoji: m[1], rest: text.slice(m[0].length) };
  return { emoji: null, rest: text };
}

export default function ProductDescription({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bullets: { emoji: string | null; content: string }[] = [];
  let firstParagraphDone = false;
  let key = 0;

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="space-y-2.5 my-4">
        {items.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="shrink-0 w-5 text-center leading-7 text-[15px]">
              {b.emoji ?? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-medium align-middle" />
              )}
            </span>
            <span className="text-[15px] leading-7 text-ink-secondary">
              {renderInline(b.content, `li-${key}-${i}`)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      continue;
    }

    // Viñeta
    if (/^[-•]\s+/.test(line)) {
      const content = line.replace(/^[-•]\s+/, "");
      const { emoji, rest } = leadingEmoji(content);
      bullets.push({ emoji, content: rest });
      continue;
    }
    flushBullets();

    // Caption "Ítem ..."
    if (/^(ítem|item)\b/i.test(line)) {
      blocks.push(
        <p
          key={`cap-${key++}`}
          className="text-[11px] uppercase tracking-[0.18em] text-ink-soft/70 mt-6"
        >
          {renderInline(line, `cap-${key}`)}
        </p>
      );
      continue;
    }

    // Subtítulo de sección (línea corta terminada en ":")
    if (/:$/.test(line) && line.length <= 34) {
      blocks.push(
        <div key={`h-${key++}`} className="mt-7 mb-3">
          <p className="font-accent text-2xl leading-none text-ink-primary">
            {line.replace(/:$/, "")}
          </p>
          <span className="block w-10 h-px bg-rose-medium mt-2.5" />
        </div>
      );
      continue;
    }

    // Párrafo con etiqueta inicial ("Modo de uso: ...", "Tip: ...")
    const labelMatch = line.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ][^:]{1,26}):\s+(.+)$/);
    if (labelMatch) {
      blocks.push(
        <p key={`p-${key++}`} className="text-[15px] leading-7 text-ink-secondary my-2.5">
          <strong className="font-semibold text-ink-primary">{labelMatch[1]}:</strong>{" "}
          {renderInline(labelMatch[2], `pl-${key}`)}
        </p>
      );
      continue;
    }

    // Párrafo normal — el primero es el "lead" (un poco más presente).
    const isLead = !firstParagraphDone;
    firstParagraphDone = true;
    blocks.push(
      <p
        key={`p-${key++}`}
        className={
          isLead
            ? "text-base leading-7 text-ink-secondary mb-3"
            : "text-[15px] leading-7 text-ink-secondary my-2.5"
        }
      >
        {renderInline(line, `p-${key}`)}
      </p>
    );
  }
  flushBullets();

  return <div className="text-left">{blocks}</div>;
}
