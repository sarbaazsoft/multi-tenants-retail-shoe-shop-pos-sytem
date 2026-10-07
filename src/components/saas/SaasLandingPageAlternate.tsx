import React, { useEffect, useState } from 'react';
import {
  AlertCircle, ArrowRight, BarChart3, Building2, Check, CheckCircle2, Loader2, Mail, Package,
  Phone, Printer, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, Users, X,
} from 'lucide-react';
import { api } from '../../services/api';
import { toLowerTrimmed, toTitleCaseLive, toTitleCaseTrimmed } from '../../utils/textFormat';
import type { TenantInfo } from '../../types';
import shoeStoreBg from '../../assets/images/shoe_store_blurred_bg_1790706924465.jpg';
import posShowcase from '../../assets/images/pos-showcase.svg';

interface Props {
  availableTenants: TenantInfo[];
  onGlobalLogin: () => void;
  onOpenSuperAdmin: () => void;
}

const features = [
  { title: 'POS & Sales Operations', desc: 'Fast billing, offline support, barcode scanning, returns and exchanges.', icon: ShoppingCart, color: 'blue' },
  { title: 'Inventory Management', desc: 'Set prices, check stock levels and record changes to your products.', icon: Package, color: 'green' },
  { title: 'Purchases & Suppliers', desc: 'Supplier khata, purchase orders and supplier returns.', icon: Truck, color: 'red' },
  { title: 'Hardware & Printing', desc: 'Thermal receipts, barcode labels and direct hardware control.', icon: Printer, color: 'purple' },
  { title: 'Customers & Returns', desc: 'Customer profiles, sales returns and POS exchanges.', icon: Users, color: 'green' },
  { title: 'Sales & Stock Reports', desc: 'Sales, profit, inventory valuation and low-stock alerts.', icon: BarChart3, color: 'amber' },
  { title: 'Security & User Management', desc: 'Role-based access, secure accounts and automated backups.', icon: ShieldCheck, color: 'blue' },
  { title: 'Store Settings & Branding', desc: 'Set up your shop, customize receipts and manage your team.', icon: Store, color: 'slate' },
  { title: 'AI Store Assistant', desc: 'Get help with store operations and POS questions, plus AI suggestions when adding products.', icon: Sparkles, color: 'purple' },
] as const;

const featureTone: Record<string, string> = {
  blue: 'bg-[#EBF3FF] text-[#0066FF]', green: 'bg-[#E6F8EF] text-[#10B981]',
  red: 'bg-[#FFEBEB] text-[#EF4444]', purple: 'bg-[#F3E8FF] text-[#8B5CF6]',
  amber: 'bg-[#FFF4E5] text-[#F59E0B]', slate: 'bg-[#F1F5F9] text-[#475569]',
};

export const SaasLandingPageAlternate: React.FC<Props> = ({ availableTenants, onGlobalLogin, onOpenSuperAdmin }) => {
  const [requestOpen, setRequestOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [plan, setPlan] = useState('1_YEAR_RS_18000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Real-time validation & email availability states
  const [storeNameTouched, setStoreNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [emailCheckMessage, setEmailCheckMessage] = useState('');

  const trimmedStoreName = storeName.trim();
  const isStoreNameLengthValid = trimmedStoreName.length >= 2 && trimmedStoreName.length <= 80;
  const isStoreNameFormatValid = /^[a-zA-Z0-9\s&'.,\-()]+$/.test(trimmedStoreName);
  const isStoreNameDuplicate = availableTenants.some(
    (t) => t.name.trim().toLowerCase() === trimmedStoreName.toLowerCase()
  );
  const storeNameError = !trimmedStoreName
    ? 'Store name is required.'
    : !isStoreNameLengthValid
    ? 'Store name must be between 2 and 80 characters.'
    : !isStoreNameFormatValid
    ? 'Store name contains invalid special characters.'
    : isStoreNameDuplicate
    ? 'A store with this name already exists.'
    : '';
  const isStoreNameValid = !storeNameError;

  const trimmedOwnerEmail = toLowerTrimmed(ownerEmail);
  const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedOwnerEmail);
  const emailError = !trimmedOwnerEmail
    ? 'Owner email is required.'
    : !isEmailFormatValid
    ? 'Please enter a valid email address (e.g. owner@store.com).'
    : emailCheckStatus === 'taken' || emailCheckStatus === 'invalid'
    ? emailCheckMessage || 'This email is already registered.'
    : '';
  const isEmailValid =
    Boolean(trimmedOwnerEmail) &&
    isEmailFormatValid &&
    emailCheckStatus === 'available';

  const trimmedOwnerPhone = ownerPhone.trim();
  const phoneDigits = trimmedOwnerPhone.replace(/\D/g, '');
  const isPhoneCharsValid = /^[+]?[0-9\s\-()]+$/.test(trimmedOwnerPhone);
  const isPhoneDigitsValid = phoneDigits.length >= 10 && phoneDigits.length <= 15;
  const phoneError = !trimmedOwnerPhone
    ? 'Phone / WhatsApp number is required.'
    : !isPhoneCharsValid
    ? 'Phone number can only contain digits, spaces, +, -, and ().'
    : !isPhoneDigitsValid
    ? 'Enter a valid 10 to 15 digit phone number (e.g. +92 300 1234567).'
    : '';
  const isPhoneValid = !phoneError;

  const isStoreRequestFormValid =
    isStoreNameValid &&
    isEmailValid &&
    isPhoneValid &&
    emailCheckStatus !== 'checking';

  useEffect(() => {
    if (!requestOpen) return;
    if (!trimmedOwnerEmail) {
      setEmailCheckStatus('idle');
      setEmailCheckMessage('');
      return;
    }
    if (!isEmailFormatValid) {
      setEmailCheckStatus('invalid');
      setEmailCheckMessage('Please enter a valid email address format.');
      return;
    }

    let cancelled = false;
    setEmailCheckStatus('checking');
    setEmailCheckMessage('Checking email availability...');

    const timer = window.setTimeout(async () => {
      try {
        const res = await api.saas.checkEmailAvailability(trimmedOwnerEmail);
        if (cancelled) return;
        if (res.available) {
          setEmailCheckStatus('available');
          setEmailCheckMessage(res.message || 'Email is available.');
        } else {
          setEmailCheckStatus('taken');
          setEmailCheckMessage(res.message || 'This email is already registered.');
        }
      } catch (err: any) {
        if (cancelled) return;
        setEmailCheckStatus('taken');
        setEmailCheckMessage(err?.message || 'Unable to verify email availability.');
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedOwnerEmail, isEmailFormatValid, requestOpen]);

  const openPlan = (value: string) => {
    setPlan(value);
    setError('');
    setSuccess('');
    setStoreNameTouched(false);
    setEmailTouched(false);
    setPhoneTouched(false);
    setRequestOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStoreNameTouched(true);
    setEmailTouched(true);
    setPhoneTouched(true);
    if (!isStoreRequestFormValid) {
      setError(storeNameError || emailError || phoneError || 'Please complete all fields with valid details.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.saas.submitStoreRequest({
        storeName: toTitleCaseTrimmed(storeName), ownerEmail: toLowerTrimmed(ownerEmail),
        ownerPhone: ownerPhone.trim(), plan,
      });
      setSuccess(result.message);
      setStoreName(''); setOwnerEmail(''); setOwnerPhone('');
      setStoreNameTouched(false); setEmailTouched(false); setPhoneTouched(false);
      setEmailCheckStatus('idle'); setEmailCheckMessage('');
    } catch (err: any) {
      if (err?.code === 'EMAIL_ALREADY_EXISTS' || err?.code === 'REQUEST_ALREADY_PENDING') {
        setEmailCheckStatus('taken');
        setEmailCheckMessage(err.message || 'This email is already registered.');
      }
      setError(err.message || 'Failed to submit store request.');
    } finally {
      setBusy(false);
    }
  };

  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <main className="min-h-screen bg-white text-[#0A1633] font-sans selection:bg-[#0066FF] selection:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_3px_rgba(15,23,42,0.03)] backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex shrink-0 items-center gap-3" aria-label="ShoePOS home">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0066FF] text-white"><Store className="h-6 w-6" /></span>
            <span><span className="block text-2xl font-extrabold leading-none"><span>Shoe</span><span className="text-[#0066FF]">POS</span></span><span className="mt-1 block text-[11px] font-medium text-slate-500">Retail Shoe Shop System</span></span>
          </a>
          <nav className="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="Main navigation">
            {[['Home', 'top'], ['Features', 'features'], ['Stores', 'stores'], ['Pricing', 'pricing'], ['About', 'about']].map(([label, id]) => <button key={id} onClick={() => goTo(id)} className="rounded-lg px-3 py-2 text-slate-600 transition hover:text-[#0066FF]">{label}</button>)}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={onGlobalLogin} className="hidden rounded-lg border border-[#0066FF]/30 px-4 py-2 text-sm font-bold text-[#0066FF] transition hover:bg-[#EBF3FF] sm:inline-flex">Login</button>
            <a href="/" className="hidden xl:inline-flex rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition hover:text-[#0066FF]">Original layout</a><button onClick={() => openPlan('1_YEAR_RS_18000')} className="inline-flex items-center gap-2 rounded-xl bg-[#0066FF] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-[#0052CC]">Get Started <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <section id="top" className="relative isolate overflow-hidden bg-[#07162E]">
        <img src={shoeStoreBg} alt="Shoe retail store interior" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07162E]/95 via-[#07162E]/80 to-[#07162E]/35" />
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-16">
          <div className="space-y-5 text-white lg:col-span-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-200">A simpler way to run your shoe shop</p>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">Built for Shoe Retailers<span className="mt-2 block text-blue-300">Sell · Manage · Grow</span></h1>
            <p className="max-w-lg text-base leading-relaxed text-white/90">Keep sales, stock, suppliers and your team in one place. Serve customers faster, see what is selling and stay on top of your shop — even when the internet drops.</p>
            <div className="flex flex-wrap gap-3 pt-1"><button onClick={() => openPlan('1_YEAR_RS_18000')} className="inline-flex items-center gap-2 rounded-xl bg-[#0066FF] px-6 py-3 font-bold text-white shadow-lg transition hover:bg-[#0052CC]">Get Started <ArrowRight className="h-4 w-4" /></button><button onClick={() => goTo('features')} className="rounded-xl border border-white/70 px-6 py-3 font-bold text-white transition hover:bg-white/10">Explore Features</button></div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/25 pt-5 sm:grid-cols-4">
              {[['Works Offline', 'Sales continue on your devices'], ['Your whole team', 'Owners and cashiers'], ['Secure & Reliable', 'Your data, always safe'], ['Easy to Use', 'For retail teams']].map(([title, desc]) => <div key={title} className="min-w-0"><p className="text-xs font-bold text-white">{title}</p><p className="mt-1 text-[10px] leading-snug text-white/70">{desc}</p></div>)}
            </div>
          </div>
          <div className="lg:col-span-7"><img src={posShowcase} alt="ShoePOS point-of-sale interface" className="mx-auto block w-full drop-shadow-[0_25px_45px_rgba(10,22,51,0.35)]" /></div>
        </div>
      </section>

      <section id="stores" className="border-b border-slate-100 bg-white py-9 sm:py-11">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-4"><span className="h-px flex-1 bg-slate-200" /><h2 className="text-center text-lg font-extrabold sm:text-xl">Stores on ShoePOS</h2><span className="h-px flex-1 bg-slate-200" /></div>
          {availableTenants.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{availableTenants.slice(0, 12).map((tenant) => <div key={tenant.id} className="flex h-[76px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-center shadow-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#EBF3FF] text-sm font-extrabold text-[#0066FF]">{tenant.logoUrl && !tenant.logoUrl.endsWith('/pwa-512x512.png') ? <img src={tenant.logoUrl} alt="" className="h-full w-full object-contain" /> : tenant.name.trim().charAt(0).toUpperCase()}</span><span className="truncate text-xs font-bold text-slate-700">{tenant.name}</span></div>)}</div> : <p className="text-center text-sm text-slate-500">Explore the features that help shoe retailers manage their stores.</p>}
        </div>
      </section>

      <section id="features" className="bg-[#F3F7FF] py-14 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-9 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-4"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0066FF]">Key features</p><h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Everything you need in one app</h2><p className="mt-4 max-w-md leading-relaxed text-slate-600">Keep sales, stock, suppliers and store operations together in ShoePOS.</p><button onClick={() => goTo('pricing')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0066FF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0052CC]">View Plans <ArrowRight className="h-4 w-4" /></button></div>
          <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">{features.map(({ title, desc, icon: Icon, color }) => <article key={title}><div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${featureTone[color]}`}><Icon className="h-6 w-6" /></div><h3 className="text-sm font-extrabold">{title}</h3><p className="mt-1.5 text-xs leading-relaxed text-slate-600">{desc}</p></article>)}</div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative flex min-h-[260px] items-end overflow-hidden rounded-2xl bg-[#07162E] p-7 text-white sm:p-9"><img src={shoeStoreBg} alt="Shoe store shelves" className="absolute inset-0 h-full w-full object-cover opacity-55" /><div className="absolute inset-0 bg-gradient-to-r from-[#07162E]/90 to-[#07162E]/20" /><div className="relative max-w-md"><h2 className="text-2xl font-extrabold sm:text-3xl">Run your store from one place</h2><p className="mt-3 text-sm leading-relaxed text-white/85">Manage POS sales, products, suppliers and customer records in the same app.</p><button onClick={() => goTo('features')} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#0066FF] transition hover:bg-blue-50">Explore Features <ArrowRight className="h-4 w-4" /></button></div></div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">{features.slice(0, 4).map(({ title, icon: Icon }, index) => <div key={title} className="flex min-h-28 flex-col justify-center rounded-2xl border border-slate-200 bg-[#F8FAFF] p-4 sm:p-5"><Icon className={`mb-3 h-6 w-6 ${index % 2 ? 'text-purple-600' : 'text-[#0066FF]'}`} /><span className="text-sm font-extrabold">{title}</span></div>)}</div>
        </div>
      </section>

      <section id="pricing" className="bg-[#F3F7FF] py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-8"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0066FF]">Pricing</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">Choose the plan that fits your store</h2><p className="mt-2 text-sm text-slate-600">Simple and transparent pricing. No hidden fees. Cancel anytime.</p></div>
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
            {[{ title: '6 Months Subscription', price: 'Rs. 10,000', code: '6_MONTHS_RS_10000', note: 'Perfect for new stores or short-term needs.' }, { title: '1 Year Subscription', price: 'Rs. 18,000', code: '1_YEAR_RS_18000', note: 'Most Popular', popular: true }].map((item) => <article key={item.code} className={`relative rounded-2xl bg-white p-6 shadow-sm sm:p-8 ${item.popular ? 'border-2 border-purple-600 shadow-[0_12px_40px_rgba(147,51,234,0.12)]' : 'border border-slate-200'}`}>
              {item.popular && <span className="absolute -top-3 right-5 rounded-lg bg-purple-600 px-4 py-1 text-xs font-bold text-white shadow-sm">Most Popular</span>}
              <h3 className="text-lg font-extrabold">{item.title}</h3><p className="mt-2 text-3xl font-extrabold text-purple-700">{item.price}</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">{['Full access to all features', 'Multi-Role Staff Access', 'Built-in AI Assistant', 'Free updates & support', 'Secure data backup'].map((text) => <li key={text} className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{text}</span></li>)}</ul>
              <button onClick={() => openPlan(item.code)} className={`mt-7 w-full rounded-xl py-3 text-sm font-bold transition-all ${item.popular ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-purple-600/25 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800' : 'border border-purple-600 bg-white text-purple-700 hover:border-transparent hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:text-white hover:shadow-md hover:shadow-purple-600/25'}`}>Get Started</button><p className="mt-3 text-xs text-slate-500">{item.note}</p>
            </article>)}
          </div>
        </div>
      </section>

      <footer id="about" className="bg-[#0A1633] py-7 text-white"><div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">{[['Works Offline', 'Keep working when the internet drops.'], ['Secure & Reliable', 'Your data, always safe.'], ['Your whole team', 'Owners and cashiers in one place.'], ['Sales & Stock Reports', 'Sales, profit and low-stock alerts.']].map(([title, desc]) => <div key={title} className="flex items-center gap-3 border-white/15 sm:border-r sm:last:border-0"><ShieldCheck className="h-7 w-7 shrink-0 text-blue-300" /><div><h3 className="text-sm font-extrabold">{title}</h3><p className="mt-1 text-xs text-blue-100/75">{desc}</p></div></div>)}</div><p className="mx-auto mt-7 max-w-7xl border-t border-white/15 px-4 pt-5 text-xs text-blue-100/70 sm:px-6 lg:px-8">ShoePOS · Retail Shoe Shop System</p></footer>

      {requestOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
          onClick={() => setRequestOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
            className="relative w-full max-w-xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 dark:border-purple-800/80 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header aligned with ProductFormModal */}
            <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white px-6 py-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-purple-500/20 dark:text-purple-300 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-2xs shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 id="request-title" className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                      Register Your Shoe Store
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-purple-200/80">
                      Tell us about your shop and get started with sales and stock management
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setRequestOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {success ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-slate-50/50 dark:bg-[#070B14]">
                <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs space-y-3">
                  <p className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                    Store Request Submitted!
                  </p>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{success}</p>
                </div>
                <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-gray-200 dark:border-purple-800/80 -mx-6 -mb-6 px-6 py-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccess('');
                      setRequestOpen(false);
                    }}
                    className="btn-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestOpen(false);
                      onOpenSuperAdmin();
                    }}
                    style={{ color: '#ffffff' }}
                    className="btn-primary btn-pure-white px-5 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                  >
                    <span className="!text-white text-white font-bold" style={{ color: '#ffffff' }}>
                      Open SuperAdmin C-Panel to Approve
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <form
                  id="alt-landing-store-request-form"
                  onSubmit={submit}
                  className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-slate-50/50 dark:bg-[#070B14]"
                >
                  {error && (
                    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {error}
                    </p>
                  )}

                  {/* Card 1: Store & Contact Details */}
                  <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                      <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span>1. Store &amp; Contact Information</span>
                      </h5>
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">Shop Details</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                        Store Name <span className="text-red-500">*</span>
                        <span className="relative mt-1.5 block">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-600 dark:text-purple-400 pointer-events-none" />
                          <input
                            required
                            value={storeName}
                            onChange={(event) => {
                              setStoreName(toTitleCaseLive(event.target.value));
                              if (!storeNameTouched) setStoreNameTouched(true);
                            }}
                            onBlur={() => setStoreNameTouched(true)}
                            placeholder="e.g. Metro Footwear"
                            className={`capitalize w-full rounded-xl border bg-white dark:bg-purple-500/20 py-2.5 pl-9 pr-9 text-xs font-medium text-gray-900 dark:text-purple-100 focus:outline-none ${
                              storeNameTouched && storeNameError
                                ? 'border-rose-500 focus:border-rose-500'
                                : storeNameTouched && isStoreNameValid
                                ? 'border-emerald-500 focus:border-emerald-500'
                                : 'border-gray-300 dark:border-purple-400/40 focus:border-indigo-600'
                            }`}
                          />
                          {storeNameTouched && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              {isStoreNameValid ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-rose-500" />
                              )}
                            </span>
                          )}
                        </span>
                      </label>
                      {storeNameTouched && storeNameError ? (
                        <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{storeNameError}</span>
                        </p>
                      ) : storeNameTouched && isStoreNameValid ? (
                        <p className="mt-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Store name looks good</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                          Owner Email <span className="text-red-500">*</span>
                          <span className="relative mt-1.5 block">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-600 dark:text-purple-400 pointer-events-none" />
                            <input
                              required
                              type="email"
                              value={ownerEmail}
                              onChange={(event) => {
                                setOwnerEmail(toLowerTrimmed(event.target.value));
                                if (!emailTouched) setEmailTouched(true);
                              }}
                              onBlur={() => setEmailTouched(true)}
                              placeholder="owner@metroshoes.pk"
                              className={`w-full rounded-xl border bg-white dark:bg-purple-500/20 py-2.5 pl-9 pr-9 text-xs font-medium font-mono text-gray-900 dark:text-purple-100 focus:outline-none ${
                                emailTouched && (emailError || emailCheckStatus === 'taken' || emailCheckStatus === 'invalid')
                                  ? 'border-rose-500 focus:border-rose-500'
                                  : emailCheckStatus === 'available'
                                  ? 'border-emerald-500 focus:border-emerald-500'
                                  : 'border-gray-300 dark:border-purple-400/40 focus:border-indigo-600'
                              }`}
                            />
                            {trimmedOwnerEmail && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                {emailCheckStatus === 'checking' ? (
                                  <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                                ) : emailCheckStatus === 'available' ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-rose-500" />
                                )}
                              </span>
                            )}
                          </span>
                        </label>
                        {trimmedOwnerEmail ? (
                          emailCheckStatus === 'checking' ? (
                            <p className="mt-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                              <span>Checking email availability...</span>
                            </p>
                          ) : emailCheckStatus === 'available' ? (
                            <p className="mt-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>{emailCheckMessage || 'Email is available'}</span>
                            </p>
                          ) : (
                            <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>{emailError || emailCheckMessage}</span>
                            </p>
                          )
                        ) : emailTouched && emailError ? (
                          <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{emailError}</span>
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                          Phone / WhatsApp <span className="text-red-500">*</span>
                          <span className="relative mt-1.5 block">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-600 dark:text-purple-400 pointer-events-none" />
                            <input
                              required
                              type="tel"
                              value={ownerPhone}
                              onChange={(event) => {
                                const cleaned = event.target.value.replace(/[^0-9+\s\-()]/g, '');
                                setOwnerPhone(cleaned);
                                if (!phoneTouched) setPhoneTouched(true);
                              }}
                              onBlur={() => setPhoneTouched(true)}
                              placeholder="+92 300 1234567"
                              className={`w-full rounded-xl border bg-white dark:bg-purple-500/20 py-2.5 pl-9 pr-9 text-xs font-medium font-mono text-gray-900 dark:text-purple-100 focus:outline-none ${
                                phoneTouched && phoneError
                                  ? 'border-rose-500 focus:border-rose-500'
                                  : phoneTouched && isPhoneValid
                                  ? 'border-emerald-500 focus:border-emerald-500'
                                  : 'border-gray-300 dark:border-purple-400/40 focus:border-indigo-600'
                              }`}
                            />
                            {phoneTouched && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                {isPhoneValid ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-rose-500" />
                                )}
                              </span>
                            )}
                          </span>
                        </label>
                        {phoneTouched && phoneError ? (
                          <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{phoneError}</span>
                          </p>
                        ) : phoneTouched && isPhoneValid ? (
                          <p className="mt-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Valid phone number ({phoneDigits.length} digits)</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Subscription Plan */}
                  <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                      <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span>2. Subscription Plan</span>
                      </h5>
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        Full POS Access
                      </span>
                    </div>

                    <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                      Select Plan
                      <select
                        value={plan}
                        onChange={(event) => setPlan(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-gray-300 dark:border-purple-400/40 bg-white dark:bg-purple-500/20 px-3.5 py-2.5 text-xs font-semibold text-gray-900 dark:text-purple-100 focus:border-indigo-600 focus:outline-none cursor-pointer"
                      >
                        <option value="6_MONTHS_RS_10000">6 Months — Rs. 10,000</option>
                        <option value="1_YEAR_RS_18000">1 Year — Rs. 18,000 (Most Popular)</option>
                      </select>
                    </label>
                  </div>
                </form>

                {/* Footer aligned with ProductFormModal */}
                <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-gray-200 dark:border-purple-800/80 px-6 py-4 flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => setRequestOpen(false)}
                    className="btn-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="alt-landing-store-request-form"
                    disabled={busy || !isStoreRequestFormValid}
                    style={{ color: '#ffffff' }}
                    className="btn-primary btn-pure-white px-6 py-2.5 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="!text-white text-white font-bold" style={{ color: '#ffffff' }}>
                      {busy
                        ? 'Submitting Request...'
                        : emailCheckStatus === 'checking'
                        ? 'Checking Email...'
                        : 'Submit Store Request'}
                    </span>
                    <ArrowRight className="h-4 w-4 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
