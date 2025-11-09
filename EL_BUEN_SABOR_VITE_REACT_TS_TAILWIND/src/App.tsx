import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, ChefHat, CreditCard, Settings, Table as TableIcon, Check, X, ArrowRight, RefreshCw } from "lucide-react";

// --- Tipos y helpers ---
const ROLES = ["Mozo", "Cocinero", "Cajero", "Admin"] as const;

type Role = typeof ROLES[number];

type Product = {
  id: string;
  name: string;
  price: number;
  category?: string;
  active: boolean;
};

type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  price: number; // unit price at time of order
};

type OrderStatus =
  | "CREADO"
  | "EN_COCINA"
  | "LISTO"
  | "PROCESANDO"
  | "PAGADO"
  | "RECHAZADO"
  | "CANCELADO";

type Payment = {
  method: "Efectivo" | "Tarjeta" | null;
  receipt?: string;
};

type Order = {
  id: string;
  tableCode: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: number;
  readyAt?: number;
  paidAt?: number;
  payment?: Payment;
};

type Table = {
  code: string;
  capacity: number;
  status: "Libre" | "Ocupada";
  floor: 1 | 2 | 3;
  orderId?: string; // active order
};

// --- Datos base ---
const initialProducts: Product[] = [
  { id: "P-001", name: "Lomo saltado", price: 28.0, category: "Plato", active: true },
  { id: "P-002", name: "Ceviche clásico", price: 32.0, category: "Plato", active: true },
  { id: "P-003", name: "Arroz con pollo", price: 24.0, category: "Plato", active: true },
  { id: "P-004", name: "Ají de gallina", price: 22.0, category: "Plato", active: true },
  { id: "P-005", name: "Inca Kola 500ml", price: 6.0, category: "Bebida", active: true },
  { id: "P-006", name: "Chicha morada", price: 5.5, category: "Bebida", active: true },
  { id: "P-007", name: "Suspiro limeño", price: 10.0, category: "Postre", active: true },
  { id: "P-008", name: "Causa limeña", price: 12.0, category: "Entrada", active: true },
  { id: "P-009", name: "Anticuchos", price: 16.0, category: "Entrada", active: true },
];

function makeTables(): Table[] {
  const tables: Table[] = [];
  ( [1, 2, 3] as const ).forEach((floor) => {
    for (let i = 0; i < 20; i++) {
      const code = `P${floor}-${String(i + 1).padStart(2, "0")}`; // p.ej., P2-07
      tables.push({ code, capacity: 4, status: "Libre", floor });
    }
  });
  return tables;
}

// Utils
const money = (v: number) => v.toLocaleString("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });
const now = () => Date.now();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// --- UI helpers (elegancia dark) ---
const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: "easeOut" }}
    className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_10px_30px_rgba(0,0,0,0.35)] ${className}`}
  >
    {children}
  </motion.div>
);

const Button: React.FC<React.PropsWithChildren<{ onClick?: () => void; variant?: "solid" | "ghost" | "danger" | "success"; disabled?: boolean; className?: string }>> = ({ onClick, variant = "solid", disabled, className = "", children }) => {
  const base = "px-3 py-2 rounded-xl text-sm transition inline-flex items-center justify-center gap-2";
  const variants: Record<string, string> = {
    solid: "bg-amber-500/90 hover:bg-amber-400 text-black font-semibold",
    ghost: "bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10",
    danger: "bg-rose-500/90 hover:bg-rose-400 text-black font-semibold",
    success: "bg-emerald-500/90 hover:bg-emerald-400 text-black font-semibold",
  };
  const disabledCls = disabled ? "opacity-50 pointer-events-none" : "";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${disabledCls} ${className}`}>{children}</button>
  );
};

const Chip: React.FC<React.PropsWithChildren<{ tone?: "info" | "ok" | "warn" | "muted" }>> = ({ children, tone = "muted" }) => {
  const tones: Record<string, string> = {
    info: "bg-sky-500/15 text-sky-300 border border-sky-500/20",
    ok: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
    warn: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
    muted: "bg-white/5 text-neutral-300 border border-white/10",
  };
  return <span className={`text-xs px-2 py-1 rounded-full ${tones[tone]}`}>{children}</span>;
};

const Divider = () => <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />;

// self-tests (no UI impact)
try {
  const ts = makeTables();
  console.assert(ts.length === 60, "60 mesas esperadas (3 pisos × 20)");
  console.assert(ts[0].code.startsWith("P1-"), "Prefijo P1- esperado");
  console.assert(ts.at(-1)?.code.startsWith("P3-"), "Prefijo P3- esperado");
} catch (_) {}


// --- Componente principal ---
export default function ElBuenSaborPrototype() {
  const [role, setRole] = useState<Role | null>(null);
  const [user, setUser] = useState<string>("");

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [tables, setTables] = useState<Table[]>(makeTables());
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [floor, setFloor] = useState<1 | 2 | 3>(1);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function resetAll() {
    setProducts(initialProducts);
    setTables(makeTables());
    setOrders([]);
    setHistory([]);
    notify("Estado reiniciado (datos de demo)");
  }

  const kpi = useMemo(() => {
    const active = orders.filter(o => ["CREADO", "EN_COCINA", "LISTO", "PROCESANDO", "RECHAZADO"].includes(o.status)).length;
    const avgTime = (() => {
      const paid = history.filter(h => h.paidAt && h.createdAt);
      if (!paid.length) return 0;
      const mins = paid.map(p => (p.paidAt! - p.createdAt) / 60000);
      return mins.reduce((a, b) => a + b, 0) / paid.length;
    })();
    return { active, avgTime };
  }, [orders, history]);

  // --- Mutaciones del dominio ---
  function openOrder(tableCode: string) {
    setTables(prev => prev.map(t => t.code === tableCode ? { ...t, status: "Ocupada" } : t));
    const order: Order = { id: rid("ORD"), tableCode, items: [], status: "CREADO", total: 0, createdAt: Date.now() };
    setOrders(prev => [...prev, order]);
    setTables(prev => prev.map(t => t.code === tableCode ? { ...t, orderId: order.id } : t));
  }

  function addItem(orderId: string, product: Product) {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const idx = o.items.findIndex(i => i.productId === product.id);
      const items = [...o.items];
      if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
      else items.push({ productId: product.id, name: product.name, qty: 1, price: product.price });
      const total = items.reduce((s, it) => s + it.qty * it.price, 0);
      return { ...o, items, total };
    }));
  }

  function removeItem(orderId: string, productId: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const items = o.items
        .map(it => it.productId === productId ? { ...it, qty: it.qty - 1 } : it)
        .filter(it => it.qty > 0);
      const total = items.reduce((s, it) => s + it.qty * it.price, 0);
      return { ...o, items, total };
    }));
  }

  function sendToKitchen(orderId: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      if (o.items.length === 0) { notify("Error: Pedido vacío"); return o; }
      return { ...o, status: "EN_COCINA" };
    }));
  }

  function markReady(orderId: string) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "LISTO", readyAt: Date.now() } : o));
    notify("Notificación: ¡Pedido LISTO! visible para Caja y Mozo");
  }

  function requestPayment(orderId: string) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "PROCESANDO" } : o));
  }

  function approvePayment(orderId: string, method: Payment["method"]) {
    const receipt = rid(method === "Tarjeta" ? "VISA" : "RCPT");
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "PAGADO", paidAt: Date.now(), payment: { method, receipt } } : o));
    setTimeout(() => {
      setOrders(prev => {
        const target = prev.find(o => o.id == orderId);
        if (!target) return prev;
        // add to history simulated on client side (not persisted)
        return prev.filter(o => o.id != orderId)
      });
    }, 100);
  }

  function rejectPayment(orderId: string) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "RECHAZADO", payment: { method: o.payment?.method ?? null } } : o));
  }

  function retryFromRejected(orderId: string) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "LISTO" } : o));
  }

  function cancelOrder(orderId: string) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CANCELADO" } : o));
  }

  const SmallBanner = (
    <div className="md:hidden w-full text-center text-neutral-400 py-4">
      <div className="text-lg text-neutral-200 font-semibold mb-1">El Buen Sabor</div>
      <div>Mejor experiencia en <b>tablet</b> o <b>PC</b>.</div>
    </div>
  );

  if (!role) return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(255,255,255,0.06),transparent)] bg-neutral-950 text-neutral-200">
      {SmallBanner}
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-3xl p-8">
          <div className="flex items-center gap-3">
            <Utensils className="w-6 h-6 text-amber-400" />
            <h1 className="text-3xl font-semibold tracking-wide">El Buen Sabor — Prototipo MVP</h1>
          </div>
          <p className="text-neutral-400 mt-2">Sistema de Gestión de Pedidos (Mozo ↔ Cocina ↔ Caja) con Administración básica. Selecciona un rol para iniciar la demo.</p>
          <Divider />
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            {ROLES.map((r) => (
              <motion.button
                key={r}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { setRole(r); setUser(r.toLowerCase()); }}
                className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-left"
              >
                <div className="flex items-center gap-2 text-lg font-semibold">
                  {r === "Mozo" && <TableIcon className="w-5 h-5 text-amber-400" />}
                  {r === "Cocinero" && <ChefHat className="w-5 h-5 text-amber-400" />}
                  {r === "Cajero" && <CreditCard className="w-5 h-5 text-amber-400" />}
                  {r === "Admin" && <Settings className="w-5 h-5 text-amber-400" />}
                  {r}
                </div>
                <div className="text-sm text-neutral-400">Entrar como {r}</div>
              </motion.button>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 text-sm text-neutral-400">
            <Button variant="ghost" onClick={() => { setRole(null); }}><RefreshCw className="w-4 h-4"/> Reiniciar demo</Button>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(255,255,255,0.06),transparent)] bg-neutral-950 text-neutral-200">
      {SmallBanner}
      <div className="grid max-w-7xl mx-auto p-6 md:grid-cols-12 gap-6">
        <main className="md:col-span-9 lg:col-span-10 space-y-6">
          <div className="text-neutral-300">Demo cargada.</div>
        </main>
      </div>
    </div>
  );
}
