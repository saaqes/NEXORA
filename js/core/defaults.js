// Categorías y configuración por defecto de NEXORA (plantillas editables, no datos financieros).
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const mk = (id, name, icon, color, kind, subs) => ({
  id, name, icon, color, kind,
  subs: subs.map((n) => ({ id: `${id}:${slug(n)}`, name: n })),
});
export const CAT_FEES = 'com';        // comisiones y cargos
export const CAT_DEBTS = 'deu';       // deudas (intereses)
export const CAT_INCOME = 'ing';
export const SUB_INTEREST = 'deu:intereses';
export const SUB_YIELDS = 'ing:rendimientos';

export const DEFAULT_CATEGORIES = [
  mk('viv', 'Vivienda', '🏠', '#7c6cff', 'expense', ['Arriendo', 'Hipoteca', 'Administración', 'Servicios públicos', 'Electricidad', 'Gas', 'Agua', 'Internet', 'Teléfono', 'Mantenimiento', 'Impuestos', 'Otros gastos de vivienda']),
  mk('ali', 'Alimentación', '🍽️', '#f59e0b', 'expense', ['Mercado', 'Comida fuera de casa', 'Domicilios', 'Restaurantes', 'Cafeterías', 'Otros gastos de alimentación']),
  mk('tra', 'Transporte', '🚌', '#3b82f6', 'expense', ['Transporte público', 'Gasolina', 'Parqueaderos', 'Peajes', 'Cuota del vehículo', 'Seguro del vehículo', 'Mantenimiento y reparaciones', 'Impuestos y documentos', 'Otros gastos de transporte']),
  mk('seg', 'Seguros', '🛡️', '#14b8a6', 'expense', ['Seguro de vida', 'Seguro médico', 'Seguro del vehículo', 'Otros seguros']),
  mk('deu', 'Deudas', '💳', '#ef4444', 'expense', ['Tarjetas de crédito', 'Préstamos bancarios', 'Préstamos personales', 'Cuotas pendientes', 'Intereses', 'Otros compromisos financieros']),
  mk('ent', 'Entretenimiento y recreación', '🎮', '#ec4899', 'expense', ['Salidas y restaurantes', 'Paseos y excursiones', 'Vacaciones', 'Suscripciones', 'Videojuegos', 'Entretenimiento', 'Otros gastos']),
  mk('rop', 'Ropa y cuidado personal', '👕', '#a855f7', 'expense', ['Ropa', 'Calzado', 'Peluquería', 'Productos de cuidado personal', 'Cosméticos', 'Lavandería']),
  mk('aho', 'Ahorro', '🐷', '#22c55e', 'expense', ['Fondo de emergencia', 'Ahorro para objetivos', 'Ahorro mensual', 'Ahorro para compras futuras']),
  mk('sal', 'Salud', '🩺', '#06b6d4', 'expense', ['Médico', 'Odontología', 'Medicamentos', 'Exámenes', 'Otros gastos médicos']),
  mk('var', 'Gastos varios', '🧾', '#94a3b8', 'expense', ['Regalos', 'Compras personales', 'Imprevistos', 'Gastos pequeños', 'Otros gastos']),
  mk('edu', 'Educación', '🎓', '#6366f1', 'expense', ['Matrícula', 'Cursos', 'Materiales', 'Transporte educativo', 'Otros gastos educativos']),
  mk('inv', 'Inversiones', '📈', '#10b981', 'expense', ['Inversiones personales', 'Inversiones empresariales', 'Otros activos']),
  mk('com', 'Comisiones y cargos', '🏦', '#f97316', 'expense', ['Comisión bancaria', 'Cuota de manejo', 'Retiro en cajero', 'Otros cargos']),
  mk('ing', 'Ingresos', '💰', '#2fd593', 'income', ['Salario', 'Trabajo independiente', 'Negocios', 'Ventas', 'Comisiones', 'Pagos de clientes', 'Rendimientos', 'Reembolsos', 'Otros ingresos']),
];

export const DEFAULT_SETTINGS = {
  appName: 'NEXORA',
  currency: 'COP',
  timezone: 'America/Bogota',
  theme: 'dark',
  weekStart: 1,
  dateFormat: 'dd/mm/yyyy',
  csvSeparator: ';',
  largeExpense: 0, // centavos; 0 = automático (≥ 3× el gasto promedio)
  budgetThresholds: [50, 75, 90, 100],
  reminders: {
    enabled: true, time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], extras: [],
    summaryEnabled: false, summaryTime: '20:00',
    debtDue: true, debtDays: 3, upcoming: true, upcomingDays: 3, receivables: true,
    snoozeMinutes: 30, browserNotifications: false,
  },
};

export const ACCOUNT_TYPES = {
  cash: { label: 'Efectivo', icon: '💵' },
  savings: { label: 'Cuenta de ahorros', icon: '🏦' },
  checking: { label: 'Cuenta corriente', icon: '🏛️' },
  debit: { label: 'Tarjeta débito', icon: '💳' },
  credit: { label: 'Tarjeta de crédito', icon: '💳' },
  wallet: { label: 'Billetera digital', icon: '📱' },
  pocket: { label: 'Bolsillo de ahorro', icon: '🐷' },
  other: { label: 'Otra cuenta', icon: '👛' },
};

export const TX_TYPES = {
  income: { label: 'Ingreso recibido', short: 'Ingreso', sign: 1, color: 'pos' },
  expense: { label: 'Gasto realizado', short: 'Gasto', sign: -1, color: 'neg' },
  transfer: { label: 'Transferencia entre cuentas', short: 'Transferencia', sign: 0, color: 'info' },
  loan_given: { label: 'Dinero prestado a otra persona', short: 'Préstamo dado', sign: -1, color: 'warn' },
  loan_received: { label: 'Dinero que me prestaron', short: 'Préstamo recibido', sign: 1, color: 'warn' },
  debt_payment: { label: 'Pago de deuda', short: 'Pago de deuda', sign: -1, color: 'neg' },
  debt_collection: { label: 'Cobro de deuda', short: 'Cobro de deuda', sign: 1, color: 'pos' },
  saving: { label: 'Ahorro', short: 'Ahorro', sign: 0, color: 'info' },
  investment: { label: 'Inversión', short: 'Inversión', sign: -1, color: 'info' },
  fee: { label: 'Comisión bancaria', short: 'Comisión', sign: -1, color: 'neg' },
  refund: { label: 'Reembolso', short: 'Reembolso', sign: 1, color: 'pos' },
  adjustment: { label: 'Ajuste de saldo', short: 'Ajuste', sign: 0, color: 'info' },
};
export const TX_STATUS = { confirmado: 'Confirmado', por_verificar: 'Por verificar', anulado: 'Anulado' };
