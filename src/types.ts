export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'CASHIER' | 'MANAGER' | string;
export type UserStatus = 'PENDING' | 'APPROVED';

export interface User {
  id: number;
  tenantId?: number;
  tenantName?: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  onboardingCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionPlan = '6_MONTHS' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

export interface TenantInfo {
  id: number;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionStatus?: SubscriptionStatus;
  themeColor: string;
  backgroundColor: string;
  logoUrl: string;
  address?: string;
  taxId?: string;
  currency?: string;
  onboardingCompleted: boolean;
  appPath?: string;
  manifestUrl?: string;
}

export interface SuperAdminStoreRow {
  id: number;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  subscriptionPlan: SubscriptionPlan;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  subscriptionStatus: SubscriptionStatus;
  themeColor: string;
  backgroundColor: string;
  logoUrl: string;
  ownerEmail: string;
  ownerPhone: string;
  address: string;
  taxId: string;
  currency: string;
  onboardingCompleted: boolean;
  createdAt: string;
  productCount: number;
  totalStockUnits: number;
  salesCount: number;
  totalSales: number;
  staffCount: number;
  customerCount?: number;
  supplierCount?: number;
  unitsSold?: number;
  inventoryValue?: number;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  manifestUrl: string;
  appUrl: string;
  installUrl: string;
}

export interface SuperAdminReportSku {
  id: number;
  tenantId: number;
  storeName: string;
  currency: string;
  productName: string;
  sku: string;
  barcode: string;
  brand: string;
  category: string;
  imageUrl?: string;
  sellingPrice: number;
  costPrice: number;
  totalStock: number;
  unitsSold: number;
  totalRevenue: number;
  orderCount: number;
}

export interface SuperAdminSevenDayPoint {
  date: string;
  label: string;
  amount: number;
  txCount: number;
}

export interface SuperAdminRecentTransaction {
  id?: number;
  tenantId?: number;
  invoiceNumber?: string;
  saleDate?: string;
  cashierName?: string;
  paymentMethod?: string;
  totalAmount?: number;
  type: string;
  reference: string;
  storeName: string;
  customerName: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  timeString?: string;
}

export interface SuperAdminReportBreakdown {
  name: string;
  skuCount: number;
  totalStock: number;
  unitsSold: number;
  totalRevenue: number;
}

export interface StoreRequestRecord {
  id: number;
  storeName: string;
  ownerEmail: string;
  ownerPhone: string;
  plan: string;
  requestType?: string;
  notes?: string;
  provisionedTenantId?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt?: string;
}

export type PricingPolicy = 'FIXED' | 'NEGOTIABLE';

export interface CompanySettings {
  id: number;
  tenantId?: number;
  tenantStatus?: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionStatus?: SubscriptionStatus;
  name: string;
  logo: string;
  showReceiptLogo?: boolean;
  receiptLogo?: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  strn: string;
  taxId: string;
  taxRate?: number;
  currency: string;
  currencyName: string;
  currencySymbol: string;
  themeColor?: string;
  backgroundColor?: string;
  invoicePrefix: string;
  purchasePrefix: string;
  barcodePrefix: string;
  invoiceFooter: string;
  lowStockLimit: number;
  pricingPolicy: PricingPolicy;
  pricingPolicyLocked: boolean;
  isInstalled?: boolean;
  updatedAt: string;
}

export interface Brand {
  id?: number;
  name: string;
  logo?: string;
  productCount?: number;
  totalUnits?: number;
}

export interface Category {
  id?: number;
  name: string;
  productCount?: number;
  totalUnits?: number;
}

export type AiConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AiBrandSuggestion {
  suggestedName: string;
  confidence: AiConfidenceLevel;
  isUnknown: boolean;
}

export interface AiCategorySuggestion {
  suggestedName: string;
  confidence: AiConfidenceLevel;
}

export interface AiProductSuggestionResult {
  brand: AiBrandSuggestion;
  category: AiCategorySuggestion;
  title: string;
  confidence: AiConfidenceLevel;
  visualClues: string[];
  observations?: string;
  formattedOutput?: string;
  rawOutput?: string;
  isValidFootwear?: boolean;
}

export interface Product {
  id: number;
  tenantId?: number;
  article: string;
  name?: string;
  brand: string;
  brandName?: string;
  brandLogo?: string;
  category: string;
  categoryName?: string;
  sku: string;
  barcode: string;
  primaryImageUrl: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  minPrice: number;
  maxPrice: number;
  salePrice?: number | null;
  minSalePrice?: number | null;
  maxSalePrice?: number | null;
  totalStock: number;
  lowStockLimit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  code?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  totalPurchases?: number;
  totalOrders?: number;
  totalSpent?: number;
  loyaltyPoints?: number;
  balance?: number | string;
  lastVisit?: string | null;
  createdAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  balance?: number | string;
  totalPurchases?: number;
  totalPurchasedAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: number;
  article?: string;
  name?: string;
  productName?: string;
  brandName?: string;
  brandLogo?: string;
  sku: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  sellingPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  salePrice?: number;
  minSalePrice: number;
  maxSalePrice?: number;
  costPrice: number;
  discount: number;
  subtotal?: number;
  total?: number;
  totalStock: number;
  isPriceOverridden?: boolean;
  originalPrice?: number;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  article?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  purchasePrice: number;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string;
  saleDate: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'SPLIT';
  cashReceived: number;
  changeGiven: number;
  createdBy: number;
  createdByName?: string;
  isMinPriceOverridden: boolean;
  overriddenBy?: number | null;
  notes?: string;
  createdAt: string;
  items?: SaleItem[];
}

export interface PurchaseItem {
  id?: number;
  purchaseId?: number;
  productId: number;
  article?: string;
  productName?: string;
  quantity: number;
  unitPurchasePrice: number;
  subtotal: number;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  notes?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  items?: PurchaseItem[];
}

export interface PurchaseReturnItem {
  id?: number;
  purchaseReturnId?: number;
  productId: number;
  article?: string;
  productName?: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unitPurchasePrice: number;
  subtotal: number;
  defectType?: string;
}

export interface PurchaseReturn {
  id: number;
  returnNumber: string;
  purchaseId?: number | null;
  purchaseNumber?: string | null;
  supplierId?: number | null;
  supplierName: string;
  supplierPhone?: string;
  returnDate: string;
  totalDebitAmount: number;
  reason: string;
  notes?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  items?: PurchaseReturnItem[];
}

export interface ReturnItem {
  id: number;
  returnId: number;
  saleItemId: number;
  productId: number;
  article?: string;
  productName?: string;
  quantity: number;
  unitRefundPrice: number;
  subtotal: number;
}

export interface ReturnRecord {
  id: number;
  returnNumber: string;
  originalSaleId: number;
  invoiceNumber?: string;
  customerId?: number | null;
  customerName?: string;
  returnDate: string;
  totalRefundAmount: number;
  reason: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  items?: ReturnItem[];
}

export interface ExchangeItem {
  saleItemId: number;
  productId: number;
  article: string;
  productName: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unitRefundPrice: number;
  subtotal: number;
}

export interface ActiveExchange {
  originalSaleId: number;
  originalInvoiceNumber: string;
  originalSaleDate?: string;
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string;
  reason: string;
  items: ExchangeItem[];
}

export type MovementType = 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT';

export interface StockMovement {
  id: number;
  productId: number;
  article?: string;
  productName?: string;
  sku?: string;
  qtyChange: number;
  prevStock: number;
  newStock: number;
  movementType: MovementType;
  referenceId?: string;
  userId: number;
  userName?: string;
  notes?: string;
  createdAt: string;
}

export interface ApiToken {
  id: number;
  name: string;
  token: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
}
