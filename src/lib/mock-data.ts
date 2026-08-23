export const categories = [
  { name: "Bebidas", icon: "🥤", slug: "bebidas" },
  { name: "Bomboniere", icon: "🍫", slug: "bomboniere" },
  { name: "Salgadinhos", icon: "🍿", slug: "salgadinhos" },
  { name: "Gelo", icon: "🧊", slug: "gelo" },
  { name: "Higiene", icon: "🧼", slug: "higiene" },
  { name: "Utilidades", icon: "🏠", slug: "utilidades" },
];

export const products = [
  { id: 1, name: "Coca-Cola 2L", category: "Bebidas", price: 10.99, oldPrice: 12.49, stock: 18, badge: "Oferta", emoji: "🥤" },
  { id: 2, name: "Gelo 5 kg", category: "Gelo", price: 7.5, stock: 9, badge: "24h", emoji: "🧊" },
  { id: 3, name: "Chocolate ao leite", category: "Bomboniere", price: 6.99, stock: 24, badge: "Mais vendido", emoji: "🍫" },
  { id: 4, name: "Doritos 120 g", category: "Salgadinhos", price: 11.49, stock: 11, badge: "", emoji: "🍿" },
  { id: 5, name: "Água mineral 1,5L", category: "Bebidas", price: 4.49, stock: 30, badge: "", emoji: "💧" },
  { id: 6, name: "Energético 473 ml", category: "Bebidas", price: 9.99, stock: 14, badge: "Madrugada", emoji: "⚡" },
];

export const adminOrders = [
  { id: "#000157", customer: "Mariana Alves", items: 5, total: 64.8, payment: "PIX • PAGO", time: "21:32", status: "NOVO" },
  { id: "#000156", customer: "Rafael Lima", items: 3, total: 31.47, payment: "DINHEIRO", time: "21:27", status: "NOVO" },
  { id: "#000155", customer: "João Silva", items: 7, total: 82.35, payment: "PIX • PAGO", time: "21:19", status: "SEPARANDO" },
  { id: "#000154", customer: "Ana Paula", items: 2, total: 28.98, payment: "CARTÃO NA ENTREGA", time: "21:11", status: "PRONTO" },
  { id: "#000153", customer: "Carlos Souza", items: 6, total: 71.2, payment: "PIX • PAGO", time: "20:58", status: "EM ENTREGA" },
];

export const lowStock = [
  { product: "Gelo 5 kg", stock: 4, min: 6, location: "Freezer 01" },
  { product: "Doritos 120 g", stock: 5, min: 8, location: "Prateleira 03" },
  { product: "Energético 473 ml", stock: 6, min: 10, location: "Geladeira 01 / B" },
];
