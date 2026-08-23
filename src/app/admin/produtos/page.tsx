"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useCatalog } from "@/components/catalog-provider";
import { categories, type Product } from "@/lib/mock-data";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Draft = Omit<Product, "id">;

const emptyDraft: Draft = {
  name: "",
  category: "Bebidas",
  price: 0,
  oldPrice: undefined,
  stock: 0,
  badge: "",
  emoji: "🛍️",
  image: "",
  active: true,
};

export default function ProductsPage() {
  const { products, updateProduct, addProduct, resetProducts } = useCatalog();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return products;
    return products.filter(
      (product) =>
        product.name.toLocaleLowerCase("pt-BR").includes(normalized) ||
        product.category.toLocaleLowerCase("pt-BR").includes(normalized),
    );
  }, [products, query]);

  function startNew() {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  }

  function startEdit(product: Product) {
    const { id: _id, ...rest } = product;
    void _id;
    setEditingId(product.id);
    setDraft({ ...emptyDraft, ...rest });
    setOpen(true);
  }

  function save() {
    if (!draft.name.trim()) return;
    if (editingId === null) addProduct(draft);
    else updateProduct(editingId, draft);
    setOpen(false);
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1_500_000) {
      alert("Para esta fase de testes, use uma imagem de até 1,5 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraft((current) => ({ ...current, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#A88A45]">Catálogo</p>
          <h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Produtos</h1>
          <p className="mt-2 max-w-xl text-sm font-medium text-[#777066]">
            Edite foto, nome, preço, saldo e disponibilidade. Nesta fase, as alterações ficam salvas neste navegador.
          </p>
        </div>

        <button
          onClick={startNew}
          className="rounded-2xl bg-[#C6A75E] px-4 py-3 text-xs font-black text-[#1F2A44] shadow-sm transition hover:bg-[#D6BB78]"
        >
          + NOVO PRODUTO
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 min-w-64 flex-1 rounded-xl border border-[#E8DCC8] bg-[#fffdf9] px-4 text-sm font-bold text-[#1F2A44] outline-none focus:border-[#C6A75E]"
          placeholder="Buscar produto..."
        />
        <button
          onClick={() => {
            if (confirm("Restaurar os produtos de demonstração? As alterações locais serão substituídas.")) resetProducts();
          }}
          className="h-11 rounded-xl border border-[#E8DCC8] bg-[#fffdf9] px-4 text-xs font-black text-[#1F2A44]"
        >
          RESTAURAR DEMO
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-[#E8DCC8] bg-[#fffdf9] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#F4ECDF] text-[10px] uppercase tracking-wider text-[#7F7466]">
              <tr>
                <th className="p-4">Produto</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Saldo</th>
                <th>Status</th>
                <th className="pr-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-t border-[#EFE5D6]">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="product-photo grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E8DCC8] text-xl">
                        {product.image ? (
                          <img src={product.image} alt="" className="h-full w-full object-contain p-1" />
                        ) : (
                          product.emoji
                        )}
                      </span>
                      <div>
                        <p className="font-black text-[#1F2A44]">{product.name}</p>
                        <p className="text-xs text-[#9A9186]">SKU DEMO-{String(product.id).padStart(4, "0")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-semibold text-[#6D665E]">{product.category}</td>
                  <td className="font-black text-[#1F2A44]">{brl.format(product.price)}</td>
                  <td><span className="font-black text-[#1F2A44]">{product.stock}</span> un.</td>
                  <td>
                    <button
                      onClick={() => updateProduct(product.id, { active: product.active === false })}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        product.active === false
                          ? "bg-[#EEE7DD] text-[#7B746B]"
                          : "bg-[#E8DCC8] text-[#1F2A44]"
                      }`}
                    >
                      {product.active === false ? "INATIVO" : "ATIVO"}
                    </button>
                  </td>
                  <td className="pr-4 text-right">
                    <button
                      onClick={() => startEdit(product)}
                      className="rounded-xl bg-[#1F2A44] px-3 py-2 text-xs font-black text-white"
                    >
                      EDITAR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-[#151D31]/65 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#fffdf9] p-5 shadow-2xl sm:max-w-2xl sm:rounded-[2rem] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#A88A45]">
                  {editingId === null ? "Cadastro" : "Edição"}
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#1F2A44]">
                  {editingId === null ? "Novo produto" : "Editar produto"}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full bg-[#F4ECDF] font-black text-[#1F2A44]">×</button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[180px_1fr]">
              <div>
                <div className="product-photo grid aspect-square place-items-center overflow-hidden rounded-3xl border border-[#E8DCC8]">
                  {draft.image ? (
                    <img src={draft.image} alt="Prévia" className="h-full w-full object-contain p-3" />
                  ) : (
                    <span className="text-6xl">{draft.emoji || "🛍️"}</span>
                  )}
                </div>

                <label className="mt-3 block rounded-xl bg-[#1F2A44] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wide text-white">
                  Escolher foto
                  <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                </label>

                {draft.image && (
                  <button
                    onClick={() => setDraft((current) => ({ ...current, image: "" }))}
                    className="mt-2 w-full rounded-xl border border-[#E8DCC8] px-3 py-2 text-[10px] font-black text-[#1F2A44]"
                  >
                    REMOVER FOTO
                  </button>
                )}
              </div>

              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-xs font-black text-[#1F2A44]">Nome</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    className="h-11 rounded-xl border border-[#E8DCC8] bg-white px-3 outline-none focus:border-[#C6A75E]"
                    placeholder="Ex.: Coca-Cola 2L"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black text-[#1F2A44]">Categoria</span>
                    <select
                      value={draft.category}
                      onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                      className="h-11 rounded-xl border border-[#E8DCC8] bg-white px-3 outline-none focus:border-[#C6A75E]"
                    >
                      {categories.map((item) => <option key={item.slug}>{item.name}</option>)}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-black text-[#1F2A44]">Selo</span>
                    <input
                      value={draft.badge}
                      onChange={(event) => setDraft({ ...draft, badge: event.target.value })}
                      className="h-11 rounded-xl border border-[#E8DCC8] bg-white px-3 outline-none focus:border-[#C6A75E]"
                      placeholder="Oferta / Mais vendido"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black text-[#1F2A44]">Preço</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.price}
                      onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
                      className="h-11 rounded-xl border border-[#E8DCC8] bg-white px-3 outline-none focus:border-[#C6A75E]"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-black text-[#1F2A44]">Saldo</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.stock}
                      onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })}
                      className="h-11 rounded-xl border border-[#E8DCC8] bg-white px-3 outline-none focus:border-[#C6A75E]"
                    />
                  </label>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-black text-[#1F2A44]">URL da imagem (opcional)</span>
                  <input
                    value={draft.image || ""}
                    onChange={(event) => setDraft({ ...draft, image: event.target.value })}
                    className="h-11 rounded-xl border border-[#E8DCC8] bg-white px-3 text-xs outline-none focus:border-[#C6A75E]"
                    placeholder="https://..."
                  />
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-[#E8DCC8] bg-[#F7F2E9] p-3">
                  <input
                    type="checkbox"
                    checked={draft.active !== false}
                    onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                    className="size-4 accent-[#1F2A44]"
                  />
                  <span className="text-xs font-black text-[#1F2A44]">Produto disponível na loja</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-[#E8DCC8] pt-4">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-[#E8DCC8] px-4 py-3 text-xs font-black text-[#1F2A44]">
                CANCELAR
              </button>
              <button onClick={save} className="rounded-xl bg-[#C6A75E] px-5 py-3 text-xs font-black text-[#1F2A44]">
                SALVAR PRODUTO
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
