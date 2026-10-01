// Seed data for a clean Buna Link workspace.
import { menuItemAmharicName } from "./menu-i18n.ts";

export const SEATING_AREAS = [
  "Main Office",
  "Meeting Room 1",
  "Reception",
  "Boardroom",
  "Executive Office",
  "Coffee Station Pickup",
] as const;
export type SeatingArea = (typeof SEATING_AREAS)[number];

/** Serving / ticket stations for coffee office delivery. */
export const PRODUCTION_STATIONS = [
  "Main Office",
  "Meeting Room 1",
  "Reception",
  "Boardroom",
  "Executive Office",
  "Coffee Station Pickup",
] as const;
export type ProductionStation = string;

/** Bump to re-seed local menu/stations after catalog changes. */
export const CATALOG_SEED_VERSION = "coffee-office-v5";

export const PAYMENT_METHODS = [
  "Cash",
  "CBE",
  "Telebirr",
  "CBE Birr",
  "Dashen",
  "BOA",
  "Awash",
  "MPESA",
  "Siinqee",
  "Kaafi Ebirr",
  "Mixed",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BANK_PAYMENT_METHODS: PaymentMethod[] = [
  "CBE", "Telebirr", "CBE Birr", "Dashen", "BOA", "Awash", "MPESA", "Siinqee", "Kaafi Ebirr",
];

export type StationTicketStatus = "NEW" | "PREPARING" | "READY" | "UNAVAILABLE" | "CANCELLED";
export type OrderStatus =
  | "PENDING_CASHIER"
  | "NEW"
  | "PARTIALLY READY"
  | "READY TO SERVE"
  | "RECEIPT_GENERATED"
  | "CLOSED"
  | "CANCELLED"
  | "RETURNED";
export type PaymentStatus = "Unpaid" | "Paid" | "Partially Paid" | "Refunded";
export type OrderPriority = "Normal" | "High" | "VIP" | "Urgent";

export const ORDER_PRIORITIES = ["Normal", "High", "VIP", "Urgent"] as const;
export const FINAL_ORDER_STATUSES = ["CLOSED", "CANCELLED", "RETURNED"] as const;
export const DEFAULT_ORDER_PREP_TARGET_MINUTES = 20;

export function isFinalOrderStatus(status: OrderStatus) {
  return FINAL_ORDER_STATUSES.includes(status as (typeof FINAL_ORDER_STATUSES)[number]);
}

export interface OrderLine {
  menuItemId?: string;
  name: string;
  qty: number;
  unitLabel?: string;
  stockSku?: string;
  station: ProductionStation;
  finalStation?: ProductionStation;
  unitPrice?: number;
  done?: boolean;
  stockDeductionLocation?: string;
  stockDeducted?: boolean;
  /** Prep preferences printed on Kitchen/Butcher bono tickets. */
  preferences?: string[];
  /** Free-text customer instruction for the station ticket. */
  note?: string;
  assignedStaff?: string;
  acceptedAt?: string;
  startedAt?: string;
  readyAt?: string;
  servedAt?: string;
}

export interface StationTicket {
  id: string;
  station: ProductionStation;
  status: StationTicketStatus;
  sentAt: string;
  acceptedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  items: OrderLine[];
  nextStation?: ProductionStation;
  previousTicketId?: string;
  /** True after this slip has been printed — add/send must not print it again. */
  bonoPrinted?: boolean;
}

export interface OrderReceipt {
  receiptNumber: string;
  generatedAt: string;
  generatedBy: string;
  restaurantName: string;
  branchName: string;
  tin?: string;
  vatRegNo?: string;
  currency?: string;
  subtotal: number;
  vat: number;
  vatRate: number;
  serviceChargeEnabled: boolean;
  serviceCharge: number;
  discount: number;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  orderStatusAtGeneration: OrderStatus;
  printCount: number;
  lastPrintedAt?: string;
}

export interface MixedBankPaymentEntry {
  method: PaymentMethod;
  bankPaymentReference: string;
  bankAccountSuffix?: string;
  bankPaymentPhone?: string;
  verificationStatus?: "verified" | "recorded_unverified" | "skipped";
  verificationRequestId?: string;
  verificationBank?: string;
  verificationAmount?: number;
  verificationMessage?: string;
  verifiedAt?: string;
}

export interface OrderPayment {
  totalAmount: number;
  method: PaymentMethod;
  collectedByWaiter: string;
  receivedByCashier: string;
  amountReceived: number;
  changeAmount: number;
  /** Extra cash kept as waiter tip instead of returned change. */
  tipAmount?: number;
  receiptNumber: string;
  paymentReceivedAt: string;
  closedByCashier: string;
  closedAt: string;
  /** Bank/wallet transfer receipt / transaction number entered by cashier. */
  bankPaymentReference?: string;
  bankPaymentPhone?: string;
  bankAccountSuffix?: string;
  verificationStatus?: "verified" | "recorded_unverified" | "skipped";
  verificationRequestId?: string;
  verificationBank?: string;
  verificationAmount?: number;
  verificationMessage?: string;
  verifiedAt?: string;
  /** Multiple bank entries for Mixed payment mode. */
  mixedBankPayments?: MixedBankPaymentEntry[];
}

export interface MenuItem {
  id: string;
  name_en: string;
  name_am: string;
  category: string;
  price: number;
  vipPrice?: number;
  singlePrice?: number;
  doublePrice?: number;
  /** VIP Bar spirits: sell half a bottle (deducts 0.5 bottle from stock). */
  halfBottlePrice?: number;
  cost: number;
  station: string;
  emoji: string;
  veg?: boolean;
  pricingMode?: "unit" | "kg";
  unitLabel?: string;
  defaultQty?: number;
  qtyStep?: number;
  stockSku?: string;
  /** Operational department inventory location for POS deduction. */
  stockDeductionLocation?: string;
  /** direct = sell packaged stock; recipe = BOM ingredients. */
  stockDeductionRule?: "direct" | "recipe";
  sellingUnit?: string;
  minimumStock?: number;
  outOfStockBehavior?: "block" | "warn_manager" | "allow_negative_authorized" | "auto_unavailable";
  /** Manual availability for coffee service (no stock module). Default true. */
  available?: boolean;
}

export interface Table {
  id: string;
  label: string;
  seats: number;
  area: string;
  status: "Available" | "Occupied" | "Reserved" | "Bill" | "Cleaning";
  guests?: number;
  server?: string;
  openMin?: number;
  total?: number;
}

export interface Order {
  id: string;
  orderNo: string;
  source: "Dine-in" | "Takeaway" | "Room" | "Delivery" | "QR";
  ref: string;
  customerName?: string;
  customerPhone?: string;
  customerNotes?: string;
  guests?: number;
  priority?: OrderPriority;
  /** ISO timestamp used for live elapsed timers. */
  createdAtIso?: string;
  area: SeatingArea;
  tableNumber: string;
  orderedByWaiter: string;
  waiter: string;
  enteredByCashier: string;
  shiftLabel?: string;
  items: OrderLine[];
  stationTickets: StationTicket[];
  sentAt: string;
  requestedAt?: string;
  cashierAcceptedAt?: string;
  stationSentAt?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  openedMin: number;
  total: number;
  server?: string;
  receipt?: OrderReceipt;
  receiptNumber?: string;
  receiptGeneratedAt?: string;
  receiptGeneratedBy?: string;
  lockedForEditing?: boolean;
  managerAuthorizedChangesBy?: string;
  managerAuthorizedChangesAt?: string;
  paymentReceivedAt?: string;
  closedByCashier?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  voidRequestedBy?: string;
  voidRequestedAt?: string;
  voidReason?: string;
  returnRequestedBy?: string;
  returnRequestedAt?: string;
  returnReason?: string;
  /** Waiter-selected lines awaiting manager approval (index + qty). */
  returnRequestedLines?: Array<{ index: number; qty: number }>;
  returnedAt?: string;
  returnedBy?: string;
  payment?: OrderPayment;
  /** ISO timestamp when POS stock was reserved for this order. */
  stockReservedAt?: string;
  /** ISO timestamp when POS/recipe consumption was posted. */
  stockDeductedAt?: string;
  /** Cancellation / void stock handling notes. */
  cancelReason?: string;
  stockExceptionOutcome?: "release_only" | "wastage" | "reversal" | "packaged_return";
  /** Immutable handoff history when bills move between waiters. */
  waiterTransfers?: WaiterTransferAudit[];
  /** Pending handoff awaiting cashier/manager approval. */
  waiterTransferRequestedTo?: string;
  waiterTransferRequestedBy?: string;
  waiterTransferRequestedAt?: string;
  /** Waiter released the seat; bill stays open for later cashier payment. */
  tableClearedAt?: string;
  tableClearedBy?: string;
  /** How many times station Bono has been printed for this order. */
  bonoPrintCount?: number;
  bonoLastPrintedAt?: string;
  bonoLastPrintedBy?: string;
}

export type WaiterTransferAudit = {
  id: string;
  at: string;
  fromWaiter: string;
  toWaiter: string;
  actor: string;
  orderNo: string;
  area: string;
  tableNumber: string;
};

export interface PaymentLedgerEntry {
  id: string;
  ref: string;
  method: PaymentMethod;
  amount: number;
  table: string;
  cashier: string;
  time: string;
  status: "Settled" | "Pending" | "Void";
  orderId?: string;
  collectedByWaiter?: string;
  receivedByCashier?: string;
  amountReceived?: number;
  changeAmount?: number;
  tipAmount?: number;
  receiptNumber?: string;
  paymentReceivedAt?: string;
  closedByCashier?: string;
  /**
   * Business day (YYYY-MM-DD) the payment belongs to for sales/payment reports.
   * Late payment of a prior-day bill uses the order day, not the cashier action day.
   */
  reportDate?: string;
}

export interface SalesRecord {
  id: string;
  date: string;
  month: string;
  time: string;
  orderId?: string;
  orderNo?: string;
  receiptNumber: string;
  productId?: string;
  productName: string;
  category: string;
  station: ProductionStation;
  qty: number;
  /** Bottle / Double Shot / Single Shot / etc. */
  unitLabel?: string;
  unitPrice: number;
  unitCost: number;
  revenue: number;
  expense: number;
  profit: number;
  area: string;
  tableNumber: string;
  waiter: string;
  cashier: string;
  paymentMethod: PaymentMethod;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  month: string;
  category:
    | "Food cost"
    | "Beverage cost"
    | "Purchase"
    | "Staff"
    | "Rent"
    | "Utilities"
    | "Supplies"
    | "Other";
  label: string;
  amount: number;
  source: "Product sale" | "Purchase" | "Operating";
}

export interface StockItem {
  sku: string;
  name: string;
  unit: string;
  store: string;
  onHand: number;
  reorder: number;
  value: number;
  supplier: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  category: string;
  outstanding: number;
  status: string;
  /** Central store this supplier record belongs to */
  store?: "Store 1" | "Store 2";
}

export interface Reservation {
  id: string;
  name: string;
  phone: string;
  time: string;
  party: number;
  table: string;
  deposit: number;
  status: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  visits: number;
  spent: number;
  tier: string;
  lastVisit: string;
  points: number;
  feedback: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  shift: string;
  branch: string;
  status: string;
  phone: string;
  startTime: string;
  endTime: string;
  daysWorked: number;
}

export interface SalesHour {
  h: string;
  sales: number;
}

export interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  outlets: number;
  sales: number;
}

export interface EventBooking {
  id: string;
  name: string;
  date: string;
  hall: string;
  guests: number;
  status: string;
  value: number;
  deposit: number;
  menu: string;
  coordinator: string;
  notes: string;
}

export interface RecipeIngredient {
  name: string;
  qty: number;
  unit: string;
  cost: number;
}

export interface Recipe {
  id: string;
  name_en: string;
  name_am: string;
  category: string;
  yieldQty: number;
  yieldUnit: string;
  ingredients: RecipeIngredient[];
  totalCost: number;
  salePrice: number;
}

export interface BarItem {
  id: string;
  name: string;
  type: string;
  pourSize: string;
  cost: number;
  price: number;
  stock: number;
  unit: string;
  emoji: string;
}

export interface BarLogEntry {
  id: string;
  item: string;
  qty: number;
  server: string;
  table: string;
  time: string;
  total: number;
}

export interface RoomOrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface RoomOrder {
  id: string;
  room: string;
  guest: string;
  items: RoomOrderItem[];
  status: string;
  placedAt: string;
  total: number;
  folio: string;
}

export interface CateringJob {
  id: string;
  client: string;
  event: string;
  date: string;
  guests: number;
  location: string;
  status: string;
  value: number;
  driver: string;
  vehicle: string;
  items: string[];
  notes: string;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  sku: string;
  item: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
  status: string;
  date: string;
  /** Central store that will receive this PO */
  store?: "Store 1" | "Store 2";
}

const DEFAULT_PREP_STATION = "Coffee Station Pickup";

type CoffeeSeedRow = [id: string, name_en: string, price: number, unitLabel?: string];

/** Original POS short codes from item id (espresso → E, double-espresso → DE). */
function seedEmoji(id: string, _category?: string) {
  return id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
}

function seedCoffeeRows(rows: readonly CoffeeSeedRow[], category: string): MenuItem[] {
  return rows.map(([id, name_en, price, unitLabel]) => ({
    id,
    name_en,
    name_am: menuItemAmharicName({ id, name_en }),
    category,
    price,
    cost: 0,
    station: DEFAULT_PREP_STATION,
    emoji: seedEmoji(id, category),
    unitLabel: unitLabel ?? "Cup",
    available: true,
  }));
}

const ESPRESSO_ROWS: CoffeeSeedRow[] = [
  ["espresso", "Espresso", 80],
  ["double-espresso", "Double Espresso", 100],
  ["ristretto", "Ristretto", 80],
  ["lungo", "Lungo", 90],
  ["espresso-macchiato", "Espresso Macchiato", 95],
  ["double-macchiato", "Double Macchiato", 115],
  ["cortado", "Cortado", 110],
];

const MILK_COFFEE_ROWS: CoffeeSeedRow[] = [
  ["cappuccino", "Cappuccino", 120],
  ["caffe-latte", "Caffè Latte", 130],
  ["flat-white", "Flat White", 130],
  ["cafe-au-lait", "Café au Lait", 120],
  ["mocha", "Mocha", 140],
  ["white-mocha", "White Mocha", 145],
  ["caramel-latte", "Caramel Latte", 145],
  ["vanilla-latte", "Vanilla Latte", 145],
];

const BLACK_COFFEE_ROWS: CoffeeSeedRow[] = [
  ["americano", "Americano", 100],
  ["long-black", "Long Black", 100],
  ["black-coffee", "Black Coffee", 80],
  ["filter-coffee", "Filter Coffee", 90],
];

const ETHIOPIAN_COFFEE_ROWS: CoffeeSeedRow[] = [
  ["traditional-ethiopian-buna", "Traditional Ethiopian Buna", 150],
  ["black-buna", "Black Buna", 120],
  ["buna-with-milk", "Buna with Milk", 130],
  ["spiced-buna", "Spiced Buna", 140],
];

const ICED_COFFEE_ROWS: CoffeeSeedRow[] = [
  ["iced-americano", "Iced Americano", 120],
  ["iced-latte", "Iced Latte", 140],
  ["iced-cappuccino", "Iced Cappuccino", 140],
  ["iced-mocha", "Iced Mocha", 150],
  ["iced-macchiato", "Iced Macchiato", 140],
  ["cold-brew", "Cold Brew", 130],
];

const TEA_ROWS: CoffeeSeedRow[] = [
  ["black-tea", "Black Tea", 60],
  ["tea-with-milk", "Tea with Milk", 70],
  ["green-tea", "Green Tea", 70],
  ["lemon-tea", "Lemon Tea", 70],
  ["ginger-tea", "Ginger Tea", 75],
  ["mint-tea", "Mint Tea", 70],
  ["herbal-tea", "Herbal Tea", 75],
  ["cinnamon-tea", "Cinnamon Tea", 75],
];

const HOT_DRINK_ROWS: CoffeeSeedRow[] = [
  ["hot-chocolate", "Hot Chocolate", 110],
  ["hot-milk", "Hot Milk", 70],
  ["honey-milk", "Honey Milk", 90],
  ["lemon-honey", "Lemon & Honey", 85],
  ["ginger-honey", "Ginger & Honey", 90],
];

const COLD_DRINK_ROWS: CoffeeSeedRow[] = [
  ["iced-tea", "Iced Tea", 80],
  ["lemon-iced-tea", "Lemon Iced Tea", 90],
  ["fresh-lemonade", "Fresh Lemonade", 90],
  ["juice", "Juice", 100],
  ["sparkling-water", "Sparkling Water", 60, "Bottle"],
  ["bottled-water", "Bottled Water", 40, "Bottle"],
];

const PASTRY_ROWS: CoffeeSeedRow[] = [
  ["croissant", "Croissant", 90, "Piece"],
  ["chocolate-croissant", "Chocolate Croissant", 100, "Piece"],
  ["muffin", "Muffin", 85, "Piece"],
  ["danish-pastry", "Danish Pastry", 95, "Piece"],
  ["cinnamon-roll", "Cinnamon Roll", 100, "Piece"],
];

const SNACK_ROWS: CoffeeSeedRow[] = [
  ["cookies", "Cookies", 50, "Piece"],
  ["biscuits", "Biscuits", 40, "Piece"],
  ["cake-slice", "Cake Slice", 120, "Slice"],
  ["brownie", "Brownie", 90, "Piece"],
  ["donut", "Donut", 70, "Piece"],
  ["fruit", "Fruit", 60, "Portion"],
];

const MEETING_SERVICE_ROWS: CoffeeSeedRow[] = [
  ["coffee-pot", "Coffee Pot", 450, "Pot"],
  ["ethiopian-coffee-pot", "Ethiopian Coffee Pot", 550, "Pot"],
  ["tea-pot", "Tea Pot", 350, "Pot"],
  ["hot-water-pot", "Hot Water Pot", 200, "Pot"],
  ["coffee-tea-service", "Coffee & Tea Service", 700, "Set"],
  ["meeting-refreshment-set", "Meeting Refreshment Set", 900, "Set"],
];

export const MENU: MenuItem[] = [
  ...seedCoffeeRows(ESPRESSO_ROWS, "Espresso Coffee"),
  ...seedCoffeeRows(MILK_COFFEE_ROWS, "Milk Coffee"),
  ...seedCoffeeRows(BLACK_COFFEE_ROWS, "Black Coffee"),
  ...seedCoffeeRows(ETHIOPIAN_COFFEE_ROWS, "Ethiopian Coffee"),
  ...seedCoffeeRows(ICED_COFFEE_ROWS, "Iced Coffee"),
  ...seedCoffeeRows(TEA_ROWS, "Tea"),
  ...seedCoffeeRows(HOT_DRINK_ROWS, "Hot Drinks"),
  ...seedCoffeeRows(COLD_DRINK_ROWS, "Cold Drinks"),
  ...seedCoffeeRows(PASTRY_ROWS, "Pastries"),
  ...seedCoffeeRows(SNACK_ROWS, "Snacks"),
  ...seedCoffeeRows(MEETING_SERVICE_ROWS, "Meeting Service"),
].map((item) => ({
  ...item,
  name_am: menuItemAmharicName(item) || item.name_am,
}));

export const CATEGORIES = [
  "All",
  "Espresso Coffee",
  "Milk Coffee",
  "Black Coffee",
  "Ethiopian Coffee",
  "Iced Coffee",
  "Tea",
  "Hot Drinks",
  "Cold Drinks",
  "Pastries",
  "Snacks",
  "Meeting Service",
] as const;

/** Office desks / pickup points by serving location. */
function buildFloorTables(): Table[] {
  const rows: Table[] = [];
  const layout: Array<{ area: SeatingArea; count: number; prefix: string }> = [
    { area: "Main Office", count: 12, prefix: "MO" },
    { area: "Meeting Room 1", count: 6, prefix: "MR1" },
    { area: "Reception", count: 4, prefix: "R" },
    { area: "Boardroom", count: 4, prefix: "BR" },
    { area: "Executive Office", count: 4, prefix: "EO" },
    { area: "Coffee Station Pickup", count: 6, prefix: "CS" },
  ];
  for (const { area, count, prefix } of layout) {
    for (let n = 1; n <= count; n += 1) {
      rows.push({
        id: `tbl-${prefix.toLowerCase()}-${n}`,
        label: `${prefix}-${n}`,
        seats: area.includes("Meeting") || area.includes("Board") ? 8 : 2,
        area,
        status: "Available",
      });
    }
  }
  return rows;
}

export const TABLES: Table[] = buildFloorTables();
export const ORDERS: Order[] = [];
export const STOCK: StockItem[] = [];
export const SUPPLIERS: Supplier[] = [];
export const RESERVATIONS: Reservation[] = [];
export const CUSTOMERS: Customer[] = [];
export const STAFF: StaffMember[] = [];
export const SALES_BY_HOUR: SalesHour[] = [];
export const TOP_ITEMS: TopItem[] = [];
export const BRANCHES: Branch[] = [];
export const EVENTS: EventBooking[] = [];
export const RECIPES: Recipe[] = [];
export const BAR_ITEMS: BarItem[] = [];
export const BAR_LOG: BarLogEntry[] = [];
export const ROOM_ORDERS: RoomOrder[] = [];
export const CATERING_JOBS: CateringJob[] = [];
export const PAYMENTS_LEDGER: PaymentLedgerEntry[] = [];
export const SALES_RECORDS: SalesRecord[] = [];
export const EXPENSE_RECORDS: ExpenseRecord[] = [];
export const PURCHASE_ORDERS: PurchaseOrder[] = [];
