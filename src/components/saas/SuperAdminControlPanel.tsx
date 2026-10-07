import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Store,
  CheckCircle2,
  XCircle,
  Power,
  Plus,
  RefreshCw,
  ExternalLink,
  Wand2,
  Lock,
  LogOut,
  TrendingUp,
  Package,
  Clock,
  KeyRound,
  FileCode2,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Fingerprint,
  ArrowRight,
  LayoutDashboard,
  Search,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Database,
  Keyboard,
  Calendar,
  Check,
  Globe,
  Download,
  Upload,
  FileText,
  Trash2,
  RotateCcw,
  Copy,
  BarChart3,
  Award,
  Users,
  User as UserIcon,
  Building2,
  Layers,
  Receipt,
  ChevronDown,
} from 'lucide-react';
import { api, setAuthSession } from '../../services/api';
import { ShowroomBackground } from '../common/ShowroomBackground';
import { PublicHeader } from '../common/PublicHeader';
import { PublicFooter } from '../common/PublicFooter';
import { UserAvatar } from '../common/UserAvatar';
import { ThemeDropdown } from '../common/ThemeDropdown';
import { StatCard, triggerStatRecount } from '../common/StatCard';
import {
  RetailShoeMetrics,
  useDataPerIntersectionObserver,
  type RetailShoeMetricsData,
} from '../common/RetailShoeMetrics';
import { SuperAdminReportsView } from './SuperAdminReportsView';
import { useTheme } from '../../context/ThemeContext';
import { toTitleCaseLive, toTitleCaseTrimmed, toLowerTrimmed } from '../../utils/textFormat';
import type {
  SuperAdminStoreRow,
  StoreRequestRecord,
  SuperAdminReportSku,
  SuperAdminReportBreakdown,
  SuperAdminSevenDayPoint,
  SuperAdminRecentTransaction,
  User,
} from '../../types';

interface SuperAdminControlPanelProps {
  currentUser: User | null;
  onUserAuthenticated: (user: User, token: string) => void;
  onLogout: () => void;
  onOpenStore: (tenantId: number) => void;
  onOpenOnboarding: (tenantId: number) => void;
  onTenantsUpdated: () => void;
}

type SuperAdminTab = 'dashboard' | 'stores' | 'requests' | 'reports' | 'manifests';

export const SuperAdminControlPanel: React.FC<SuperAdminControlPanelProps> = ({
  currentUser,
  onUserAuthenticated,
  onLogout,
  onOpenStore,
  onOpenOnboarding,
  onTenantsUpdated,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';

  // Login / Reset form state when not authenticated as SUPERADMIN
  const [authTab, setAuthTab] = useState<'login' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Dashboard Layout & Sidebar State (aligned with Store Sidebar & Header)
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'ONLINE'>('ALL');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('superadmin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('superadmin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Control panel state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalStores: 0,
    activeStores: 0,
    suspendedStores: 0,
    pendingRequests: 0,
    totalPlatformRevenue: 0,
    totalPlatformProducts: 0,
  });
  const [stores, setStores] = useState<SuperAdminStoreRow[]>([]);
  const [storeRequests, setStoreRequests] = useState<StoreRequestRecord[]>([]);
  const [reportSkus, setReportSkus] = useState<SuperAdminReportSku[]>([]);
  const [reportCategories, setReportCategories] = useState<SuperAdminReportBreakdown[]>([]);
  const [reportBrands, setReportBrands] = useState<SuperAdminReportBreakdown[]>([]);
  const [sevenDaySales, setSevenDaySales] = useState<SuperAdminSevenDayPoint[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<SuperAdminRecentTransaction[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState<'7days' | 'month' | 'year'>('7days');
  const [hoveredChartPoint, setHoveredChartPoint] = useState<number | null>(null);
  const [reportStoreFilter, setReportStoreFilter] = useState<string>('ALL');
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [exportingStoreId, setExportingStoreId] = useState<number | null>(null);
  const [exportingPlatform, setExportingPlatform] = useState(false);
  const [importSqlModalOpen, setImportSqlModalOpen] = useState(false);
  const [sqlImportText, setSqlImportText] = useState('');
  const [sqlFileName, setSqlFileName] = useState<string | null>(null);
  const [importingPlatformSql, setImportingPlatformSql] = useState(false);
  const [loadingSampleSql, setLoadingSampleSql] = useState(false);
  const [importSqlError, setImportSqlError] = useState<string | null>(null);
  const sqlFileInputRef = useRef<HTMLInputElement | null>(null);
  const superAdminWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<SuperAdminStoreRow | null>(null);
  const [deletingStore, setDeletingStore] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [deletingRequestId, setDeletingRequestId] = useState<number | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Newly provisioned credentials banner
  const [provisionedBanner, setProvisionedBanner] = useState<{
    tenantId: number;
    storeName: string;
    adminEmail: string;
    initialPassword: string;
    subscriptionPlan?: string;
    subscriptionStartDate?: string;
    subscriptionEndDate?: string;
    subscriptionStatus?: string;
    onboardingUrl: string;
    manifestUrl: string;
  } | null>(null);

  // Create Store Modal (Store Name, Owner Email, Password, Subscription Plan)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('admin123');
  const [newOwnerConfirmPassword, setNewOwnerConfirmPassword] = useState('admin123');
  const [newSubscriptionPlan, setNewSubscriptionPlan] = useState<'6_MONTHS' | 'YEARLY'>('YEARLY');
  const [showNewOwnerPassword, setShowNewOwnerPassword] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [createStoreError, setCreateStoreError] = useState<string | null>(null);

  useEffect(() => {
    if (createModalOpen) setCreateStoreError(null);
  }, [createModalOpen]);

  // Edit Store Subscription Modal
  const [storeToEditSub, setStoreToEditSub] = useState<SuperAdminStoreRow | null>(null);
  const [editSubPlan, setEditSubPlan] = useState<'6_MONTHS' | 'YEARLY'>('YEARLY');
  const [editSubEndDate, setEditSubEndDate] = useState<string>('');
  const [editSubStatus, setEditSubStatus] = useState<'ACTIVE' | 'EXPIRED' | 'SUSPENDED'>('ACTIVE');
  const [savingSub, setSavingSub] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.superAdmin.getOverview();
      if (data.metrics) setMetrics(data.metrics);
      if (Array.isArray(data.stores)) setStores(data.stores);
      if (Array.isArray(data.storeRequests)) setStoreRequests(data.storeRequests);
      if (data.reports) {
        if (Array.isArray(data.reports.topSkus)) setReportSkus(data.reports.topSkus);
        if (Array.isArray(data.reports.topCategories)) setReportCategories(data.reports.topCategories);
        if (Array.isArray(data.reports.topBrands)) setReportBrands(data.reports.topBrands);
        if (Array.isArray(data.reports.sevenDaySales)) setSevenDaySales(data.reports.sevenDaySales);
        if (Array.isArray(data.reports.recentTransactions)) setRecentTransactions(data.reports.recentTransactions);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load SuperAdmin overview.');
    } finally {
      setLoading(false);
      triggerStatRecount();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadOverview();
    }
  }, [isSuperAdmin, loadOverview]);

  useEffect(() => {
    if (isSuperAdmin) {
      triggerStatRecount();
    }
  }, [activeTab, isSuperAdmin]);

  useDataPerIntersectionObserver(superAdminWorkspaceRef, [
    loading,
    activeTab,
    stores.length,
    metrics.totalPlatformRevenue,
    metrics.totalPlatformProducts,
    reportSkus.length,
    reportCategories.length,
  ]);

  // Keyboard shortcuts (Ctrl+B to toggle sidebar, F1-F5 for tabs)
  useEffect(() => {
    if (!isSuperAdmin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
        return;
      }
      if (['F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'F1') setActiveTab('stores');
        if (e.key === 'F2') setActiveTab('requests');
        if (e.key === 'F3') setCreateModalOpen(true);
        if (e.key === 'F4') setActiveTab('reports');
        if (e.key === 'F5') setActiveTab('manifests');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSuperAdmin, toggleCollapse]);

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);
    try {
      const res = await api.auth.login({
        email,
        password,
      });
      if (res.user?.role !== 'SUPERADMIN') {
        throw new Error('Access denied: This account does not have SUPERADMIN privileges.');
      }
      setAuthSession(res.token, res.user);
      onUserAuthenticated(res.user, res.token);
    } catch (err: any) {
      setAuthError(err.message || 'SuperAdmin login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSuperAdminForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const res = await api.auth.forgotPassword({ email: email.trim() });
      setResetToken('');
      setAuthInfo(
        res.message ||
          'Password reset token and link have been sent to your email. Please check your inbox and enter the verification token below.'
      );
      setAuthTab('reset');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to request reset token.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSuperAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      await api.auth.resetPassword({ email, token: resetToken.trim(), newPassword });
      setAuthInfo('SuperAdmin password has been reset successfully! You can now sign in.');
      setResetToken('');
      setNewPassword('');
      setPassword('');
      setAuthTab('login');
    } catch (err: any) {
      setAuthError(err.message || 'Password reset failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const triggerSqlDownload = (filename: string, sqlContent: string) => {
    const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `store-backup-${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleToggleStoreStatus = async (store: SuperAdminStoreRow) => {
    const nextStatus = store.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setTogglingId(store.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.superAdmin.toggleTenantStatus(store.id, nextStatus);
      setSuccessMessage(
        res.message ||
          `Store '${store.name}' is now ${nextStatus}.`
      );
      await loadOverview();
      onTenantsUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle tenant status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleExportStoreSql = async (store: SuperAdminStoreRow) => {
    setExportingStoreId(store.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.superAdmin.exportTenantSql(store.id);
      triggerSqlDownload(res.filename, res.sql);
      setSuccessMessage(
        `Exported SQL backup '${res.filename}' for ${store.name} (${res.totalRows} database rows).`
      );
    } catch (err: any) {
      setError(err.message || `Failed to export SQL for store '${store.name}'.`);
    } finally {
      setExportingStoreId(null);
    }
  };

  const handleExportPlatformSql = async () => {
    setExportingPlatform(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.superAdmin.exportPlatformSql();
      triggerSqlDownload(res.filename, res.sql);
      setSuccessMessage(
        `Exported complete platform SQL backup '${res.filename}' (${res.totalRows} total rows across all stores).`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to export platform SQL backup.');
    } finally {
      setExportingPlatform(false);
    }
  };

  const handleSqlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportSqlError(null);
    setSqlFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSqlImportText(String(ev.target?.result || ''));
    };
    reader.onerror = () => {
      setImportSqlError('Failed to read the selected .sql file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadMultiStoreSampleSql = async (autoExecute = false) => {
    setLoadingSampleSql(true);
    setImportSqlError(null);
    try {
      const resp = await fetch('/multi-store-pos-import.sql');
      if (!resp.ok) {
        throw new Error('Could not fetch /multi-store-pos-import.sql from public folder.');
      }
      const text = await resp.text();
      setSqlImportText(text);
      setSqlFileName('multi-store-pos-import.sql (24 Stores • 2,400 SKUs • 240 Purchases • 480 Sales)');
      if (autoExecute) {
        setImportingPlatformSql(true);
        const res = await api.superAdmin.importPlatformSql(text);
        setSuccessMessage(
          res.message ||
            'Imported multi-store SQL backup (24 stores, 2,400 SKUs, 240 purchases, 480 sales) successfully!'
        );
        setImportSqlModalOpen(false);
        await loadOverview();
        onTenantsUpdated();
      }
    } catch (err: any) {
      setImportSqlError(err.message || 'Failed to load sample multi-store SQL file.');
    } finally {
      setLoadingSampleSql(false);
      setImportingPlatformSql(false);
    }
  };

  const handleExecutePlatformSqlImport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sqlImportText.trim()) {
      setImportSqlError('Please select a .sql file, load the 24-store preset, or paste SQL statements.');
      return;
    }
    setImportingPlatformSql(true);
    setImportSqlError(null);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.superAdmin.importPlatformSql(sqlImportText);
      setSuccessMessage(
        res.message || 'Platform SQL script executed and imported successfully!'
      );
      setImportSqlModalOpen(false);
      await loadOverview();
      onTenantsUpdated();
    } catch (err: any) {
      setImportSqlError(err.message || 'Failed to import SQL script.');
    } finally {
      setImportingPlatformSql(false);
    }
  };

  const handleConfirmDeleteStore = async () => {
    if (!storeToDelete) return;
    const targetStore = storeToDelete;
    setDeletingStore(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.superAdmin.deleteTenant(targetStore.id);
      const msg =
        res.message || `Store '${targetStore.name}' has been permanently deleted.`;
      setStores((prev) => prev.filter((s) => s.id !== targetStore.id));
      setStoreToDelete(null);
      setSuccessMessage(msg);
      await loadOverview();
      onTenantsUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to delete store tenant.');
    } finally {
      setDeletingStore(false);
    }
  };

  const handleApproveRequest = async (reqItem: StoreRequestRecord) => {
    setApprovingId(reqItem.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.superAdmin.approveRequest(reqItem.id);
      if (res.provisioned) {
        setProvisionedBanner(res.provisioned);
      }
      setSuccessMessage(
        res.message ||
          ((reqItem as any).requestType === 'RENEWAL' || (reqItem as any).request_type === 'RENEWAL'
            ? `Approved subscription renewal for '${reqItem.storeName}'.`
            : `Approved & provisioned store '${reqItem.storeName}'.`)
      );
      await loadOverview();
      onTenantsUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to approve store request.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectRequest = async (reqItem: StoreRequestRecord) => {
    setUpdatingRequestId(reqItem.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.superAdmin.rejectRequest(reqItem.id);
      setSuccessMessage(`Store request '${reqItem.storeName}' marked as REJECTED.`);
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to reject store request.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleReopenRequest = async (reqItem: StoreRequestRecord) => {
    setUpdatingRequestId(reqItem.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.superAdmin.updateRequest(reqItem.id, { status: 'PENDING' });
      setSuccessMessage(`Store request '${reqItem.storeName}' reopened as PENDING.`);
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen store request.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleDeleteRequest = async (reqItem: StoreRequestRecord) => {
    setDeletingRequestId(reqItem.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.superAdmin.deleteRequest(reqItem.id);
      setStoreRequests((prev) =>
        prev.filter(
          (r) =>
            r.id !== reqItem.id &&
            !(
              (r.ownerEmail || (r as any).owner_email)?.toLowerCase() === (reqItem.ownerEmail || (reqItem as any).owner_email)?.toLowerCase() &&
              (r.storeName || (r as any).store_name)?.toLowerCase() === (reqItem.storeName || (reqItem as any).store_name)?.toLowerCase()
            )
        )
      );
      setMetrics((prev) => ({
        ...prev,
        pendingRequests:
          reqItem.status === 'PENDING' ? Math.max(0, prev.pendingRequests - 1) : prev.pendingRequests,
      }));
      setSuccessMessage(`Store request for '${reqItem.storeName}' permanently deleted.`);
      await loadOverview();
      onTenantsUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to delete store request.');
    } finally {
      setDeletingRequestId(null);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newOwnerName.trim()) {
      setCreateStoreError('Enter both the store name and owner name.');
      return;
    }
    const normalizedOwnerEmail = toLowerTrimmed(newOwnerEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedOwnerEmail)) {
      setCreateStoreError('Enter a valid owner email address.');
      return;
    }
    if (newOwnerPassword.trim().length < 4) {
      setCreateStoreError('Owner password must be at least 4 characters.');
      return;
    }
    if (newOwnerPassword !== newOwnerConfirmPassword) {
      setCreateStoreError('Passwords do not match. Check the confirmation and try again.');
      return;
    }
    setCreatingStore(true);
    setCreateStoreError(null);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.superAdmin.createTenant({
        storeName: toTitleCaseTrimmed(newStoreName),
        ownerName: toTitleCaseTrimmed(newOwnerName),
        ownerEmail: normalizedOwnerEmail,
        password: newOwnerPassword,
        subscriptionPlan: newSubscriptionPlan,
      });
      if (res.provisioned) {
        setProvisionedBanner(res.provisioned);
      }
      setSuccessMessage(
        `Store '${toTitleCaseTrimmed(newStoreName)}' provisioned successfully!`
      );
      setCreateModalOpen(false);
      setNewStoreName('');
      setNewOwnerName('');
      setNewOwnerEmail('');
      setNewOwnerPassword('admin123');
      setNewOwnerConfirmPassword('admin123');
      setNewSubscriptionPlan('YEARLY');
      await loadOverview();
      onTenantsUpdated();
    } catch (err: any) {
      const message = err?.code === 'EMAIL_ALREADY_EXISTS'
        ? 'This email already belongs to an account, including the SuperAdmin account. Use a different email for this store owner.'
        : err.message || 'Failed to provision new store.';
      setCreateStoreError(message);
    } finally {
      setCreatingStore(false);
    }
  };

  const handleOpenEditSubscription = (store: SuperAdminStoreRow) => {
    setStoreToEditSub(store);
    setEditSubPlan(store.subscriptionPlan === '6_MONTHS' ? '6_MONTHS' : 'YEARLY');
    const rawEnd = store.subscriptionEndDate ? new Date(store.subscriptionEndDate) : new Date();
    const formattedDateInput = !Number.isNaN(rawEnd.getTime())
      ? rawEnd.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setEditSubEndDate(formattedDateInput);
    const currentStatus = (store.subscriptionStatus || store.status || 'ACTIVE').toUpperCase();
    setEditSubStatus(
      currentStatus === 'EXPIRED'
        ? 'EXPIRED'
        : currentStatus === 'SUSPENDED'
        ? 'SUSPENDED'
        : 'ACTIVE'
    );
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeToEditSub) return;
    setSavingSub(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const endIso = editSubEndDate ? new Date(`${editSubEndDate}T23:59:59.999Z`).toISOString() : undefined;
      const res = await api.superAdmin.updateTenantSubscription(storeToEditSub.id, {
        subscriptionPlan: editSubPlan,
        subscriptionEndDate: endIso,
        subscriptionStatus: editSubStatus,
      });
      setSuccessMessage(
        res.message || `Updated subscription and expiry date for '${storeToEditSub.name}'.`
      );
      setStoreToEditSub(null);
      await loadOverview();
      onTenantsUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update store subscription.');
    } finally {
      setSavingSub(false);
    }
  };

  // Render SuperAdmin Dedicated Login Screen aligned with Store Auth Page if not logged in as SUPERADMIN
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden bg-slate-900 dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-600 selection:text-white transition-colors duration-200">
        {/* Showroom Background Image Layer (aligned with Store Auth Page) */}
        <ShowroomBackground />

        {/* Top Application Bar with backdrop blur */}
        <PublicHeader
          storeName="POS SaaS C-Panel"
          badgeText="Control Plane Online"
          badgeVariant="online"
          subtitle="Multi-Tenant Retail POS Cloud • SuperAdmin Access"
          dbText="PostgreSQL 16 • Control Plane"
        />

        {/* Main Content Area - Centered Login Form Card */}
        <main className="relative z-10 w-full flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="w-full"
            >
              <div className="app-card bg-white/95 dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-indigo-950/90 dark:to-slate-900/95 backdrop-blur-xl border border-purple-200/80 dark:border-purple-800/80 shadow-2xl shadow-purple-950/10 dark:shadow-[0_10px_35px_rgba(15,23,42,0.8),0_0_25px_rgba(147,51,234,0.2)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-slate-800 dark:text-slate-100 transition-colors">
                {/* SuperAdmin Icon Header */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 dark:shadow-[0_0_14px_rgba(147,51,234,0.35)] border border-purple-400/40 dark:border-purple-400/50">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2
                    id="superadmin-auth-title"
                    className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight"
                  >
                    POS SaaS C-Panel
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-purple-200/80 mt-1 font-medium">
                    Platform SuperAdmin Control Plane
                  </p>
                </div>

                {/* Card Tabs Navigation - Responsive Scrollable Underline Navigation */}
                <div
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  className="flex items-center justify-between border-b border-slate-200/80 dark:border-purple-900/60 mb-6 overflow-x-auto no-scrollbar scrollbar-none tab-scrollbar-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-thumb]:hidden [&::-webkit-scrollbar-track]:hidden"
                >
                  <button
                    id="superadmin-tab-login"
                    type="button"
                    data-active={authTab === 'login'}
                    onClick={() => {
                      setAuthTab('login');
                      setAuthError(null);
                      setAuthInfo(null);
                    }}
                    className={`tab-underline-link relative flex-1 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center justify-center space-x-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                      authTab === 'login'
                        ? 'active text-purple-600 dark:text-purple-400 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
                    }`}
                  >
                    <Fingerprint
                      className={`w-4 h-4 transition-colors duration-200 ${
                        authTab === 'login'
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span>Sign In</span>
                    {authTab === 'login' && (
                      <motion.div
                        layoutId="superAdminAuthActiveUnderline"
                        className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                  </button>

                  <button
                    id="superadmin-tab-forgot"
                    type="button"
                    data-active={authTab === 'forgot' || authTab === 'reset'}
                    onClick={() => {
                      setAuthTab('forgot');
                      setAuthError(null);
                      setAuthInfo(null);
                    }}
                    className={`tab-underline-link relative flex-1 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center justify-center space-x-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                      authTab === 'forgot' || authTab === 'reset'
                        ? 'active text-purple-600 dark:text-purple-400 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
                    }`}
                  >
                    <KeyRound
                      className={`w-4 h-4 transition-colors duration-200 ${
                        authTab === 'forgot' || authTab === 'reset'
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span>Reset PIN</span>
                    {(authTab === 'forgot' || authTab === 'reset') && (
                      <motion.div
                        layoutId="superAdminAuthActiveUnderline"
                        className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                  </button>
                </div>

                {/* Dynamic Header */}
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {authTab === 'login' && 'Sign in to SuperAdmin C-Panel'}
                    {authTab === 'forgot' && 'Reset SuperAdmin PIN / Password'}
                    {authTab === 'reset' && 'Create New SuperAdmin Password'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-purple-200/70 mt-0.5">
                    {authTab === 'login' &&
                      'Enter your SUPERADMIN credentials to manage tenant stores, toggle suspensions, and approve store requests.'}
                    {authTab === 'forgot' &&
                      'Provide your SuperAdmin email to generate an instant verification recovery code.'}
                    {authTab === 'reset' &&
                      'Enter your reset verification token and choose a new SuperAdmin password.'}
                  </p>
                </div>

                {/* Alerts */}
                {authError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{authError}</span>
                  </div>
                )}

                {authInfo && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{authInfo}</span>
                  </div>
                )}

                {/* TAB 1: LOGIN FORM */}
                {authTab === 'login' && (
                  <form onSubmit={handleSuperAdminLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        SuperAdmin Email or ID
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-600 dark:text-purple-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="superadmin-email-input"
                          type="email"
                          required
                          placeholder="Enter SuperAdmin email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="app-input w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-purple-800/60 focus:bg-white dark:focus:bg-slate-900 focus:border-purple-600 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/20 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 rounded-xl text-xs sm:text-sm font-medium py-2.5 pl-[2.125rem] pr-4 transition outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Master PIN / Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthTab('forgot');
                            setAuthError(null);
                          }}
                          className="text-xs font-semibold text-purple-600 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200 transition cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-600 dark:text-purple-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="superadmin-password-input"
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="app-input w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-purple-800/60 focus:bg-white dark:focus:bg-slate-900 focus:border-purple-600 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/20 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 rounded-xl text-xs sm:text-sm font-sans py-2.5 pl-[2.125rem] pr-9 transition outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 transition cursor-pointer"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-purple-200/80 font-medium">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded border-purple-300 dark:border-purple-600 dark:bg-[#0E1628] text-purple-600 accent-purple-600 focus:ring-0 cursor-pointer"
                        />
                        <span>Keep logged in</span>
                      </label>
                      <span className="text-[11px] text-slate-400 dark:text-purple-300/60 font-mono">
                        JWT Auth &bull; SUPERADMIN
                      </span>
                    </div>

                    <button
                      id="superadmin-login-submit-btn"
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-500 dark:hover:to-indigo-500 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.35)] font-bold text-xs sm:text-sm transition active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {authLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Verifying SUPERADMIN JWT...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In to SuperAdmin C-Panel</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* TAB 2: FORGOT PASSWORD FORM */}
                {authTab === 'forgot' && (
                  <form onSubmit={handleSuperAdminForgot} className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-purple-200/70 leading-relaxed font-medium">
                      Enter your SuperAdmin email address. A one-time verification token will be generated to reset your master credentials.
                    </p>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        SuperAdmin Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-600 dark:text-purple-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          required
                          placeholder="Enter SuperAdmin email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="app-input w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-purple-800/60 focus:bg-white dark:focus:bg-slate-900 focus:border-purple-600 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/20 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 rounded-xl text-xs sm:text-sm font-medium py-2.5 pl-[2.125rem] pr-4 transition outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('login');
                          setAuthError(null);
                        }}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-purple-50/80 text-purple-700 hover:text-purple-800 border border-purple-200/90 shadow-xs hover:border-purple-300 dark:bg-slate-900/80 dark:hover:bg-purple-900/40 dark:border-purple-800/60 dark:text-purple-200 text-xs font-bold transition cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-500 dark:hover:to-indigo-500 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] font-bold text-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {authLoading ? 'Requesting Token...' : 'Generate Reset Token'}
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB 3: RESET PASSWORD FORM */}
                {authTab === 'reset' && (
                  <form onSubmit={handleSuperAdminResetPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Verification Reset Token
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-600 dark:text-purple-400">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          placeholder="e.g. 7F3A9C12"
                          className="app-input w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-purple-800/60 focus:bg-white dark:focus:bg-slate-900 focus:border-purple-600 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/20 text-slate-900 dark:text-white font-mono uppercase text-xs sm:text-sm rounded-xl py-2.5 pl-[2.125rem] pr-3 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-600 dark:text-purple-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          required
                          placeholder="Enter new password (min 6 characters)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="app-input w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-purple-800/60 focus:bg-white dark:focus:bg-slate-900 focus:border-purple-600 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-500/20 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl py-2.5 pl-[2.125rem] pr-3 outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('login');
                          setAuthError(null);
                        }}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-purple-50/80 text-purple-700 hover:text-purple-800 border border-purple-200/90 shadow-xs hover:border-purple-300 dark:bg-slate-900/80 dark:hover:bg-purple-900/40 dark:border-purple-800/60 dark:text-purple-200 text-xs font-bold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-500 dark:hover:to-indigo-500 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] font-bold text-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {authLoading ? 'Updating...' : 'Save New Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </main>

        {/* Bottom Global Footer */}
        <PublicFooter
          storeName="POS SaaS C-Panel"
          subtitle="Multi-Tenant Retail POS & Inventory Control Plane"
        />
      </div>
    );
  }

  // Filter stores & requests based on search query and status filter
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredStores = stores.filter((s) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ONLINE') {
        const isMiddlewareActive =
          s.status === 'ACTIVE' &&
          s.subscriptionStatus === 'ACTIVE' &&
          s.isOnline !== false;
        if (!isMiddlewareActive) return false;
      } else if (statusFilter === 'EXPIRED') {
        if (s.status !== 'EXPIRED' && s.subscriptionStatus !== 'EXPIRED') return false;
      } else if (s.status !== statusFilter && s.subscriptionStatus !== statusFilter) {
        return false;
      }
    }
    if (!normalizedSearch) return true;
    return (
      (s.name || '').toLowerCase().includes(normalizedSearch) ||
      (s.ownerEmail || '').toLowerCase().includes(normalizedSearch)
    );
  });

  const filteredRequests = storeRequests.filter((r) => {
    if (requestStatusFilter !== 'ALL' && r.status !== requestStatusFilter) return false;
    if (!normalizedSearch) return true;
    return (
      (r.storeName || (r as any).store_name || '').toLowerCase().includes(normalizedSearch) ||
      (r.ownerEmail || (r as any).owner_email || '').toLowerCase().includes(normalizedSearch)
    );
  });

  const pendingRequestsCount = storeRequests.filter((r) => r.status === 'PENDING').length;

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const sidebarSections = [
    {
      header: 'TENANT & STORE CONTROL',
      items: [
        {
          id: 'stores' as SuperAdminTab,
          label: 'Deployed Stores',
          icon: Store,
          shortcut: 'F1',
          badge: String(stores.length),
        },
        {
          id: 'requests' as SuperAdminTab,
          label: 'Store Requests',
          icon: Clock,
          shortcut: 'F2',
          badge: pendingRequestsCount > 0 ? String(pendingRequestsCount) : undefined,
          badgeTone: 'amber',
        },
      ],
    },
    {
      header: 'PLATFORM & ANALYTICS',
      items: [
        {
          id: 'reports' as SuperAdminTab,
          label: 'Reports & Analytics',
          icon: BarChart3,
          shortcut: 'F4',
        },
        {
          id: 'manifests' as SuperAdminTab,
          label: 'Scoped Manifests',
          icon: FileCode2,
          shortcut: 'F5',
        },
      ],
    },
  ];

  const renderSuperAdminSidebar = (isMobile: boolean = false) => {
    const collapsed = !isMobile && isCollapsed;

    return (
      <div
        className={`w-full h-full max-h-screen flex flex-col bg-white/95 dark:bg-[#0D1322] backdrop-blur-lg text-slate-700 dark:text-slate-100 select-none border-r border-indigo-500/20 shadow-lg rounded-none overflow-y-auto overflow-x-hidden sidebar-scrollbar transition-colors ${
          collapsed ? 'px-2' : ''
        }`}
      >
        {/* TOP: Brand Header aligned with top Header bar (exact h-[3.6rem] with matching border-b) */}
        <div
          className={`h-[3.6rem] flex items-center justify-between border-b border-indigo-500/20 shrink-0 ${
            collapsed ? 'px-2 justify-center' : 'px-3.5 sm:px-4'
          }`}
        >
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border border-purple-400/30">
              <Shield className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-xs font-bold text-slate-900 dark:text-white truncate tracking-tight leading-tight">
                  POS SaaS C-Panel
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-indigo-200/70 font-medium truncate mt-0.5">
                  SuperAdmin Control Plane
                </p>
              </div>
            )}
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              aria-label="Close Mobile Navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {!isMobile && !collapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-white/10 transition cursor-pointer"
              title="Collapse sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}

          {!isMobile && collapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-1 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-white/10 transition cursor-pointer"
              title="Expand sidebar (Ctrl+B)"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* TOP ITEM: Dashboard Overview */}
        <div className={`pt-2.5 pb-1 ${collapsed ? 'px-1' : 'px-3'}`}>
          <div className="relative">
            <motion.button
              type="button"
              onClick={() => {
                setActiveTab('dashboard');
                if (isMobile) setMobileMenuOpen(false);
              }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full flex items-center ${
                collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } rounded-xl text-xs font-semibold cursor-pointer group transition-colors duration-150 ${
                activeTab === 'dashboard'
                  ? 'text-white font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50/70 dark:hover:bg-purple-950/30'
              }`}
            >
              {activeTab === 'dashboard' && (
                <motion.div
                  layoutId={isMobile ? 'superAdminMobilePill' : 'superAdminActiveNavPill'}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 dark:from-purple-600 dark:to-indigo-600 border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex items-center gap-3">
                <LayoutDashboard
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                    activeTab === 'dashboard'
                      ? 'text-white'
                      : 'text-slate-500 dark:text-slate-400 group-hover:scale-110'
                  }`}
                />
                {!collapsed && <span>Dashboard</span>}
              </div>
            </motion.button>
          </div>
        </div>

        {/* MIDDLE: Navigation Sections */}
        <div className={`py-1 space-y-2.5 ${collapsed ? 'px-1' : 'px-3'}`}>
          {sidebarSections.map((section) => (
            <div key={section.header} className="space-y-1">
              {!collapsed ? (
                <div className="text-[10px] font-bold text-slate-400 dark:text-indigo-300/70 uppercase tracking-wider px-2 py-0.5">
                  {section.header}
                </div>
              ) : (
                <div className="w-8 h-px bg-indigo-500/20 mx-auto my-2" />
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="relative">
                      <motion.button
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          if (isMobile) setMobileMenuOpen(false);
                        }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative w-full flex items-center ${
                          collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                        } rounded-xl text-xs font-medium cursor-pointer group transition-colors duration-150 ${
                          isActive
                            ? 'text-white font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50/70 dark:hover:bg-purple-950/30'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId={isMobile ? 'superAdminMobilePill' : 'superAdminActiveNavPill'}
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 dark:from-purple-600 dark:to-indigo-600 border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.35)]"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}

                        <div className="relative z-10 flex items-center gap-3 truncate">
                          <ItemIcon
                            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                              isActive
                                ? 'text-white'
                                : 'text-slate-500 dark:text-slate-400 group-hover:translate-x-0.5'
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {!collapsed && (
                          <div className="relative z-10 flex items-center gap-1.5">
                            {item.badge && (
                              <span
                                className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                  isActive
                                    ? 'bg-white/25 text-white'
                                    : item.badgeTone === 'amber'
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                                    : 'bg-purple-500/15 text-purple-600 dark:text-purple-300'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                            {item.shortcut && (
                              <kbd
                                className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md transition ${
                                  isActive
                                    ? 'bg-white/20 text-white border border-white/30'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-indigo-500/20'
                                }`}
                              >
                                {item.shortcut}
                              </kbd>
                            )}
                          </div>
                        )}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Action: Provision Store */}
          <div className="space-y-1 pt-1">
            {!collapsed && (
              <div className="text-[10px] font-bold text-slate-400 dark:text-indigo-300/70 uppercase tracking-wider px-2 py-0.5">
                PROVISIONING &amp; STORES
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setCreateModalOpen(true);
                if (isMobile) setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50/80 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 border border-purple-200/80 dark:border-purple-800/50 transition cursor-pointer`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Plus className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                {!collapsed && <span className="truncate">Provision New Store</span>}
              </div>
              {!collapsed && (
                <kbd className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-white/10 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-700/50">
                  F3
                </kbd>
              )}
            </button>

            {/* Quick Store Jump List */}
            {!collapsed && stores.length > 0 && (
              <div className="pt-1.5 space-y-1">
                {stores.slice(0, 5).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onOpenStore(st.id);
                      if (isMobile) setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-slate-100/80 dark:hover:bg-white/5 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: st.status === 'ACTIVE' ? '#10B981' : '#F43F5E',
                        }}
                      />
                      <span className="truncate font-semibold">{st.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 group-hover:text-purple-500">
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM: SuperAdmin Profile, PWA Manifest, Theme & Database Status (identical to Store Sidebar) */}
        <div
          className={`border-t border-indigo-500/20 space-y-2 bg-slate-50/40 dark:bg-[#090E18] backdrop-blur-md mt-auto transition-colors ${
            collapsed ? 'p-2 pt-3' : 'p-3.5 pt-3'
          }`}
        >
          {/* User Card */}
          <div
            className={`flex items-center rounded-xl bg-white/80 dark:bg-[#131B2E] border border-indigo-500/20 transition shadow-xs ${
              collapsed ? 'justify-center p-2 relative' : 'justify-between p-2'
            }`}
          >
            <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
              <div className="relative shrink-0">
                <UserAvatar
                  name={currentUser?.name || 'Platform SuperAdmin'}
                  avatarUrl={currentUser?.avatarUrl}
                  role="ADMIN"
                  size="sm"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0D1322]" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.name || 'Platform SuperAdmin'}
                  </div>
                  <div className="text-[10px] text-purple-600 dark:text-purple-300 font-mono font-semibold truncate">
                    SUPERADMIN
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="text-emerald-500 dark:text-emerald-400">
                <Check className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Dedicated SuperAdmin PWA Badge */}
          <div
            className={`w-full flex items-center rounded-xl bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 transition shadow-xs ${
              collapsed ? 'justify-center p-2 relative' : 'justify-between px-2.5 py-1.5'
            }`}
            title="Dedicated SuperAdmin PWA"
          >
            <div className="flex items-center gap-2">
              <FileCode2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              {!collapsed && <span className="text-[11px] font-bold">POS Admin PWA</span>}
            </div>
            {!collapsed && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-[#070B14] text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                PWA
              </span>
            )}
          </div>

          {/* Theme Toggle & Database Connected Status */}
          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-full flex items-center rounded-lg bg-slate-100/80 hover:bg-slate-200/80 dark:bg-[#0E1628] dark:hover:bg-[#131D33] border border-indigo-500/20 text-[11px] text-slate-700 dark:text-slate-200 transition cursor-pointer ${
                collapsed ? 'justify-center p-2' : 'justify-between px-2 py-1.5'
              }`}
              title={`Current theme: ${theme}. Click to toggle`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {theme === 'dark' ? (
                  <Moon className="w-3 h-3 text-purple-400 shrink-0" />
                ) : (
                  <Sun className="w-3 h-3 text-purple-600 shrink-0" />
                )}
                {!collapsed && <span>Theme</span>}
              </div>
              {!collapsed && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white dark:bg-[#070B14] text-slate-600 dark:text-cyan-300 border border-indigo-500/20">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              )}
            </button>

            <div
              className={`flex items-center rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/20 text-[10.5px] ${
                collapsed ? 'justify-center p-2' : 'justify-between px-2 py-1'
              }`}
            >
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {!collapsed && (
                  <span className="flex items-center gap-1 truncate">
                    <Database className="w-3 h-3 shrink-0" />
                    Control Plane: Online
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="text-[9.5px] font-mono text-emerald-600 dark:text-emerald-400">PostgreSQL</span>
              )}
            </div>

            {!collapsed && (
              <div className="flex items-center justify-between px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Keyboard className="w-3 h-3 text-slate-400" />
                  <span>Shortcuts:</span>
                </div>
                <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">F1 - F5 • Ctrl+B</span>
              </div>
            )}

            {!collapsed && (
              <div className="px-2 pt-1 border-t border-indigo-500/15 flex items-center justify-between text-[9.5px] text-slate-400 dark:text-slate-500">
                <span>POS SaaS C-Panel</span>
                <span className="font-mono">v1.0.0</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100 transition-colors">
      {/* DESKTOP FIXED SIDEBAR WITH SMOOTH SPRING WIDTH TRANSITION */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className="hidden lg:flex shrink-0 h-screen sticky top-0 z-30 no-print overflow-hidden rounded-none shadow-lg border-r border-indigo-500/20"
      >
        {renderSuperAdminSidebar(false)}
      </motion.aside>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex no-print">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="relative w-72 max-w-[85vw] h-full max-h-screen shadow-2xl z-10 overflow-hidden rounded-none border-r border-indigo-500/20"
            >
              {renderSuperAdminSidebar(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RIGHT COLUMN: TOP HEADER + MAIN WORKSPACE + FOOTER (Aligned with Store Page) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E1A]">
        {/* STICKY TOP HEADER BAR (Exact h-[3.6rem] aligned with Store Header.tsx) */}
        <header className="h-[3.6rem] sticky top-0 z-20 bg-white/95 dark:bg-[#0D1322]/95 backdrop-blur-lg border-b border-indigo-500/20 px-3 sm:px-6 flex items-center justify-between gap-3 shrink-0 shadow-2xs transition-colors">
          {/* Left: Mobile Menu Button + Active Section Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              aria-label="Open Navigation Drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-mono font-bold">
                <Shield className="w-3.5 h-3.5" />
                SuperAdmin
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {activeTab === 'dashboard' && 'SuperAdmin Executive Dashboard'}
                {activeTab === 'stores' && 'Deployed Stores & Middleware Control'}
                {activeTab === 'requests' && 'Pending Store Requests Queue'}
                {activeTab === 'reports' && 'Platform Reports, Top Revenue Stores & Top SKUs'}
                {activeTab === 'manifests' && 'Scoped Tenant PWA Manifests'}
              </h2>
            </div>
          </div>

          {/* Center: Quick Filter Search Input (aligned with Store Header Quick Search) */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-purple-300/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stores or owners..."
                className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-100/90 dark:bg-[#131B2E] border border-slate-200/90 dark:border-indigo-500/30 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-purple-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions, Theme Dropdown, User Profile & Sign Out */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setImportSqlError(null);
                setImportSqlModalOpen(true);
              }}
              title="Import Multi-Store or Platform .SQL File"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-500/30 text-xs font-bold transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Import SQL</span>
            </button>

            <button
              type="button"
              onClick={handleExportPlatformSql}
              disabled={exportingPlatform}
              title="Export All Stores & Platform Database to .SQL File"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {exportingPlatform ? 'Exporting SQL...' : 'Export All SQL'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white text-xs font-bold shadow-xs shadow-purple-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add New Store</span>
            </button>

            <button
              type="button"
              onClick={loadOverview}
              disabled={loading}
              title="Refresh platform telemetry"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#131B2E] dark:hover:bg-[#1A263D] border border-slate-200/80 dark:border-indigo-500/20 text-slate-600 dark:text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600 dark:text-purple-400' : ''}`} />
            </button>

            <ThemeDropdown />

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-indigo-500/20">
              <UserAvatar
                name={currentUser?.name || 'Platform SuperAdmin'}
                avatarUrl={currentUser?.avatarUrl}
                role="ADMIN"
                size="sm"
              />
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  {currentUser?.name || 'SuperAdmin'}
                </div>
                <div className="text-[10px] font-mono text-purple-600 dark:text-purple-300 font-semibold">
                  SUPERADMIN
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200/80 dark:border-rose-500/30 text-xs font-bold transition cursor-pointer"
              title="Sign Out of SuperAdmin C-Panel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* MAIN CONTENT AREA (Aligned with Store DashboardOverview.tsx) */}
        <main className="flex-1 min-w-0 overflow-x-hidden bg-[#F8FAFC] dark:bg-[#0A0E1A] transition-colors">
          <div
            ref={superAdminWorkspaceRef}
            className="p-4 sm:p-6 lg:p-7 space-y-6 max-w-7xl mx-auto select-none"
          >
            {/* DASHBOARD HEADER ROW (Shown on Dashboard & Manifests tabs; Stores, Requests & Reports use Product-route Top Banner Card) */}
            {(activeTab === 'dashboard' || activeTab === 'manifests') && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {activeTab === 'dashboard' && 'Dashboard'}
                    {activeTab === 'manifests' && 'Scoped Store & Admin PWA Manifests'}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Welcome back, {currentUser?.name || 'Platform SuperAdmin'}! Manage tenant isolation, real-time store suspension, and store provisioning.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#0E1628] border border-slate-200/90 dark:border-[#1A263D] text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{formattedDate}</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadOverview}
                    disabled={loading}
                    title="Refresh metrics & recount stats"
                    className="p-1.5 rounded-xl bg-white hover:text-purple-600 border border-slate-200/90 shadow-2xs dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 text-slate-500 cursor-pointer transition active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        loading ? 'animate-spin text-purple-600 dark:text-purple-300' : 'text-slate-500 dark:text-purple-300'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Error Alert Banner */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200 font-mono font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Success Notification Banner */}
            {successMessage && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-mono font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Newly Provisioned Store Credentials Banner */}
            {provisionedBanner && (
              <div className="app-card bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl p-5 sm:p-6 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-base">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Store Provisioned: {provisionedBanner.storeName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Isolated tenant schema initialized and initial Store Owner credentials generated:
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-xs">
                      <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-2xs">
                        <KeyRound className="w-3.5 h-3.5 inline mr-1.5 text-emerald-600 dark:text-emerald-400" />
                        Admin Email: <strong>{provisionedBanner.adminEmail}</strong>
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-2xs">
                        Initial Password: <strong>{provisionedBanner.initialPassword}</strong>
                      </span>
                      {provisionedBanner.subscriptionEndDate && (
                        <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                          Plan: <strong>{provisionedBanner.subscriptionPlan === '6_MONTHS' ? '6 Months' : 'Yearly'}</strong> • Expires:{' '}
                          <strong>
                            {new Date(provisionedBanner.subscriptionEndDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenOnboarding(provisionedBanner.tenantId)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>Launch Store Onboarding</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenStore(provisionedBanner.tenantId)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      <Store className="w-4 h-4" />
                      <span>Open Store POS</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* EXECUTIVE DASHBOARD VIEW: 5 KPI CARDS + GRAPHICAL STATISTICS (MATCHING STORE DASHBOARD) */}
            {activeTab === 'dashboard' && (() => {
              // Dual-spline Sales & Transactions SVG chart geometry (aligned with Store DashboardOverview.tsx)
              const chartWidth = 560;
              const chartHeight = 200;
              const paddingLeft = 36;
              const paddingRight = 20;
              const paddingTop = 20;
              const paddingBottom = 30;
              const innerWidth = chartWidth - paddingLeft - paddingRight;
              const innerHeight = chartHeight - paddingTop - paddingBottom;

              const rawChartSeries =
                sevenDaySales.length > 0
                  ? sevenDaySales
                  : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((lbl) => ({
                      date: '',
                      label: lbl,
                      amount: 0,
                      txCount: 0,
                    }));

              const maxChartVal = Math.max(
                100,
                ...rawChartSeries.map((s) => Math.max(s.amount || 0, s.txCount || 0))
              );

              const chartPoints = rawChartSeries.map((d, index) => {
                const denom = Math.max(1, rawChartSeries.length - 1);
                const x = paddingLeft + (index / denom) * innerWidth;
                const ySales = paddingTop + innerHeight - ((d.amount || 0) / maxChartVal) * innerHeight;
                const yTx = paddingTop + innerHeight - ((d.txCount || 0) / maxChartVal) * innerHeight;
                return { x, ySales, yTx, ...d };
              });

              const buildSplinePath = (pts: { x: number; y: number }[]) => {
                if (pts.length === 0) return '';
                if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
                let d = `M ${pts[0].x},${pts[0].y}`;
                for (let i = 0; i < pts.length - 1; i++) {
                  const p0 = pts[i === 0 ? 0 : i - 1];
                  const p1 = pts[i];
                  const p2 = pts[i + 1];
                  const p3 = pts[i + 2] || p2;
                  const cp1x = p1.x + (p2.x - p0.x) / 5;
                  const cp1y = p1.y + (p2.y - p0.y) / 5;
                  const cp2x = p2.x - (p3.x - p1.x) / 5;
                  const cp2y = p2.y - (p3.y - p1.y) / 5;
                  d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                }
                return d;
              };

              const salesLinePath = buildSplinePath(chartPoints.map((p) => ({ x: p.x, y: p.ySales })));
              const txLinePath = buildSplinePath(chartPoints.map((p) => ({ x: p.x, y: p.yTx })));
              const baselineY = paddingTop + innerHeight;
              const lastX = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].x : innerWidth;
              const firstX = chartPoints.length > 0 ? chartPoints[0].x : paddingLeft;

              const salesAreaPath =
                chartPoints.length > 0 && salesLinePath
                  ? `${salesLinePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`
                  : '';
              const txAreaPath =
                chartPoints.length > 0 && txLinePath
                  ? `${txLinePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`
                  : '';

              // Top Revenue Stores sorted for Donut Gauges & Graphical Bar Comparison
              const topStoresByRevenue = [...stores].sort((a, b) => {
                if (b.totalSales !== a.totalSales) return b.totalSales - a.totalSales;
                if (b.productCount !== a.productCount) return b.productCount - a.productCount;
                return b.totalStockUnits - a.totalStockUnits;
              });

              const totalRevenueAll = stores.reduce((sum, s) => sum + (s.totalSales || 0), 0);
              const totalStockValAll = stores.reduce((sum, s) => sum + (s.inventoryValue || 0), 0);
              const maxStoreRevenue = Math.max(
                1,
                ...topStoresByRevenue.map((s) => (totalRevenueAll > 0 ? s.totalSales : s.inventoryValue || s.productCount || 1))
              );

              // Donut Ring Items (Top 2 Stores by Revenue or Inventory Value)
              const donutStores = topStoresByRevenue.slice(0, 2).map((st, idx) => {
                const pct =
                  totalRevenueAll > 0
                    ? Math.min(100, Math.max(8, Math.round((st.totalSales / totalRevenueAll) * 100)))
                    : totalStockValAll > 0
                    ? Math.min(100, Math.max(8, Math.round(((st.inventoryValue || 0) / totalStockValAll) * 100)))
                    : stores.length > 0
                    ? Math.round(100 / stores.length)
                    : 0;
                return {
                  id: st.id,
                  name: st.name,
                  themeColor: st.themeColor || (idx === 0 ? '#3B82F6' : '#8B5CF6'),
                  pct,
                  subtitle:
                    st.totalSales > 0
                      ? `${st.currency} ${Math.round(st.totalSales).toLocaleString()}`
                      : `${st.productCount} SKUs • ${st.totalStockUnits} units`,
                };
              });

              // Compute Dynamic Platform Retail Shoe Metrics (Sales Target, Category Breakdown, Inventory Clearance)
              const platformSevenDayTotal = rawChartSeries.reduce(
                (sum, d) => sum + (Number(d.amount) || 0),
                0
              );
              const platformTodaySales =
                rawChartSeries.length > 0
                  ? Number(rawChartSeries[rawChartSeries.length - 1]?.amount || 0)
                  : Math.round(totalRevenueAll * 0.14);
              const totalStockUnitsAll = stores.reduce(
                (sum, s) => sum + (s.totalStockUnits || 0),
                0
              );
              const totalUnitsSoldAll = stores.reduce(
                (sum, s) => sum + (s.unitsSold || 0),
                0
              );
              const totalInvoicesAll = stores.reduce(
                (sum, s) => sum + (s.salesCount || 0),
                0
              );
              const onboardedStoresCount = stores.filter((s) => s.onboardingCompleted).length;

              const dailyPlatformTarget = Math.max(
                50000,
                Math.ceil((Math.max(platformTodaySales, platformSevenDayTotal / 7) * 1.25) / 10000) * 10000
              );
              const weeklyPlatformTarget = Math.max(
                350000,
                Math.ceil((Math.max(platformSevenDayTotal, dailyPlatformTarget * 6) * 1.2) / 25000) * 25000
              );
              const cumulativePlatformTarget = Math.max(
                1000000,
                Math.ceil((Math.max(totalRevenueAll, weeklyPlatformTarget * 3) * 1.18) / 50000) * 50000
              );

              const maxCatUnits = Math.max(
                1,
                ...reportCategories.map((c) => Math.max(c.unitsSold || 0, c.totalStock || 1))
              );

              const platformRetailMetrics: RetailShoeMetricsData = {
                salesTargets: [
                  {
                    id: 'sa-daily-target',
                    label: 'Platform Daily POS Sales Target',
                    currentValue: platformTodaySales,
                    targetValue: dailyPlatformTarget,
                    percentage:
                      platformTodaySales > 0
                        ? Math.min(100, Math.max(18, Math.round((platformTodaySales / dailyPlatformTarget) * 100)))
                        : 74,
                    unit: 'currency',
                    subtitle: `Across ${metrics.activeStores} active retail shoe stores today`,
                    status: 'Live Sync',
                  },
                  {
                    id: 'sa-weekly-quota',
                    label: '7-Day Multi-Store Revenue Quota',
                    currentValue: platformSevenDayTotal,
                    targetValue: weeklyPlatformTarget,
                    percentage:
                      platformSevenDayTotal > 0
                        ? Math.min(100, Math.max(24, Math.round((platformSevenDayTotal / weeklyPlatformTarget) * 100)))
                        : 79,
                    unit: 'currency',
                    subtitle: `${totalInvoicesAll.toLocaleString()} POS invoices processed`,
                    status: 'Strong Pace',
                  },
                  {
                    id: 'sa-cumulative-goal',
                    label: 'Platform Gross Footwear Billing Goal',
                    currentValue: Math.round(totalRevenueAll),
                    targetValue: cumulativePlatformTarget,
                    percentage:
                      totalRevenueAll > 0
                        ? Math.min(100, Math.max(28, Math.round((totalRevenueAll / cumulativePlatformTarget) * 100)))
                        : 85,
                    unit: 'currency',
                    subtitle: `${stores.length} deployed tenant stores combined`,
                    status: 'Exceeding',
                  },
                  {
                    id: 'sa-store-activation-target',
                    label: 'Active Store Subscription & POS Readiness',
                    currentValue: Math.round(totalStockValAll * 0.34),
                    targetValue: Math.max(100000, Math.round(totalStockValAll * 0.4)),
                    percentage:
                      metrics.totalStores > 0
                        ? Math.min(100, Math.max(35, Math.round((metrics.activeStores / metrics.totalStores) * 100)))
                        : 92,
                    unit: 'currency',
                    subtitle: `${onboardedStoresCount}/${Math.max(1, stores.length)} stores onboarded & active`,
                    status: 'Healthy',
                  },
                ],
                categoryBreakdown:
                  reportCategories.length > 0
                    ? reportCategories.slice(0, 4).map((cat, idx) => ({
                        id: `sa-cat-${idx}`,
                        name: cat.name || `Footwear Category #${idx + 1}`,
                        unitsSold: cat.unitsSold || 0,
                        stockUnits: cat.totalStock || 0,
                        productCount: cat.skuCount || 0,
                        revenue: cat.totalRevenue || 0,
                        percentage: Math.min(
                          100,
                          Math.max(
                            22,
                            Math.round(
                              (Math.max(cat.unitsSold || 0, (cat.totalStock || 0) * 0.65) / maxCatUnits) * 100
                            )
                          )
                        ),
                        subtitle: `${cat.skuCount || 0} SKUs • Rs. ${Math.round(cat.totalRevenue || 0).toLocaleString()} revenue`,
                      }))
                    : undefined,
                inventoryClearance: [
                  {
                    id: 'sa-sell-through',
                    label: 'Platform Footwear Sell-Through Velocity',
                    percentage:
                      totalUnitsSoldAll + totalStockUnitsAll > 0
                        ? Math.min(
                            100,
                            Math.max(
                              26,
                              Math.round(
                                (totalUnitsSoldAll /
                                  Math.max(1, totalUnitsSoldAll + totalStockUnitsAll * 0.35)) *
                                  100
                              )
                            )
                          )
                        : 71,
                    currentUnits: totalUnitsSoldAll,
                    totalUnits: Math.max(1, totalUnitsSoldAll + totalStockUnitsAll),
                    subtitle: 'Total pairs sold vs platform shelf inventory',
                    badge: 'Fast Moving',
                  },
                  {
                    id: 'sa-active-stores-coverage',
                    label: 'Active Tenant Store Uptime & Compliance',
                    percentage:
                      metrics.totalStores > 0
                        ? Math.min(100, Math.max(25, Math.round((metrics.activeStores / metrics.totalStores) * 100)))
                        : 95,
                    currentUnits: metrics.activeStores,
                    totalUnits: Math.max(1, metrics.totalStores),
                    subtitle: `${metrics.activeStores} of ${metrics.totalStores} stores active on middleware`,
                    badge: 'Online',
                  },
                  {
                    id: 'sa-top-skus-velocity',
                    label: 'Top-Performing Footwear Articles Turnover',
                    percentage:
                      reportSkus.length > 0
                        ? Math.min(100, Math.max(42, Math.round((reportSkus.filter((k) => k.unitsSold > 0).length / reportSkus.length) * 100)))
                        : 78,
                    currentUnits: reportSkus.reduce((s, k) => s + (k.unitsSold || 0), 0),
                    totalUnits: Math.max(
                      1,
                      reportSkus.reduce((s, k) => s + (k.unitsSold || 0) + (k.totalStock || 0), 0)
                    ),
                    subtitle: `${reportSkus.length} high-velocity SKUs tracked across tenants`,
                    badge: 'High Demand',
                  },
                  {
                    id: 'sa-catalog-availability',
                    label: 'Multi-Store Catalog Stock Readiness',
                    percentage:
                      metrics.totalPlatformProducts > 0
                        ? Math.min(
                            100,
                            Math.max(
                              64,
                              Math.round(
                                (stores.filter((s) => s.totalStockUnits > 0).length /
                                  Math.max(1, stores.length)) *
                                  100
                              )
                            )
                          )
                        : 90,
                    currentUnits: totalStockUnitsAll,
                    totalUnits: Math.max(1, totalStockUnitsAll + totalUnitsSoldAll),
                    subtitle: `${metrics.totalPlatformProducts.toLocaleString()} total SKUs in tenant catalogs`,
                    badge: 'Well Stocked',
                  },
                ],
              };

              return (
                <div className="space-y-6">
                  {/* ROW 1: 5 KPI METRIC CARDS WITH ANIMATED COUNTER */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <StatCard
                      id="superadmin-stat-total-stores"
                      title="Deployed Stores"
                      value={metrics.totalStores}
                      icon={Store}
                      iconColor="blue"
                      sparkline="blue"
                      trendIndicator={{
                        value: `${metrics.activeStores} Active`,
                        direction: 'up',
                        label: 'tenants',
                      }}
                      loading={loading}
                      delay={0}
                      duration={1200}
                    />

                    <StatCard
                      id="superadmin-stat-active-stores"
                      title="Active Tenants"
                      value={metrics.activeStores}
                      icon={CheckCircle2}
                      iconColor="emerald"
                      sparkline="emerald"
                      trendIndicator={{
                        value: 'Online',
                        direction: 'up',
                        label: 'middleware',
                      }}
                      loading={loading}
                      delay={0}
                      duration={1200}
                    />

                    <StatCard
                      id="superadmin-stat-suspended-stores"
                      title="Suspended Stores"
                      value={metrics.suspendedStores}
                      icon={AlertCircle}
                      iconColor="rose"
                      sparkline="rose"
                      valueClassName={metrics.suspendedStores > 0 ? 'text-rose-600 dark:text-rose-400' : undefined}
                      trendIndicator={
                        metrics.suspendedStores > 0
                          ? { value: `${metrics.suspendedStores}`, direction: 'down', label: 'revoked' }
                          : { value: '0', direction: 'neutral', label: 'none suspended' }
                      }
                      loading={loading}
                      delay={0}
                      duration={1200}
                    />

                    <StatCard
                      id="superadmin-stat-pending-requests"
                      title="Pending Requests"
                      value={metrics.pendingRequests}
                      icon={Clock}
                      iconColor="purple"
                      sparkline="purple"
                      trendIndicator={{
                        value: '1-Click',
                        direction: 'up',
                        label: 'provisioning',
                      }}
                      loading={loading}
                      delay={0}
                      duration={1200}
                    />

                    <StatCard
                      id="superadmin-stat-platform-revenue"
                      title="Platform Sales"
                      value={Math.round(metrics.totalPlatformRevenue)}
                      prefix="Rs. "
                      icon={TrendingUp}
                      iconColor="sky"
                      sparkline="sky"
                      trendIndicator={{
                        value: `${metrics.totalPlatformProducts.toLocaleString()} SKUs`,
                        direction: 'up',
                        label: 'catalog',
                      }}
                      loading={loading}
                      delay={0}
                      duration={1200}
                    />
                  </div>

                  {/* DYNAMIC RETAIL SHOE METRICS (Sales Target, Category Breakdown, Inventory Clearance) WITH INTERSECTION OBSERVER ANIMATION */}
                  <RetailShoeMetrics
                    metrics={platformRetailMetrics}
                    todaySales={platformTodaySales}
                    totalProducts={metrics.totalPlatformProducts}
                    lowStockCount={0}
                    allTimeRevenue={metrics.totalPlatformRevenue}
                    sevenDaySalesTotal={platformSevenDayTotal}
                    topSelling={reportSkus}
                    currency="Rs."
                    loading={loading}
                    onNavigate={(tab) => setActiveTab(tab as SuperAdminTab)}
                    variant="superadmin-dashboard"
                  />

                  {/* ROW 2: 3 GRAPHICAL CARDS (Platform Sales Overview + Top Revenue Stores Donut Gauges + Best Selling Products) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
                    {/* Card 1: Platform Sales Overview Dual-Spline Area Chart (Span 5 on xl) */}
                    <div className="md:col-span-2 lg:col-span-12 xl:col-span-5 app-card bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          Platform Sales Overview
                        </h2>

                        <div className="flex items-center gap-3">
                          {/* Chart Legend */}
                          <div className="flex items-center gap-2.5 text-[11px]">
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                              <span className="w-2 h-2 rounded-full bg-[#3B82F6] dark:shadow-[0_0_6px_#3B82F6]" />
                              <span>Sales Amount</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                              <span className="w-2 h-2 rounded-full bg-[#06B6D4] dark:shadow-[0_0_6px_#06B6D4]" />
                              <span>Transactions</span>
                            </div>
                          </div>

                          {/* Timeframe selector */}
                          <div className="relative">
                            <select
                              value={chartTimeframe}
                              onChange={(e) => setChartTimeframe(e.target.value as '7days' | 'month' | 'year')}
                              className="appearance-none bg-slate-50 dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 text-[11px] font-medium text-slate-700 dark:text-purple-200 py-1 pl-2.5 pr-6 rounded-lg outline-none cursor-pointer hover:border-purple-400 transition"
                            >
                              <option value="7days" className="dark:bg-[#120726] dark:text-purple-100">
                                Last 7 Days
                              </option>
                              <option value="month" className="dark:bg-[#120726] dark:text-purple-100">
                                This Month
                              </option>
                              <option value="year" className="dark:bg-[#120726] dark:text-purple-100">
                                This Year
                              </option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-400 dark:text-purple-300 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Dual Spline Chart Canvas */}
                      <div className="relative w-full overflow-hidden">
                        <svg
                          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                          className="w-full h-48 overflow-visible"
                        >
                          <defs>
                            <linearGradient id="superAdminSalesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="superAdminTxGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.32" />
                              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Dotted Horizontal Grid lines */}
                          {[100, 80, 60, 40, 20, 0].map((val) => {
                            const y = paddingTop + innerHeight - (val / 100) * innerHeight;
                            return (
                              <g key={val}>
                                <line
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={paddingLeft + innerWidth}
                                  y2={y}
                                  stroke="currentColor"
                                  className="text-slate-100 dark:text-[#1A263D] stroke-1"
                                  strokeDasharray="3 3"
                                />
                                <text
                                  x={paddingLeft - 8}
                                  y={y + 3}
                                  textAnchor="end"
                                  className="text-[9.5px] font-mono fill-slate-400 dark:fill-slate-500"
                                >
                                  {val}
                                </text>
                              </g>
                            );
                          })}

                          {/* Area Fills */}
                          <path d={salesAreaPath} fill="url(#superAdminSalesGrad)" />
                          <path d={txAreaPath} fill="url(#superAdminTxGrad)" />

                          {/* Spline Curves */}
                          <path
                            d={salesLinePath}
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="neon-glow-blue"
                          />
                          <path
                            d={txLinePath}
                            fill="none"
                            stroke="#06B6D4"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="neon-glow-cyan"
                          />

                          {/* Point Markers & Hover Tooltips */}
                          {chartPoints.map((p, i) => {
                            const isHovered = hoveredChartPoint === i;
                            return (
                              <g
                                key={`sa-point-${p.label}-${i}`}
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredChartPoint(i)}
                                onMouseLeave={() => setHoveredChartPoint(null)}
                              >
                                <circle
                                  cx={p.x}
                                  cy={p.ySales}
                                  r={isHovered ? 5.5 : 3.5}
                                  className="fill-white dark:fill-[#0A0E1A] stroke-[#3B82F6] transition-all"
                                  strokeWidth="2.5"
                                />
                                <circle
                                  cx={p.x}
                                  cy={p.yTx}
                                  r={isHovered ? 5 : 3}
                                  className="fill-white dark:fill-[#0A0E1A] stroke-[#06B6D4] transition-all"
                                  strokeWidth="2"
                                />
                                <text
                                  x={p.x}
                                  y={chartHeight - 8}
                                  textAnchor="middle"
                                  className="text-[10px] font-medium fill-slate-500 dark:fill-slate-400"
                                >
                                  {p.label}
                                </text>

                                {isHovered && (
                                  <g className="pointer-events-none">
                                    <rect
                                      x={Math.max(paddingLeft, Math.min(p.x - 60, chartWidth - 125))}
                                      y={Math.min(p.ySales, p.yTx) - 44}
                                      width="120"
                                      height="36"
                                      rx="8"
                                      className="fill-slate-900 dark:fill-[#131F37] stroke stroke-slate-700 dark:stroke-[#1E2D4A] shadow-xl"
                                    />
                                    <text
                                      x={Math.max(paddingLeft + 60, Math.min(p.x, chartWidth - 65))}
                                      y={Math.min(p.ySales, p.yTx) - 28}
                                      textAnchor="middle"
                                      className="text-[9.5px] font-bold fill-white font-mono"
                                    >
                                      Rs. {Math.round(p.amount).toLocaleString()}
                                    </text>
                                    <text
                                      x={Math.max(paddingLeft + 60, Math.min(p.x, chartWidth - 65))}
                                      y={Math.min(p.ySales, p.yTx) - 15}
                                      textAnchor="middle"
                                      className="text-[9px] font-medium fill-cyan-400 font-mono"
                                    >
                                      {p.txCount} Invoices
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>

                    {/* Card 2: Top Performing Stores Donut Gauges (Span 4 on xl, matching Store Best Selling Brands) */}
                    <div className="md:col-span-1 lg:col-span-6 xl:col-span-4 app-card bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between min-w-0 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          Top Performing Stores
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('reports')}
                          className="text-xs font-bold text-purple-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          View Reports
                        </button>
                      </div>

                      {donutStores.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                          No store performance data yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 py-2 my-auto min-w-0">
                          {donutStores.map((st, idx) => {
                            const pct = st.pct || 0;
                            const circumference = 238.76;
                            const strokeColor = idx === 0 ? '#3B82F6' : '#8B5CF6';

                            return (
                              <div
                                key={st.id}
                                onClick={() => onOpenStore(st.id)}
                                className="flex flex-col items-center text-center min-w-0 cursor-pointer group"
                              >
                                <div className="relative w-20 h-20 sm:w-24 sm:h-24 max-w-full flex items-center justify-center shrink-0">
                                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="38"
                                      className="text-slate-100 dark:text-slate-800 stroke-current"
                                      strokeWidth="7"
                                      fill="none"
                                    />
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="38"
                                      stroke={strokeColor}
                                      strokeWidth="7"
                                      strokeLinecap="round"
                                      fill="none"
                                      strokeDasharray={circumference}
                                      strokeDashoffset={circumference}
                                      data-per={pct}
                                      data-per-role="donut"
                                      data-circumference={circumference}
                                      data-stagger-index={idx}
                                      className={`${idx === 0 ? 'neon-glow-blue' : ''}`}
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                                    <div
                                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:scale-105 transition"
                                      style={{ backgroundColor: st.themeColor }}
                                    >
                                      {(st.name || 'ST').slice(0, 2).toUpperCase()}
                                    </div>
                                    <span
                                      data-per={pct}
                                      data-per-role="counter"
                                      data-stagger-index={idx}
                                      className="text-[9.5px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5"
                                    >
                                      0%
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-2.5 w-full min-w-0 px-1">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 truncate transition">
                                    {st.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                                    {st.subtitle}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bottom Store Status Graphical Distribution Bar */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ● {metrics.activeStores} Active
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            ● {pendingRequestsCount} Pending Req
                          </span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            ● {metrics.suspendedStores} Suspended
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                          <div
                            data-per={
                              metrics.totalStores > 0
                                ? Math.max(10, Math.round((metrics.activeStores / metrics.totalStores) * 100))
                                : 100
                            }
                            data-per-role="bar"
                            data-stagger-index={0}
                            className="h-full bg-emerald-500"
                            style={{ width: '0%' }}
                          />
                          {metrics.suspendedStores > 0 && (
                            <div
                              data-per={Math.round((metrics.suspendedStores / Math.max(1, metrics.totalStores)) * 100)}
                              data-per-role="bar"
                              data-stagger-index={1}
                              className="h-full bg-rose-500"
                              style={{ width: '0%' }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Best Selling Products across Stores (Span 3 on xl, matching Store Dashboard) */}
                    <div className="md:col-span-1 lg:col-span-6 xl:col-span-3 app-card bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between min-w-0 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          Best Selling Products
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('reports')}
                          className="text-xs font-bold text-purple-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          View All
                        </button>
                      </div>

                      {reportSkus.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                          No product sales recorded yet.
                        </div>
                      ) : (
                        <div className="space-y-3 my-auto min-w-0">
                          {reportSkus.slice(0, 3).map((prod, idx) => (
                            <div
                              key={`${prod.tenantId}-${prod.id}-${idx}`}
                              onClick={() => onOpenStore(prod.tenantId)}
                              className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition min-w-0 cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 dark:bg-slate-950/60 overflow-hidden shrink-0 border border-slate-200/60 dark:border-slate-800">
                                  <img
                                    src={
                                      prod.imageUrl ||
                                      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop&q=80'
                                    }
                                    alt={prod.productName}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {prod.productName}
                                  </div>
                                  <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 flex-wrap">
                                    {prod.category && (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-cyan-400 border border-purple-200/80 dark:border-cyan-500/30 whitespace-nowrap">
                                        {prod.category}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                                      {prod.storeName}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0 ml-1">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                  Stock: {prod.totalStock}
                                </div>
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 whitespace-nowrap">
                                  Sold: {prod.unitsSold}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ROW 3: STORE REVENUE GRAPHICAL BARS & LATEST TRANSACTIONS (Left Span 7) + QUICK ACTIONS (Right Span 5) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Graphical Store Revenue Comparison + Latest Platform Transactions (Span 7) */}
                    <div className="lg:col-span-7 app-card bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between gap-5 shadow-xs">
                      {/* Top Half: Store Revenue & Catalog Graphical Bars */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                              Store Revenue &amp; Catalog Graphical Comparison
                            </h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Visual comparison of deployed stores by POS revenue, SKU count, and stock units
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('reports')}
                            className="text-xs font-bold text-purple-600 dark:text-cyan-400 hover:underline cursor-pointer"
                          >
                            Full Leaderboard
                          </button>
                        </div>

                        <div className="space-y-3">
                          {topStoresByRevenue.slice(0, 4).map((st, idx) => {
                            const metricVal =
                              totalRevenueAll > 0
                                ? st.totalSales
                                : st.inventoryValue || st.productCount || 0;
                            const barWidthPct = Math.min(
                              100,
                              Math.max(8, Math.round((metricVal / maxStoreRevenue) * 100))
                            );
                            return (
                              <div
                                key={st.id}
                                onClick={() => onOpenStore(st.id)}
                                className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-500/40 transition cursor-pointer"
                              >
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: st.themeColor || '#7C3AED' }}
                                    />
                                    <span className="font-bold text-slate-900 dark:text-white truncate">
                                      {st.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5 font-mono text-xs shrink-0">
                                    <span className="text-slate-500 dark:text-slate-400">
                                      {st.productCount} SKUs • {st.salesCount} inv
                                    </span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      {st.currency} {Math.round(st.totalSales).toLocaleString()}
                                    </span>
                                    <span
                                      data-per={barWidthPct}
                                      data-per-role="counter"
                                      data-stagger-index={idx}
                                      className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-cyan-300 border border-purple-200/60 dark:border-purple-800/60 text-[10px] font-extrabold min-w-[2.4rem] text-right"
                                    >
                                      0%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={0}
                                    aria-label={st.name}
                                    data-per={barWidthPct}
                                    data-per-role="bar"
                                    data-stagger-index={idx}
                                    className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400"
                                    style={{ width: '0%' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom Half: Latest Platform Transactions (matching Store Dashboard) */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            Latest Platform Transactions
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveTab('reports')}
                            className="text-xs font-bold text-purple-600 dark:text-cyan-400 hover:underline cursor-pointer"
                          >
                            View All
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900">
                              <tr className="border-b border-slate-100 dark:border-purple-800/80 text-slate-400 dark:text-white font-semibold">
                                <th className="py-2 px-2.5 font-semibold">Transaction #</th>
                                <th className="py-2 px-2.5 font-semibold">Store</th>
                                <th className="py-2 px-2.5 font-semibold">Customer / Party</th>
                                <th className="py-2 px-2.5 font-semibold">Status</th>
                                <th className="py-2 px-2.5 font-semibold text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {recentTransactions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500">
                                    No platform transactions recorded yet.
                                  </td>
                                </tr>
                              ) : (
                                recentTransactions.slice(0, 5).map((tx, idx) => (
                                  <tr key={`${tx.reference}-${idx}`} className="table-row-hover">
                                    <td className="py-2.5 px-2.5 font-mono font-semibold text-purple-600 dark:text-cyan-400">
                                      {tx.reference}
                                    </td>
                                    <td className="py-2.5 px-2.5 font-bold text-slate-800 dark:text-slate-200">
                                      {tx.storeName}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-slate-600 dark:text-slate-300">
                                      {tx.customerName}
                                    </td>
                                    <td className="py-2.5 px-2.5">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                          tx.type === 'Return'
                                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                        }`}
                                      >
                                        {tx.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                      {tx.currency} {Math.round(tx.amount).toLocaleString()}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Actions (Span 5, matching Store Dashboard Quick Actions) */}
                    <div className="lg:col-span-5 app-card bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          Quick Actions
                        </h2>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          Shortcuts F1–F5
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 flex-1">
                        {/* Action 1: Deployed Stores (F1) */}
                        <button
                          type="button"
                          onClick={() => setActiveTab('stores')}
                          className="quick-action-btn p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 transition shadow-2xs">
                              <Store className="w-4 h-4" />
                            </div>
                            <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition">
                              F1
                            </kbd>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                              Deployed Stores
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition">
                              {stores.length} Tenants Directory
                            </div>
                          </div>
                        </button>

                        {/* Action 2: Store Requests (F2) */}
                        <button
                          type="button"
                          onClick={() => setActiveTab('requests')}
                          className="quick-action-btn p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 transition shadow-2xs">
                              <Clock className="w-4 h-4" />
                            </div>
                            <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition">
                              F2
                            </kbd>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                              Store Requests
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition">
                              {pendingRequestsCount} Pending Approval
                            </div>
                          </div>
                        </button>

                        {/* Action 3: Provision New Store (F3) */}
                        <button
                          type="button"
                          onClick={() => setCreateModalOpen(true)}
                          className="quick-action-btn p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 transition shadow-2xs">
                              <Plus className="w-4 h-4" />
                            </div>
                            <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition">
                              F3
                            </kbd>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                              Provision Store
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition">
                              1-Click Tenant Setup
                            </div>
                          </div>
                        </button>

                        {/* Action 4: Platform Reports (F4) */}
                        <button
                          type="button"
                          onClick={() => setActiveTab('reports')}
                          className="quick-action-btn p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 transition shadow-2xs">
                              <BarChart3 className="w-4 h-4" />
                            </div>
                            <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition">
                              F4
                            </kbd>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                              Platform Reports
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition">
                              Top Stores &amp; SKUs
                            </div>
                          </div>
                        </button>

                        {/* Action 5: Scoped PWA Manifests (F5) */}
                        <button
                          type="button"
                          onClick={() => setActiveTab('manifests')}
                          className="quick-action-btn p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 transition shadow-2xs">
                              <FileCode2 className="w-4 h-4" />
                            </div>
                            <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition">
                              F5
                            </kbd>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                              PWA Manifests
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition">
                              Scoped Store Apps
                            </div>
                          </div>
                        </button>

                        {/* Action 6: Import & Export Platform SQL */}
                        <button
                          type="button"
                          onClick={() => {
                            setImportSqlError(null);
                            setImportSqlModalOpen(true);
                          }}
                          className="quick-action-btn p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 transition shadow-2xs">
                              <Upload className="w-4 h-4" />
                            </div>
                            <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:border-purple-300 dark:group-hover:border-purple-500/50 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition">
                              .SQL
                            </kbd>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                              Import SQL Script
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition">
                              24-Store Seed &amp; Restore
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SECTION 1: DEPLOYED STORES & REAL-TIME MIDDLEWARE ACCESS CONTROL (Aligned with Product Route Theme, Cards, Thead & Tbody) */}
            {activeTab === 'stores' && (
              <div className="space-y-4 max-w-7xl mx-auto text-xs select-none">
                {/* Top Banner & Action (Aligned with Product Route) */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-purple-800/80 shadow-sm transition-colors dark:text-white"
                >
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                      Deployed Stores &amp; Middleware Control
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/80 font-medium mt-0.5">
                      1 Store = 1 Isolated Tenant = Real-Time JWT &amp; Middleware Access Control
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setImportSqlError(null);
                        setImportSqlModalOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-white dark:text-indigo-200 border border-indigo-500 dark:border-indigo-400/40 shadow-sm font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer"
                      title="Import Multi-Store or Platform Database .SQL Script"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import SQL</span>
                    </button>

                    <button
                      type="button"
                      disabled={exportingPlatform}
                      onClick={handleExportPlatformSql}
                      className="bg-[#0284C7] hover:bg-[#0369A1] dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-white dark:text-purple-200 border border-[#0284C7] dark:border-purple-400/40 shadow-sm dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                      title="Export All Stores & Platform Database to .SQL File"
                    >
                      <Download className="w-4 h-4" />
                      <span>{exportingPlatform ? 'Exporting SQL...' : 'Export All SQL'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('requests')}
                      className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-200 border border-emerald-500 dark:border-emerald-400/40 shadow-sm font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
                      title="View Incoming Store Requests Queue"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Store Requests ({pendingRequestsCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(true)}
                      className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 dark:from-purple-600 dark:to-indigo-600 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Store</span>
                    </button>
                  </div>
                </motion.div>

                {/* Filter and Search Bar (Aligned with Product Route) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                  className="app-card p-4 flex flex-wrap items-center gap-3 text-xs transition-colors dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 dark:border-purple-800/80 dark:text-white"
                >
                  <div className="flex-1 min-w-[240px] relative">
                    <Search className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by store name, owner email, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="app-input w-full pl-[2.125rem] pr-8 py-2.5 text-xs font-medium dark:bg-slate-900/80 dark:border-purple-800/60 dark:text-white dark:placeholder-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 p-1 text-xs cursor-pointer"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['ALL', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'ONLINE'] as const).map((statusOpt) => (
                      <button
                        key={statusOpt}
                        type="button"
                        onClick={() => setStatusFilter(statusOpt)}
                        className={`px-3.5 py-2.5 rounded-xl font-bold border transition cursor-pointer text-xs flex items-center gap-1.5 ${
                          statusFilter === statusOpt
                            ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border-purple-400/50 shadow-md shadow-purple-600/20 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)]'
                            : 'bg-slate-50 dark:bg-purple-500/20 text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white'
                        }`}
                      >
                        {statusOpt === 'ONLINE' && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              statusFilter === 'ONLINE'
                                ? 'bg-emerald-300 animate-pulse'
                                : 'bg-emerald-500'
                            }`}
                          />
                        )}
                        <span>{statusOpt}</span>
                      </button>
                    ))}
                  </div>

                  <span className="font-mono font-bold px-3.5 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]">
                    {filteredStores.length} Tenants
                  </span>

                  <button
                    type="button"
                    onClick={loadOverview}
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold rounded-xl transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                    title={loading ? 'Refreshing deployed stores...' : 'Refresh store stats & records'}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        loading ? 'animate-spin text-blue-600 dark:text-purple-300' : 'text-blue-600 dark:text-purple-300'
                      }`}
                    />
                    <span>Refresh</span>
                  </button>
                </motion.div>

                {/* Deployed Stores Table (Aligned with Product Route Table, Thead & Tbody) */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.3 }}
                  className="app-card overflow-hidden transition-colors dark:border-purple-800/60"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-700 dark:text-white font-bold border-b border-slate-200 dark:border-purple-800/80 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4 w-14">Store</th>
                          <th className="py-3.5 px-4">Store Name &amp; ID</th>
                          <th className="py-3.5 px-3">Owner &amp; Setup Status</th>
                          <th className="py-3.5 px-4">Subscription &amp; Expiry</th>
                          <th className="py-3.5 px-3 text-right">Total Sales &amp; Invoices</th>
                          <th className="py-3.5 px-3 text-center">Catalog &amp; Stock</th>
                          <th className="py-3.5 px-3 text-center">Status</th>
                          <th className="py-3.5 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {loading ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                                <p className="font-medium text-xs">Loading deployed stores...</p>
                              </div>
                            </td>
                          </tr>
                        ) : filteredStores.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400">
                              No stores match your current filter criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredStores.map((store) => {
                            const effectiveStatus =
                              store.subscriptionStatus === 'EXPIRED' || store.status === 'EXPIRED'
                                ? 'EXPIRED'
                                : store.status === 'SUSPENDED' || store.subscriptionStatus === 'SUSPENDED'
                                ? 'SUSPENDED'
                                : 'ACTIVE';
                            const isActive = effectiveStatus === 'ACTIVE';
                            const isExpired = effectiveStatus === 'EXPIRED';

                            return (
                              <tr
                                key={store.id}
                                className="table-row-hover border-b border-slate-100 dark:border-slate-800/80"
                              >
                                {/* Store Avatar Box (Aligned with Product Image cell) */}
                                <td className="py-3.5 px-4">
                                  <div className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#0A0E1A] overflow-hidden flex items-center justify-center shrink-0 p-1 shadow-2xs">
                                    <div
                                      className="w-full h-full rounded-lg flex items-center justify-center text-white font-black text-xs shadow-2xs"
                                      style={{ backgroundColor: store.themeColor || '#7C3AED' }}
                                    >
                                      {(store.name || 'ST').slice(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                </td>

                                {/* Store Name & Tenant ID */}
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                                    {store.name}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 dark:bg-[#312E81]/60 text-indigo-700 dark:text-[#A5B4FC] border border-indigo-200 dark:border-[#6366F1]/40 font-mono">
                                      ID #{store.id}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-sky-50 dark:bg-[#0284C7]/20 text-sky-700 dark:text-[#38BDF8] border border-sky-200 dark:border-[#0284C7]/40 font-mono">
                                      {store.currency || 'Rs.'}
                                    </span>
                                  </div>
                                </td>

                                {/* Owner Contact & Onboarding Setup Capsules */}
                                <td className="py-3.5 px-3">
                                  <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-white">
                                    {store.ownerEmail}
                                  </div>
                                  {store.ownerPhone && (
                                    <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                      {store.ownerPhone}
                                    </div>
                                  )}
                                  <div className="mt-1">
                                    {store.onboardingCompleted ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                        ● Setup Complete
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                        ● Pending Setup
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Subscription Plan & Expiry */}
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-50 dark:bg-[#1E3A8A]/50 text-blue-800 dark:text-[#93C5FD] border border-blue-200 dark:border-[#3B82F6]/40">
                                      {store.subscriptionPlan === '6_MONTHS' ? '6 Months Plan' : 'Yearly Plan'}
                                    </span>
                                  </div>
                                  <div
                                    className={`font-mono text-[11px] font-bold mt-1 ${
                                      isExpired
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    Exp:{' '}
                                    {store.subscriptionEndDate
                                      ? new Date(store.subscriptionEndDate).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                        })
                                      : 'N/A'}
                                  </div>
                                </td>

                                {/* Total Sales & Invoices (Aligned with Pricing & Cost column) */}
                                <td className="py-3.5 px-3 text-right">
                                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                    {store.currency} {Math.round(store.totalSales).toLocaleString()}
                                  </div>
                                  <div className="flex items-center justify-end gap-1 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 uppercase">
                                      POS
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
                                      {store.salesCount} invoices
                                    </span>
                                  </div>
                                </td>

                                {/* Catalog & Stock (Aligned with Total Stock column) */}
                                <td className="py-3.5 px-3 text-center">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono">
                                    {store.productCount.toLocaleString()} SKUs
                                  </span>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold mt-0.5">
                                    {store.totalStockUnits.toLocaleString()} units
                                  </div>
                                </td>

                                {/* Status Pill */}
                                <td className="py-3.5 px-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                                        isActive
                                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                          : isExpired
                                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isActive
                                            ? 'bg-emerald-500'
                                            : isExpired
                                            ? 'bg-amber-500'
                                            : 'bg-rose-500'
                                        }`}
                                      />
                                      {effectiveStatus}
                                    </span>
                                    {isActive && store.isOnline !== false && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wide bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-mono">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                        ONLINE
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Actions (Aligned with Product Route Action Buttons) */}
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex items-center justify-center flex-wrap gap-1.5">
                                    {/* 1. Manage Subscription */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSubscription(store)}
                                      className="px-2 py-1.5 rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-[#0E1628] text-purple-700 dark:text-purple-400 hover:bg-purple-600 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white transition-all shadow-2xs group relative cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                                      title="Edit Subscription Plan & Expiry Date"
                                    >
                                      <Calendar className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                      <span className="hidden xl:inline">Plan</span>
                                    </button>

                                    {/* 2. Activate / Suspend Toggle */}
                                    <button
                                      type="button"
                                      disabled={togglingId === store.id}
                                      onClick={() => handleToggleStoreStatus(store)}
                                      className={`px-2 py-1.5 rounded-xl border transition-all shadow-2xs group relative cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
                                        isActive
                                          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-[#0E1628] text-amber-700 dark:text-amber-400 hover:bg-amber-600 dark:hover:bg-amber-600 hover:text-white dark:hover:text-white'
                                          : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-[#0E1628] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 dark:hover:bg-emerald-600 hover:text-white dark:hover:text-white'
                                      }`}
                                      title={
                                        isActive
                                          ? 'Suspend Store Immediately at Middleware Level'
                                          : 'Activate Store Access'
                                      }
                                    >
                                      <Power className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                      <span>
                                        {togglingId === store.id
                                          ? '...'
                                          : isActive
                                          ? 'Suspend'
                                          : 'Activate'}
                                      </span>
                                    </button>

                                    {/* 3. Export Store Data to SQL File */}
                                    <button
                                      type="button"
                                      disabled={exportingStoreId === store.id}
                                      onClick={() => handleExportStoreSql(store)}
                                      className="p-1.5 rounded-xl border border-purple-200 dark:border-purple-400/40 bg-purple-50 dark:bg-purple-500/20 hover:bg-purple-600 dark:hover:bg-purple-500/30 text-purple-600 dark:text-purple-200 hover:text-white dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] transition-all cursor-pointer disabled:opacity-50"
                                      title={`Export ${store.name} Database to .SQL Backup File`}
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>

                                    {/* 4. Initial Store Setup / Onboarding */}
                                    <button
                                      type="button"
                                      onClick={() => onOpenOnboarding(store.id)}
                                      className="p-1.5 rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50/80 dark:bg-[#0E1628] hover:bg-purple-600 dark:hover:bg-purple-600 text-purple-600 dark:text-purple-400 hover:text-white dark:hover:text-white transition-all shadow-2xs group relative cursor-pointer"
                                      title={
                                        store.onboardingCompleted
                                          ? 'Initial Store Setup & POS Defaults Locked'
                                          : 'Open Initial Store Setup'
                                      }
                                    >
                                      {store.onboardingCompleted ? (
                                        <Lock className="w-3.5 h-3.5" />
                                      ) : (
                                        <Wand2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>

                                    {/* 5. Delete Store Button */}
                                    <button
                                      type="button"
                                      onClick={() => setStoreToDelete(store)}
                                      className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-[#0E1628] hover:bg-rose-600 dark:hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white transition-all cursor-pointer"
                                      title={`Delete Store '${store.name}' and all its isolated records`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* 6. Open Store POS */}
                                    <button
                                      type="button"
                                      onClick={() => onOpenStore(store.id)}
                                      className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-2xs dark:shadow-[0_0_12px_rgba(147,51,234,0.25)] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                    >
                                      <span>Open POS</span>
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </div>
            )}

            {/* SECTION 2: STORE REQUESTS MANAGEMENT & 1-CLICK PROVISIONING (Aligned with Product Route Theme, Cards, Thead & Tbody) */}
            {activeTab === 'requests' && (
              <div className="space-y-4 max-w-7xl mx-auto text-xs select-none">
                {/* Top Banner & Action (Aligned with Product Route) */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-purple-800/80 shadow-sm transition-colors dark:text-white"
                >
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                      Store Requests &amp; 1-Click Provisioning
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/80 font-medium mt-0.5">
                      Approve, reject, reopen, or delete incoming store requests • 1-Click Tenant &amp; Owner Setup
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('stores')}
                      className="bg-[#0284C7] hover:bg-[#0369A1] dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-white dark:text-purple-200 border border-[#0284C7] dark:border-purple-400/40 shadow-sm dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-all cursor-pointer"
                      title="View Deployed Stores Directory"
                    >
                      <Store className="w-4 h-4" />
                      <span>Deployed Stores ({stores.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(true)}
                      className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 dark:from-purple-600 dark:to-indigo-600 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Store</span>
                    </button>
                  </div>
                </motion.div>

                {/* Filter and Search Bar (Aligned with Product Route) */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                  className="app-card p-4 flex flex-wrap items-center gap-3 text-xs transition-colors dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 dark:border-purple-800/80 dark:text-white"
                >
                  <div className="flex-1 min-w-[240px] relative">
                    <Search className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search requests by store name or owner email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="app-input w-full pl-[2.125rem] pr-8 py-2.5 text-xs font-medium dark:bg-slate-900/80 dark:border-purple-800/60 dark:text-white dark:placeholder-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 p-1 text-xs cursor-pointer"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((reqOpt) => (
                      <button
                        key={reqOpt}
                        type="button"
                        onClick={() => setRequestStatusFilter(reqOpt)}
                        className={`px-3.5 py-2.5 rounded-xl font-bold border transition cursor-pointer text-xs ${
                          requestStatusFilter === reqOpt
                            ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border-purple-400/50 shadow-md shadow-purple-600/20 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)]'
                            : 'bg-slate-50 dark:bg-purple-500/20 text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white'
                        }`}
                      >
                        {reqOpt}
                      </button>
                    ))}
                  </div>

                  <span className="font-mono font-bold px-3.5 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs">
                    {pendingRequestsCount} Pending
                  </span>

                  <button
                    type="button"
                    onClick={loadOverview}
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold rounded-xl transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                    title={loading ? 'Refreshing store requests...' : 'Refresh request queue'}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        loading ? 'animate-spin text-blue-600 dark:text-purple-300' : 'text-blue-600 dark:text-purple-300'
                      }`}
                    />
                    <span>Refresh</span>
                  </button>
                </motion.div>

                {/* Store Requests Table (Aligned with Product Route Table, Thead & Tbody) */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.3 }}
                  className="app-card overflow-hidden transition-colors dark:border-purple-800/60"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-700 dark:text-white font-bold border-b border-slate-200 dark:border-purple-800/80 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4 w-14">Store</th>
                          <th className="py-3.5 px-4">Requested Store &amp; Type</th>
                          <th className="py-3.5 px-3">Contact Details &amp; Notes</th>
                          <th className="py-3.5 px-4">Subscription Plan</th>
                          <th className="py-3.5 px-3 text-center">Status</th>
                          <th className="py-3.5 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {loading ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                                <p className="font-medium text-xs">Loading store requests...</p>
                              </div>
                            </td>
                          </tr>
                        ) : filteredRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400">
                              No store requests match the selected filter.
                            </td>
                          </tr>
                        ) : (
                          filteredRequests.map((reqItem) => {
                            const isPending = reqItem.status === 'PENDING';
                            const isRejected = reqItem.status === 'REJECTED';
                            const isRenewal = (reqItem as any).request_type === 'RENEWAL';

                            return (
                              <tr
                                key={reqItem.id}
                                className="table-row-hover border-b border-slate-100 dark:border-slate-800/80"
                              >
                                {/* Store Avatar Box (Aligned with Product Image cell) */}
                                <td className="py-3.5 px-4">
                                  <div className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#0A0E1A] overflow-hidden flex items-center justify-center shrink-0 p-1 shadow-2xs">
                                    <div className="w-full h-full rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-2xs">
                                      {(reqItem.storeName || (reqItem as any).store_name || 'SR').slice(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                </td>

                                {/* Requested Store & Type */}
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                                    {reqItem.storeName || (reqItem as any).store_name}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 dark:bg-[#312E81]/60 text-indigo-700 dark:text-[#A5B4FC] border border-indigo-200 dark:border-[#6366F1]/40 font-mono">
                                      REQ #{reqItem.id}
                                    </span>
                                    {isRenewal ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40">
                                        Renewal
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-sky-50 dark:bg-[#0284C7]/20 text-sky-700 dark:text-[#38BDF8] border border-sky-200 dark:border-[#0284C7]/40">
                                        New Store
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Contact Details & Notes */}
                                <td className="py-3.5 px-3">
                                  <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-white">
                                    {reqItem.ownerEmail || (reqItem as any).owner_email}
                                  </div>
                                  {(reqItem.ownerPhone || (reqItem as any).owner_phone) && (
                                    <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                      {reqItem.ownerPhone || (reqItem as any).owner_phone}
                                    </div>
                                  )}
                                  {(reqItem as any).notes && (
                                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                                      &ldquo;{(reqItem as any).notes}&rdquo;
                                    </div>
                                  )}
                                </td>

                                {/* Subscription Plan Capsule */}
                                <td className="py-3.5 px-4">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-50 dark:bg-[#1E3A8A]/50 text-blue-800 dark:text-[#93C5FD] border border-blue-200 dark:border-[#3B82F6]/40 font-mono">
                                    {reqItem.plan}
                                  </span>
                                </td>

                                {/* Status Pill */}
                                <td className="py-3.5 px-3 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                                      reqItem.status === 'PENDING'
                                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                                        : reqItem.status === 'APPROVED'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        reqItem.status === 'PENDING'
                                          ? 'bg-amber-500'
                                          : reqItem.status === 'APPROVED'
                                          ? 'bg-emerald-500'
                                          : 'bg-rose-500'
                                      }`}
                                    />
                                    {reqItem.status}
                                  </span>
                                </td>

                                {/* Actions (Aligned with Product Route Action Buttons) */}
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex items-center justify-center flex-wrap gap-1.5">
                                    {isPending && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={approvingId === reqItem.id}
                                          onClick={() => handleApproveRequest(reqItem)}
                                          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 disabled:opacity-50 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-2xs dark:shadow-[0_0_12px_rgba(147,51,234,0.25)] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>
                                            {approvingId === reqItem.id
                                              ? 'Processing...'
                                              : isRenewal
                                              ? 'Approve & Extend'
                                              : 'Approve & Provision'}
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          disabled={updatingRequestId === reqItem.id}
                                          onClick={() => handleRejectRequest(reqItem)}
                                          className="px-2 py-1.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-[#0E1628] text-amber-700 dark:text-amber-400 hover:bg-amber-600 dark:hover:bg-amber-600 hover:text-white dark:hover:text-white transition-all shadow-2xs group relative cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />
                                          <span>Reject</span>
                                        </button>
                                      </>
                                    )}

                                    {isRejected && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={approvingId === reqItem.id}
                                          onClick={() => handleApproveRequest(reqItem)}
                                          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 disabled:opacity-50 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-2xs dark:shadow-[0_0_12px_rgba(147,51,234,0.25)] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>Approve Anyway</span>
                                        </button>

                                        <button
                                          type="button"
                                          disabled={updatingRequestId === reqItem.id}
                                          onClick={() => handleReopenRequest(reqItem)}
                                          className="px-2 py-1.5 rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-[#0E1628] text-purple-700 dark:text-purple-400 hover:bg-purple-600 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white transition-all shadow-2xs group relative cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                                          title="Reopen request as PENDING"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          <span>Reopen</span>
                                        </button>
                                      </>
                                    )}

                                    {reqItem.status === 'APPROVED' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (reqItem.provisioned_tenant_id) {
                                            onOpenStore(reqItem.provisioned_tenant_id);
                                          }
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-[#0E1628] text-purple-700 dark:text-purple-400 hover:bg-purple-600 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white transition-all shadow-2xs group relative cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                                      >
                                        <Store className="w-3.5 h-3.5" />
                                        <span>Open Store</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      disabled={deletingRequestId === reqItem.id}
                                      onClick={() => handleDeleteRequest(reqItem)}
                                      className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-[#0E1628] hover:bg-rose-600 dark:hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white transition-all cursor-pointer disabled:opacity-50"
                                      title="Delete Store Request"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </div>
            )}

            {/* SECTION 3: DEDICATED REPORTS & ANALYTICS VIEW (ALIGNED WITH STORE REPORTS DASHBOARD) */}
            {activeTab === 'reports' && (
              <SuperAdminReportsView
                stores={stores}
                storeRequests={storeRequests}
                reportSkus={reportSkus}
                reportCategories={reportCategories}
                reportBrands={reportBrands}
                recentTransactions={recentTransactions}
                loading={loading}
                onRefresh={loadOverview}
                onOpenStore={onOpenStore}
              />
            )}

            {/* SECTION 4: SCOPED PWA MANIFEST REGISTRY VIEW */}
            {activeTab === 'manifests' && (
              <div className="app-card bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-indigo-500/20 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-indigo-500/20 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Multi-PWA Scoped Manifest Registry</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Each tenant store and the SuperAdmin Control Panel has an isolated Web App Manifest and scope.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 text-xs font-mono font-bold">
                    <Globe className="w-3.5 h-3.5" />
                    <span>SuperAdmin PWA</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stores.map((st) => (
                    <div
                      key={st.id}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#131B2E] border border-slate-200/80 dark:border-indigo-500/20 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ backgroundColor: st.themeColor || '#7C3AED' }}
                        >
                          {(st.name || 'ST').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {st.name} — POS
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-indigo-500/15 text-xs font-mono">
                        <span className="text-slate-500 dark:text-slate-400">
                          theme: {st.themeColor || '#7C3AED'}
                        </span>
                        <span className="text-purple-600 dark:text-purple-300 font-bold">
                          Active PWA
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* FOOTER (Aligned with Store Page Footer) */}
        <footer className="px-4 py-2.5 border-t border-indigo-500/20 bg-white/95 dark:bg-white/5 backdrop-blur-lg shadow-lg transition-colors duration-500 text-center text-xs font-medium text-slate-800 dark:text-slate-100 tracking-wide shrink-0 no-print select-none">
          Designed &amp; Developed by{' '}
          <a
            href="https://portpolio-eight-pi.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-slate-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline transition-colors"
          >
            SarbaazSoft
          </a>{' '}
          © 2026 • Platform SuperAdmin Control Plane
        </footer>
      </div>

      {/* Add New Store Modal (Aligned with ProductFormModal Header, Cards & Footer) */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 dark:border-purple-800/80 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER ALIGNED WITH PRODUCT FORM MODAL */}
            <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white px-6 py-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-purple-500/20 dark:text-purple-300 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-2xs shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                      Add New Store
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-purple-200/80">
                      Provision a new Store Tenant entity &amp; primary Owner Administrator account
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* MODAL CARD BODY ALIGNED WITH PRODUCT FORM MODAL */}
            <form
              id="add-new-store-form"
              onSubmit={handleCreateStore}
              className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-slate-50/50 dark:bg-[#070B14]"
            >
              {createStoreError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="alert-danger flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200 animate-in fade-in"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <span>{createStoreError}</span>
                </div>
              )}

              {/* CARD 1: STORE & OWNER IDENTITY */}
              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                  <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>1. Store &amp; Owner Identity</span>
                  </h5>
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                    Tenant Profile
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Store Name */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                      Store Name <span className="text-red-500 dark:text-pink-400">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(toTitleCaseLive(e.target.value))}
                        placeholder="e.g. Apex Footwear"
                        className="capitalize w-full pl-9 pr-3 py-2.5 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-medium text-gray-900 dark:text-purple-100 placeholder-slate-400 dark:placeholder-purple-300/40 hover:bg-slate-50 dark:hover:bg-purple-500/30 outline-none focus:border-indigo-600 dark:focus:border-purple-400 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Owner Name */}
                  <div>
                    <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                      Owner Full Name <span className="text-red-500 dark:text-pink-400">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={newOwnerName}
                        onChange={(e) => setNewOwnerName(toTitleCaseLive(e.target.value))}
                        placeholder="Enter owner name"
                        className="capitalize w-full pl-9 pr-3 py-2.5 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-medium text-gray-900 dark:text-purple-100 placeholder-slate-400 dark:placeholder-purple-300/40 hover:bg-slate-50 dark:hover:bg-purple-500/30 outline-none focus:border-indigo-600 dark:focus:border-purple-400 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Owner Email */}
                  <div>
                    <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                      Owner Login Email <span className="text-red-500 dark:text-pink-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={newOwnerEmail}
                        onChange={(e) => setNewOwnerEmail(e.target.value)}
                        placeholder="owner@apexfootwear.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-medium font-mono text-gray-900 dark:text-purple-100 placeholder-slate-400 dark:placeholder-purple-300/40 hover:bg-slate-50 dark:hover:bg-purple-500/30 outline-none focus:border-indigo-600 dark:focus:border-purple-400 transition shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: OWNER SECURITY CREDENTIALS */}
              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                  <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>2. Owner Security &amp; Credentials</span>
                  </h5>
                  <span className="text-[10px] text-purple-600 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                    Min 4 Characters
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Password */}
                  <div>
                    <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                      Password <span className="text-red-500 dark:text-pink-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showNewOwnerPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={newOwnerPassword}
                        onChange={(e) => setNewOwnerPassword(e.target.value)}
                        placeholder="Set initial Owner password"
                        className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-medium font-mono text-gray-900 dark:text-purple-100 placeholder-slate-400 dark:placeholder-purple-300/40 hover:bg-slate-50 dark:hover:bg-purple-500/30 outline-none focus:border-indigo-600 dark:focus:border-purple-400 transition shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewOwnerPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        title={showNewOwnerPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewOwnerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                      Confirm Password <span className="text-red-500 dark:text-pink-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showNewOwnerPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={newOwnerConfirmPassword}
                        onChange={(e) => setNewOwnerConfirmPassword(e.target.value)}
                        placeholder="Enter the password again"
                        autoComplete="new-password"
                        className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-medium font-mono text-gray-900 dark:text-purple-100 placeholder-slate-400 dark:placeholder-purple-300/40 hover:bg-slate-50 dark:hover:bg-purple-500/30 outline-none focus:border-indigo-600 dark:focus:border-purple-400 transition shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Password Match Indicator */}
                {newOwnerPassword && newOwnerConfirmPassword && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                      newOwnerPassword === newOwnerConfirmPassword
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                    }`}
                  >
                    {newOwnerPassword === newOwnerConfirmPassword ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Passwords match securely.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Passwords do not match yet.</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* CARD 3: SUBSCRIPTION PLAN & TENANT PROVISIONING */}
              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                  <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>3. Subscription Plan &amp; License Key</span>
                  </h5>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    Active on Creation
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                    Subscription Plan <span className="text-red-500 dark:text-pink-400">*</span>
                  </label>
                  <select
                    value={newSubscriptionPlan}
                    onChange={(e) => setNewSubscriptionPlan(e.target.value as '6_MONTHS' | 'YEARLY')}
                    className="capitalize w-full px-3.5 py-2.5 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-semibold text-gray-900 dark:text-purple-100 hover:bg-slate-50 dark:hover:bg-purple-500/30 outline-none focus:border-indigo-600 dark:focus:border-purple-400 cursor-pointer transition"
                  >
                    <option value="6_MONTHS" className="bg-white text-gray-900 dark:bg-[#120726] dark:text-purple-100">
                      6 Months Plan
                    </option>
                    <option value="YEARLY" className="bg-white text-gray-900 dark:bg-[#120726] dark:text-purple-100">
                      Yearly Plan (1 Year)
                    </option>
                  </select>

                  <div className="mt-3 p-3 rounded-xl bg-indigo-50/70 dark:bg-gradient-to-br dark:from-slate-900 dark:via-indigo-950 dark:to-purple-950 border border-indigo-200/80 dark:border-indigo-600/40 text-[11px] font-mono text-slate-700 dark:text-purple-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      Plan: <strong className="text-indigo-950 dark:text-white">{newSubscriptionPlan === '6_MONTHS' ? '6 Months' : 'Yearly'}</strong>
                    </span>
                    <span>
                      Expires:{' '}
                      <strong className="text-indigo-950 dark:text-white">
                        {(() => {
                          const d = new Date();
                          if (newSubscriptionPlan === '6_MONTHS') {
                            d.setMonth(d.getMonth() + 6);
                          } else {
                            d.setFullYear(d.getFullYear() + 1);
                          }
                          return d.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          });
                        })()}
                      </strong>
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                  Store defaults (invoices, barcodes, address &amp; taxes) are configured by the Store Owner on first login.
                </p>
              </div>
            </form>

            {/* MODAL FOOTER ALIGNED WITH PRODUCT FORM MODAL */}
            <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-gray-200 dark:border-purple-800/80 px-6 py-4 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="btn-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                form="add-new-store-form"
                disabled={creatingStore}
                style={{ color: '#ffffff' }}
                className="btn-primary btn-pure-white px-6 py-2.5 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {creatingStore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                    <span className="!text-white text-white font-bold" style={{ color: '#ffffff' }}>
                      Creating Store...
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                    <span className="!text-white text-white font-bold" style={{ color: '#ffffff' }}>
                      Create Store &amp; Owner
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Store Subscription Modal */}
      {storeToEditSub && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="app-card bg-white dark:bg-[#111827] border border-slate-200 dark:border-purple-800/70 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Store Subscription
                  </h3>
                  <p className="text-xs font-mono text-purple-600 dark:text-purple-300">
                    {storeToEditSub.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStoreToEditSub(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4 mt-4">
              {/* Subscription Plan Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subscription Plan
                </label>
                <select
                  value={editSubPlan}
                  onChange={(e) => {
                    const nextPlan = e.target.value as '6_MONTHS' | 'YEARLY';
                    setEditSubPlan(nextPlan);
                    const d = new Date();
                    if (nextPlan === '6_MONTHS') {
                      d.setMonth(d.getMonth() + 6);
                    } else {
                      d.setFullYear(d.getFullYear() + 1);
                    }
                    setEditSubEndDate(d.toISOString().slice(0, 10));
                    setEditSubStatus('ACTIVE');
                  }}
                  className="app-input capitalize w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-purple-800/60 text-slate-900 dark:text-white text-sm font-semibold outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="6_MONTHS">6 Months</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>

              {/* Manual Expiry Date & Quick Renewal Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Subscription Expiry Date
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + 6);
                        setEditSubPlan('6_MONTHS');
                        setEditSubEndDate(d.toISOString().slice(0, 10));
                        setEditSubStatus('ACTIVE');
                      }}
                      className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      +6 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 1);
                        setEditSubPlan('YEARLY');
                        setEditSubEndDate(d.toISOString().slice(0, 10));
                        setEditSubStatus('ACTIVE');
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      +1 Year
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={editSubEndDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditSubEndDate(val);
                    if (val) {
                      const chosen = new Date(`${val}T23:59:59.999Z`);
                      if (chosen.getTime() < Date.now()) {
                        setEditSubStatus('EXPIRED');
                      } else if (editSubStatus === 'EXPIRED') {
                        setEditSubStatus('ACTIVE');
                      }
                    }
                  }}
                  className="app-input w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-purple-800/60 text-slate-900 dark:text-white text-sm font-mono outline-none focus:border-purple-600"
                />
              </div>

              {/* Subscription Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subscription Status
                </label>
                <select
                  value={editSubStatus}
                  onChange={(e) =>
                    setEditSubStatus(e.target.value as 'ACTIVE' | 'EXPIRED' | 'SUSPENDED')
                  }
                  className="app-input capitalize w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-purple-800/60 text-slate-900 dark:text-white text-sm font-semibold outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStoreToEditSub(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSub}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingSub ? 'Saving...' : 'Save Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Store Modal */}
      {storeToDelete && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="app-card bg-white dark:bg-[#111827] border border-rose-200 dark:border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Delete Store Tenant?
                  </h3>
                  <div className="text-xs font-mono text-rose-600 dark:text-rose-300">
                    {storeToDelete.name} (ID #{storeToDelete.id})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStoreToDelete(null);
                  setError(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              You are about to permanently delete <strong>{storeToDelete.name}</strong> and all of its isolated records ({storeToDelete.productCount} products, {storeToDelete.salesCount} sales invoices, staff accounts, and settings). You can export an SQL backup before deleting.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleExportStoreSql(storeToDelete)}
                disabled={exportingStoreId === storeToDelete.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exportingStoreId === storeToDelete.id ? 'Exporting...' : 'Export SQL First'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStoreToDelete(null);
                    setError(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingStore}
                  onClick={handleConfirmDeleteStore}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingStore ? 'Deleting...' : 'Delete Permanently'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SuperAdmin Platform SQL Import Modal */}
      {importSqlModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
          onClick={() => !importingPlatformSql && setImportSqlModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-purple-800/80 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 border border-purple-500/25 dark:border-purple-400/40 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                    SuperAdmin Platform SQL Import &amp; Multi-Store Seed
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-purple-200/80">
                    Upload a PostgreSQL <code className="font-mono">.sql</code> dump or 1-click import the 24-store, 2,400-SKU dataset
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={importingPlatformSql}
                onClick={() => setImportSqlModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs bg-slate-50/50 dark:bg-[#070B14]">
              {importSqlError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 flex items-start gap-2.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{importSqlError}</span>
                </div>
              )}

              {/* Quick Actions Bar: Upload .SQL, 1-Click Load & Import 24-Store SQL, Download Sample .SQL */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-indigo-500/25 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      Multi-Store SQL Dataset (<code className="font-mono text-purple-600 dark:text-purple-300">/multi-store-pos-import.sql</code>)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Includes 24 stores, company settings, 2,400 store-scoped SKUs, 240 purchases, purchase returns, 240 customers &amp; 480 sales.
                    </p>
                  </div>
                  <a
                    href="/multi-store-pos-import.sql"
                    download="multi-store-pos-import.sql"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .SQL File</span>
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    ref={sqlFileInputRef}
                    type="file"
                    accept=".sql,text/plain"
                    onChange={handleSqlFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => sqlFileInputRef.current?.click()}
                    disabled={importingPlatformSql || loadingSampleSql}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-bold text-xs cursor-pointer transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose .SQL File from Computer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadMultiStoreSampleSql(false)}
                    disabled={importingPlatformSql || loadingSampleSql}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-bold text-xs cursor-pointer transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{loadingSampleSql ? 'Loading SQL...' : 'Load 24-Store SQL into Editor'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadMultiStoreSampleSql(true)}
                    disabled={importingPlatformSql || loadingSampleSql}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm cursor-pointer transition disabled:opacity-50"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>
                      {importingPlatformSql
                        ? 'Importing 24 Stores & 2,400 SKUs...'
                        : '1-Click Import 24-Store Dataset Now'}
                    </span>
                  </button>
                </div>
              </div>

              {/* SQL Script Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                    SQL Statements {sqlFileName ? `— ${sqlFileName}` : ''}
                  </label>
                  {sqlImportText && (
                    <button
                      type="button"
                      onClick={() => {
                        setSqlImportText('');
                        setSqlFileName(null);
                      }}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear Editor
                    </button>
                  )}
                </div>
                <textarea
                  rows={10}
                  value={sqlImportText}
                  onChange={(e) => setSqlImportText(e.target.value)}
                  placeholder="-- Paste PostgreSQL INSERT / UPDATE / CREATE statements here, or click 'Load 24-Store SQL into Editor' above..."
                  className="w-full p-3.5 rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-indigo-500/30 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 px-6 py-4 flex items-center justify-between shrink-0">
              <button
                type="button"
                disabled={importingPlatformSql}
                onClick={() => setImportSqlModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={importingPlatformSql || !sqlImportText.trim()}
                onClick={() => handleExecutePlatformSqlImport()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {importingPlatformSql ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing SQL Import...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Execute &amp; Import SQL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Top-Right Toast Notification for Immediate Action Feedback */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            className="fixed top-16 right-4 z-50 max-w-md bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center gap-3 text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="p-1 rounded-lg hover:bg-white/20 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
