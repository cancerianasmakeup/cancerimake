"use client";

import { toast } from "sonner";
import { formatPrice } from "@cancerianas/shared";

interface Props {
  orderNumber: string;
  total: number;
  alias: string;
  cbu: string;
  bank: string;
  holder: string;
}

export default function TransferInstructions({ orderNumber, total, alias, cbu, bank, holder }: Props) {
  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  }

  return (
    <div className="card space-y-5 border-2 border-rose-deep/30 bg-rose-whisper">
      <div className="text-center space-y-1">
        <div className="text-4xl">💸</div>
        <h2 className="font-display text-2xl text-ink-primary">Realizá la transferencia</h2>
        <p className="text-ink-secondary text-sm">Tu pedido queda reservado. Te confirmamos cuando recibamos el pago.</p>
      </div>

      {/* Monto + nº de orden */}
      <div className="bg-white rounded-2xl p-4 space-y-2 border border-rose-pastel">
        <div className="flex justify-between items-center">
          <span className="text-sm text-ink-soft">Monto a transferir</span>
          <span className="font-display text-2xl font-bold text-rose-deep">{formatPrice(total)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-rose-pastel">
          <span className="text-sm text-ink-soft">Número de orden</span>
          <span className="font-mono font-bold text-ink-primary text-base">{orderNumber}</span>
        </div>
      </div>

      {/* Datos bancarios */}
      <div className="bg-white rounded-2xl p-4 space-y-3 border border-rose-pastel">
        <h3 className="font-semibold text-ink-primary">Datos de la cuenta</h3>
        {holder && <BankRow label="Titular" value={holder} />}
        {alias && <BankRow label="Alias" value={alias} onCopy={() => copy(alias, "Alias")} />}
        {cbu && <BankRow label="CBU" value={cbu} onCopy={() => copy(cbu, "CBU")} />}
        {bank && <BankRow label="Banco" value={bank} />}
      </div>

      {/* Aviso número de orden */}
      <div className="bg-rose-deep/10 rounded-2xl p-4 space-y-2 text-sm">
        <p className="font-bold text-ink-primary">📝 Escribí esto en el asunto/descripción de la transferencia:</p>
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2 border border-rose-deep/30">
          <span className="font-mono font-bold text-rose-deep">ORDEN {orderNumber}</span>
          <button
            onClick={() => copy(`ORDEN ${orderNumber}`, "Referencia")}
            className="text-xs text-rose-deep hover:underline ml-3 flex-shrink-0"
          >
            Copiar
          </button>
        </div>
        <p className="text-xs text-ink-soft">Así identificamos tu pago y procesamos tu pedido más rápido.</p>
      </div>
    </div>
  );
}

function BankRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-ink-soft">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-semibold text-ink-primary">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-xs text-rose-deep hover:underline">Copiar</button>
        )}
      </div>
    </div>
  );
}
