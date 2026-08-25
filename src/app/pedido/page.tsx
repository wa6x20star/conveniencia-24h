"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PackageIcon, SearchIcon, ShieldIcon } from "@/components/brand-icons";

const LAST_ORDER_KEY = "conveniencia24h.lastOrder.v2";

type LastOrder = {
  trackingToken?: string;
  orderNumber?: string;
};

export default function OrderLookupPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_ORDER_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as LastOrder;
      if (parsed?.trackingToken) setLastOrder(parsed);
    } catch {}
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderNumber, phone }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.trackingToken) {
        if (response.status === 429) {
          setMessage("Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.");
        } else {
          setMessage("Pedido não localizado. Confira o número e o WhatsApp informados.");
        }
        return;
      }

      try {
        localStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify({ trackingToken: data.trackingToken, orderNumber: data.orderNumber }),
        );
      } catch {}
      router.push(`/pedido/${data.trackingToken}`);
    } catch {
      setMessage("Não foi possível consultar o pedido agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="brand-grid min-h-screen bg-[#1F2A44] px-4 py-7 text-white">
      <main className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo inverted tagline />
          <Link href="/" className="text-[10px] font-extrabold uppercase tracking-wide text-[#E8DCC8] transition hover:text-[#C6A75E]">
            Voltar à loja
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] bg-[#fffdf9] p-6 text-[#1F2A44] shadow-[0_30px_80px_rgba(0,0,0,.3)] sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#F4ECDF] text-[#A88A45]">
            <SearchIcon className="size-6" />
          </span>
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#A88A45]">Acompanhamento online</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.035em]">Acompanhe seu pedido.</h1>
          <p className="mt-2 text-sm leading-6 text-[#777066]">
            Informe o número do pedido e o mesmo WhatsApp utilizado na compra.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-[#1F2A44]">Número do pedido</span>
              <input
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="#000154"
                className="h-13 w-full rounded-2xl border border-[#E8DCC8] bg-white px-4 text-base font-bold outline-none transition focus:border-[#C6A75E]"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-[#1F2A44]">WhatsApp usado no pedido</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(81) 99999-9999"
                className="h-13 w-full rounded-2xl border border-[#E8DCC8] bg-white px-4 text-base font-bold outline-none transition focus:border-[#C6A75E]"
                required
              />
            </label>

            {message && (
              <div className="rounded-2xl bg-[#FFF3D6] px-4 py-3 text-sm font-semibold leading-5 text-[#75551A]" role="alert">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#C6A75E] px-5 text-sm font-extrabold text-[#1F2A44] transition hover:bg-[#D6BB78] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SearchIcon className="size-4" /> {loading ? "BUSCANDO..." : "BUSCAR PEDIDO"}
            </button>
          </form>

          {lastOrder?.trackingToken && (
            <div className="mt-6 border-t border-[#E8DCC8] pt-6">
              <div className="rounded-2xl bg-[#F4ECDF] p-4">
                <div className="flex items-start gap-3">
                  <PackageIcon className="mt-0.5 size-5 shrink-0 text-[#A88A45]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#1F2A44]">Pedido feito neste aparelho?</p>
                    <p className="mt-1 text-xs text-[#777066]">
                      {lastOrder.orderNumber ? `Último pedido #${lastOrder.orderNumber}.` : "Seu último acompanhamento está salvo neste navegador."}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(`/pedido/${lastOrder.trackingToken}`)}
                      className="mt-3 text-xs font-extrabold text-[#8A7040] underline decoration-[#C6A75E] underline-offset-4"
                    >
                      VER MEU ÚLTIMO PEDIDO →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3 rounded-2xl border border-[#E8DCC8] p-4">
            <ShieldIcon className="mt-0.5 size-5 shrink-0 text-[#A88A45]" />
            <p className="text-xs leading-5 text-[#777066]">
              Por segurança, o número do pedido sozinho não é suficiente. A consulta exige também o telefone usado na compra.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
