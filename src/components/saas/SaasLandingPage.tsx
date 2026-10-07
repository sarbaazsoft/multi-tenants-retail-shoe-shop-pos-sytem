import React, { useEffect, useRef, useState } from 'react';
import {
  ShoppingCart,
  Package,
  Truck,
  Printer,
  Users,
  BarChart3,
  ShieldCheck,
  Settings,
  ArrowRight,
  Check,
  Calendar,
  WifiOff,
  Store,
  ThumbsUp,
  X,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { toTitleCaseLive, toTitleCaseTrimmed, toLowerTrimmed } from '../../utils/textFormat';
import type { TenantInfo } from '../../types';
import shoeStoreBg from '../../assets/images/shoe_store_blurred_bg_1790706924465.jpg';
import posShowcase from '../../assets/images/pos-showcase.svg';

interface PublicStats {
  stores: number;
  products: number;
  invoicesToday: number;
  platformRevenue: number;
}

const AnimatedCounter: React.FC<{
  target: number;
  startTime: number | null;
  prefix?: string;
  suffix?: string;
}> = ({ target, startTime, prefix = '', suffix = '+' }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (startTime === null) return;

    const duration = 1600;
    let animationFrame = 0;
    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * easedProgress));
      if (progress < 1) animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [startTime, target]);

  return <>{prefix}{value.toLocaleString('en-US')}{suffix}</>;
};

interface SaasLandingPageProps {
  availableTenants: TenantInfo[];
  onGlobalLogin: () => void;
  onOpenSuperAdmin: () => void;
}

export const SaasLandingPage: React.FC<SaasLandingPageProps> = ({
  availableTenants,
  onGlobalLogin,
  onOpenSuperAdmin,
}) => {
  const [activeNav, setActiveNav] = useState<'home' | 'features' | 'stores' | 'pricing' | 'about'>('home');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [storeDirectory, setStoreDirectory] = useState(availableTenants);
  const [statsInView, setStatsInView] = useState(false);
  const [statsAnimationStartTime, setStatsAnimationStartTime] = useState<number | null>(null);
  const statsSectionRef = useRef<HTMLElement>(null);
  const storesSwiperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    api.saas.getPublicStats()
      .then((stats) => {
        if (isMounted) setPublicStats(stats);
      })
      .catch(() => {
        // Keep the counters blank when live totals cannot be loaded; never show invented figures.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setStoreDirectory(availableTenants);
  }, [availableTenants]);

  useEffect(() => {
    let isMounted = true;
    const refreshStoreDirectory = async () => {
      try {
        const result = await api.saas.resolve();
        if (isMounted && Array.isArray(result?.availableTenants)) {
          setStoreDirectory((current) => {
            const next = result.availableTenants as TenantInfo[];
            const hasChanged = current.length !== next.length || current.some((tenant, index) => {
              const updated = next[index];
              return !updated
                || tenant.id !== updated.id
                || tenant.name !== updated.name
                || tenant.logoUrl !== updated.logoUrl
                || tenant.status !== updated.status
                || tenant.subscriptionStatus !== updated.subscriptionStatus;
            });
            return hasChanged ? next : current;
          });
        }
      } catch {
        // Keep the last loaded store list if a refresh is temporarily unavailable.
      }
    };
    const intervalId = window.setInterval(refreshStoreDirectory, 30_000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const section = statsSectionRef.current;
    if (!section || statsInView) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setStatsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [statsInView]);

  useEffect(() => {
    if (statsInView && publicStats && statsAnimationStartTime === null) {
      setStatsAnimationStartTime(performance.now());
    }
  }, [statsInView, publicStats, statsAnimationStartTime]);

  useEffect(() => {
    const container = storesSwiperRef.current;
    if (!container || storeDirectory.length === 0) return;

    type SwiperInstance = { destroy: (deleteInstance?: boolean, cleanStyles?: boolean) => void };
    let swiperInstance: SwiperInstance | null = null;
    const initializeSwiper = () => {
      const SwiperConstructor = (window as Window & {
        Swiper?: new (element: HTMLElement, options: Record<string, unknown>) => SwiperInstance;
      }).Swiper;
      if (!SwiperConstructor || swiperInstance) return;

      swiperInstance = new SwiperConstructor(container, {
        loop: true,
        loopAddBlankSlides: true,
        slidesPerView: 2,
        slidesPerGroup: 1,
        spaceBetween: 24,
        speed: 6000,
        freeMode: { enabled: true, momentum: false },
        autoplay: {
          delay: 0,
          disableOnInteraction: false,
          pauseOnMouseEnter: false,
        },
        breakpoints: {
          640: { slidesPerView: 4 },
          1024: { slidesPerView: 5 },
          1280: { slidesPerView: 6 },
        },
      });
      container.style.overflow = 'hidden';
    };

    const swiperScript = document.querySelector<HTMLScriptElement>('script[data-swiper-cdn]');
    if ((window as Window & { Swiper?: unknown }).Swiper) {
      initializeSwiper();
    } else {
      swiperScript?.addEventListener('load', initializeSwiper);
    }

    return () => {
      swiperScript?.removeEventListener('load', initializeSwiper);
      swiperInstance?.destroy(true, true);
      swiperInstance = null;
    };
  }, [storeDirectory.length]);

  // Store request form states
  const [storeName, setStoreName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [plan, setPlan] = useState('1_YEAR_RS_18000');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    message: string;
  } | null>(null);

  // Real-time validation & email availability states
  const [storeNameTouched, setStoreNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailAvailability, setEmailAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [emailAvailabilityMsg, setEmailAvailabilityMsg] = useState<string>('');

  const trimmedStoreName = storeName.trim();
  const isDuplicateStoreName =
    trimmedStoreName.length >= 2 &&
    storeDirectory.some((t) => String(t.name || '').trim().toLowerCase() === trimmedStoreName.toLowerCase());
  const isStoreNameValid =
    trimmedStoreName.length >= 3 &&
    trimmedStoreName.length <= 80 &&
    /[A-Za-z]{2,}/.test(trimmedStoreName) &&
    /^[A-Za-z0-9][A-Za-z0-9\s&'.,()-]{2,79}$/.test(trimmedStoreName) &&
    !isDuplicateStoreName;

  const storeNameErrorMsg = !trimmedStoreName
    ? 'Store name is required.'
    : isDuplicateStoreName
    ? 'A store with this name already exists. Please choose a different store name.'
    : trimmedStoreName.length < 3
    ? 'Store name must be at least 3 characters.'
    : !/[A-Za-z]{2,}/.test(trimmedStoreName)
    ? 'Store name must include letters (e.g. Metro Footwear).'
    : !isStoreNameValid
    ? 'Store name contains invalid characters.'
    : '';

  const trimmedEmail = ownerEmail.trim().toLowerCase();
  const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail);

  const trimmedPhone = ownerPhone.trim();
  const phoneDigitsCount = trimmedPhone.replace(/\D/g, '').length;
  const isPhoneValid =
    trimmedPhone.length > 0 &&
    /^[+]?[0-9\s\-()]{7,20}$/.test(trimmedPhone) &&
    phoneDigitsCount >= 10 &&
    phoneDigitsCount <= 15;

  const phoneErrorMsg = !trimmedPhone
    ? 'Phone / WhatsApp number is required.'
    : !/^[+]?[0-9\s\-()]+$/.test(trimmedPhone)
    ? 'Phone number can only contain digits, +, spaces, or hyphens.'
    : phoneDigitsCount < 10
    ? `Enter at least 10 digits (${phoneDigitsCount}/10 entered).`
    : phoneDigitsCount > 15
    ? 'Phone number cannot exceed 15 digits.'
    : '';

  // Real-time debounced email availability check
  useEffect(() => {
    if (!showRequestModal) return;
    if (!trimmedEmail || !isEmailFormatValid) {
      setEmailAvailability('idle');
      setEmailAvailabilityMsg('');
      return;
    }

    let cancelled = false;
    setEmailAvailability('checking');
    setEmailAvailabilityMsg('Checking email availability...');

    const timer = window.setTimeout(async () => {
      try {
        const res = await api.saas.checkEmailAvailability(trimmedEmail);
        if (cancelled) return;
        if (res.available) {
          setEmailAvailability('available');
          setEmailAvailabilityMsg(res.message || 'Email is available.');
        } else {
          setEmailAvailability('taken');
          setEmailAvailabilityMsg(
            res.message || 'This email is already in use. Please use a different email address.'
          );
        }
      } catch {
        if (!cancelled) {
          setEmailAvailability('available');
          setEmailAvailabilityMsg('Email format is valid.');
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedEmail, isEmailFormatValid, showRequestModal]);

  const canSubmitStoreRequest =
    isStoreNameValid &&
    isEmailFormatValid &&
    emailAvailability === 'available' &&
    isPhoneValid &&
    !submitting;

  const openGetStartedWithPlan = (selectedPlan: string) => {
    setPlan(selectedPlan);
    setSubmitError(null);
    setStoreNameTouched(false);
    setEmailTouched(false);
    setPhoneTouched(false);
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreNameTouched(true);
    setEmailTouched(true);
    setPhoneTouched(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!isStoreNameValid) {
      setSubmitError(storeNameErrorMsg || 'Please enter a valid store name.');
      return;
    }
    if (!isEmailFormatValid) {
      setSubmitError('Please enter a valid owner email address.');
      return;
    }
    if (emailAvailability === 'checking') {
      setSubmitError('Please wait while we verify email availability.');
      return;
    }
    if (emailAvailability === 'taken') {
      setSubmitError(emailAvailabilityMsg || 'This email is already in use. Please use a different email address.');
      return;
    }
    if (!isPhoneValid) {
      setSubmitError(phoneErrorMsg || 'Please enter a valid Phone / WhatsApp number (10 to 15 digits).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.saas.submitStoreRequest({
        storeName: toTitleCaseTrimmed(storeName),
        ownerEmail: toLowerTrimmed(ownerEmail),
        ownerPhone: ownerPhone.trim(),
        plan,
      });
      setSubmitSuccess({
        message: res.message,
      });
      setStoreName('');
      setOwnerEmail('');
      setOwnerPhone('');
      setStoreNameTouched(false);
      setEmailTouched(false);
      setPhoneTouched(false);
      setEmailAvailability('idle');
      setEmailAvailabilityMsg('');
    } catch (err: any) {
      if (err?.code === 'EMAIL_ALREADY_EXISTS' || err?.code === 'PENDING_REQUEST_EXISTS') {
        setEmailAvailability('taken');
        setEmailAvailabilityMsg(err.message || 'This email is already in use.');
      }
      setSubmitError(err.message || 'Failed to submit store request.');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSection = (id: string, navKey: 'home' | 'features' | 'stores' | 'pricing' | 'about') => {
    setActiveNav(navKey);
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const featureItems = [
    {
      title: 'POS & Sales Operations',
      desc: 'Fast billing, offline support, barcode scanning, returns and exchanges.',
      icon: ShoppingCart,
      iconBg: 'bg-[#EBF3FF]',
      iconColor: 'text-[#0066FF]',
    },
    {
      title: 'Inventory Management',
      desc: 'Set prices, check stock levels and record changes to your products.',
      icon: Package,
      iconBg: 'bg-[#E6F8EF]',
      iconColor: 'text-[#10B981]',
    },
    {
      title: 'Purchases & Suppliers',
      desc: 'Supplier khata, purchase orders and supplier returns.',
      icon: Truck,
      iconBg: 'bg-[#FFEBEB]',
      iconColor: 'text-[#EF4444]',
    },
    {
      title: 'Hardware & Printing',
      desc: 'Thermal receipts, barcode labels and direct hardware control.',
      icon: Printer,
      iconBg: 'bg-[#F3E8FF]',
      iconColor: 'text-[#8B5CF6]',
    },
    {
      title: 'Customers & Returns',
      desc: 'Customer profiles, sales returns and POS exchanges.',
      icon: Users,
      iconBg: 'bg-[#E6F8EF]',
      iconColor: 'text-[#10B981]',
    },
    {
      title: 'Sales & Stock Reports',
      desc: 'Sales, profit, inventory valuation and low-stock alerts.',
      icon: BarChart3,
      iconBg: 'bg-[#FFF4E5]',
      iconColor: 'text-[#F59E0B]',
    },
    {
      title: 'Security & User Management',
      desc: 'Role-based access, secure accounts and automated backups.',
      icon: ShieldCheck,
      iconBg: 'bg-[#EBF3FF]',
      iconColor: 'text-[#0066FF]',
    },
    {
      title: 'Store Settings & Branding',
      desc: 'Set up your shop, customize receipts and manage your team.',
      icon: Settings,
      iconBg: 'bg-[#F1F5F9]',
      iconColor: 'text-[#475569]',
    },
    {
      title: 'AI Store Assistant',
      desc: 'Get help with store operations and POS questions, plus AI suggestions when adding products.',
      icon: Sparkles,
      iconBg: 'bg-[#F3E8FF]',
      iconColor: 'text-[#8B5CF6]',
    },
  ];

  const storesForSlider = storeDirectory.length === 0
    ? []
    : Array.from(
        { length: Math.max(storeDirectory.length, 7) },
        (_, index) => storeDirectory[index % storeDirectory.length],
      );

  const landingNavItems = [
    { key: 'home', label: 'Home', section: 'top' },
    { key: 'features', label: 'Features', section: 'features' },
    { key: 'stores', label: 'Stores', section: 'stores' },
    { key: 'pricing', label: 'Pricing', section: 'pricing' },
    { key: 'about', label: 'About', section: 'about' },
  ] as const;

  return (
    <div className="min-h-screen bg-white text-[#0A1633] font-sans selection:bg-[#0066FF] selection:text-white">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: ShoePOS Brand Lockup */}
          <button
            type="button"
            onClick={() => scrollToSection('top', 'home')}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="w-11 h-11 flex items-center justify-center">
              <svg viewBox="0 0 64 42" className="w-11 h-8">
                {/* Running Shoe Silhouette matching reference logo */}
                <path
                  d="M6 31c0-3 2-5 5-6l12-5c3-1.5 6-4.5 8-8 1-1.5 2.8-1.5 3.8 0 1.8 2.8 4.5 5 8.2 5.8l11 2.4c3.5.8 6 3.8 6 7.3 0 2.5-2 4.5-4.5 4.5H10.5C8 37 6 34.5 6 31z"
                  fill="#0A1633"
                />
                <path
                  d="M6 33.5h53.5c1 0 1.8.8 1.8 1.8s-.8 1.7-1.8 1.7H8c-1.5 0-2.5-1-2-3.5z"
                  fill="#0066FF"
                />
                <path
                  d="M23 18l3 2m-6 1.5l3 2m-6 1.5l3 2"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14 29c7-1 14-3.5 21-8"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-extrabold tracking-tight leading-none">
                <span className="text-[#0A1633]">Shoe</span>
                <span className="text-[#0066FF]">POS</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                Retail Shoe Shop System
              </div>
            </div>
          </button>

          {/* Center: Navigation Links */}
          <nav className="hidden md:flex h-full items-center gap-1 text-sm font-medium text-slate-700">
            {landingNavItems.map(({ key, label, section }) => (
              <button
                key={key}
                type="button"
                onClick={() => scrollToSection(section, key)}
                className={`relative h-full px-3.5 py-3.5 transition-colors duration-300 cursor-pointer whitespace-nowrap ${
                  activeNav === key
                    ? 'font-bold text-purple-600'
                    : 'text-slate-600 hover:text-purple-600'
                }`}
              >
                {label}
                {activeNav === key && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)]"
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Right: Login & Get Started */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onGlobalLogin}
              className="px-6 py-2 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-300 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Login
            </button>
            <a href="/landing-v2" className="hidden xl:inline-flex px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-[#0066FF] transition-colors whitespace-nowrap">New layout</a>
            <button
              type="button"
              onClick={() => openGetStartedWithPlan('1_YEAR_RS_18000')}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shadow-md shadow-purple-600/25"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-blue-100/80">
        {/* Showroom photo fills the entire hero background. */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src={shoeStoreBg}
            alt="Retail Shoe Store Interior"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 pointer-events-none bg-[#07162E]/65" aria-hidden="true" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
            {/* Left Column: Value Proposition & CTAs */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-white/20 bg-white/15 text-white text-xs font-bold tracking-tight">
                A simpler way to run your shoe shop
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight leading-[1.08] text-white">
                Built for
                <br />
                Shoe Retailers
                <span className="block text-blue-300 mt-1">
                  Sell &bull; Manage &bull; Grow
                </span>
              </h1>

              <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-lg font-medium">
                Keep sales, stock, suppliers and your team in one place. Serve customers faster, see what is selling and stay on top of your shop — even when the internet drops.
              </p>

              {/* Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => openGetStartedWithPlan('1_YEAR_RS_18000')}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white font-bold text-sm shadow-lg shadow-purple-600/25 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

              </div>

              {/* 4 Bottom Trust Feature Badges */}
              <div className="pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-white/35">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 border border-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold text-white leading-tight truncate">
                      Works Offline
                    </div>
                    <div className="text-[10px] text-white/75 truncate">
                      Works on your devices
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 border border-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold text-white leading-tight truncate">
                      Your whole team
                    </div>
                    <div className="text-[10px] text-white/75 truncate">
                      Owners and cashiers, all in one place
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 border border-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold text-white leading-tight truncate">
                      Secure &amp; Reliable
                    </div>
                    <div className="text-[10px] text-white/75 truncate">
                      Your data, always safe
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 border border-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ThumbsUp className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold text-white leading-tight truncate">
                      Easy to Use
                    </div>
                    <div className="text-[10px] text-white/75 truncate">
                      For retail teams
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 relative pt-2 pb-12 sm:pb-16">
              <img
                src={posShowcase}
                alt="ShoePOS checkout screen with shoe products, customer cart, receipt printer and shoe box"
                className="block w-full h-auto drop-shadow-[0_25px_45px_rgba(10,22,51,0.18)]"
              />
            </div>
          </div>
        </div>
      </section>

      <section ref={statsSectionRef} className="bg-[#F3F7FF] py-12 sm:py-14 text-[#0A1633]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0066FF]">ShoePOS in numbers</div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">Real activity from shops using ShoePOS</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Shops', value: publicStats?.stores, icon: Store, prefix: '', suffix: '+' },
              { label: 'Products tracked', value: publicStats?.products, icon: Package, prefix: '', suffix: '+' },
              { label: 'Invoices created today', value: publicStats?.invoicesToday, icon: ShoppingCart, prefix: '', suffix: '+' },
              { label: 'Platform revenue', value: publicStats?.platformRevenue, icon: DollarSign, prefix: 'Rs. ', suffix: '' },
            ].map(({ label, value, icon: Icon, prefix, suffix }) => (
              <div key={label} className="text-center px-3 py-5 rounded-2xl bg-white border border-blue-100 shadow-[0_8px_24px_rgba(10,22,51,0.06)]">
                <Icon className="w-5 h-5 text-[#0066FF] mx-auto mb-3" aria-hidden="true" />
                <div className="text-3xl sm:text-4xl font-extrabold tabular-nums min-h-10 text-[#0A1633]">
                  {typeof value === 'number'
                    ? <AnimatedCounter
                        target={value}
                        startTime={statsAnimationStartTime}
                        prefix={prefix}
                        suffix={suffix}
                      />
                    : <span aria-label="Loading statistic">—</span>}
                </div>
                <p className="mt-2 text-sm text-slate-600">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FEATURES SECTION */}
      <section id="features" className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Left Column: Section Heading + 3 Preview Screens */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#DCEBFF] text-[#0066FF] text-[11px] font-extrabold uppercase tracking-wider">
                FEATURES
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0A1633] tracking-tight leading-[1.15]">
                Everything You Need
                <br />
                to Run Your Shoe Store
              </h2>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                From sales to inventory, suppliers to reports — ShoePOS helps you manage your complete retail business in one powerful platform.
              </p>

              {/* 3 Miniature Feature Preview Cards */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {/* Preview 1: Executive Dashboard */}
                <div className="text-center">
                  <div className="h-28 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between p-2 text-left">
                    <div className="bg-[#0B1938] text-white text-[7px] font-bold px-1.5 py-0.5 rounded flex items-center justify-between">
                      <span>ShoePOS</span>
                      <span className="text-blue-300">KPIs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 my-1">
                      <div className="bg-slate-50 p-1 rounded border border-slate-100">
                        <div className="text-[6px] text-slate-400">Today&apos;s Sales</div>
                        <div className="text-[8px] font-extrabold text-[#0A1633]">Rs. 48,750</div>
                        <div className="text-[6px] text-emerald-600 font-bold">+12%</div>
                      </div>
                      <div className="bg-slate-50 p-1 rounded border border-slate-100">
                        <div className="text-[6px] text-slate-400">Transactions</div>
                        <div className="text-[8px] font-extrabold text-[#0A1633]">36</div>
                        <div className="text-[6px] text-emerald-600 font-bold">+8%</div>
                      </div>
                    </div>
                    {/* Mini Bar Chart */}
                    <div className="flex items-end gap-1 h-7 px-1">
                      <span className="flex-1 bg-blue-200 h-2 rounded-t" />
                      <span className="flex-1 bg-blue-300 h-3 rounded-t" />
                      <span className="flex-1 bg-blue-400 h-4 rounded-t" />
                      <span className="flex-1 bg-blue-500 h-5 rounded-t" />
                      <span className="flex-1 bg-[#0066FF] h-6 rounded-t" />
                      <span className="flex-1 bg-[#0052CC] h-7 rounded-t" />
                    </div>
                  </div>
                  <div className="text-xs font-bold text-[#0A1633] mt-2">
                    Executive Dashboard
                  </div>
                </div>

                {/* Preview 2: POS Counter */}
                <div className="text-center">
                  <div className="h-28 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between p-2 text-left">
                    <div className="bg-[#0B1938] text-white text-[7px] font-bold px-1.5 py-0.5 rounded flex items-center justify-between">
                      <span>POS Terminal</span>
                      <span className="text-emerald-300">F9</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 my-1">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div
                          key={n}
                          className="h-6 rounded bg-slate-100 border border-slate-200/70 flex items-center justify-center text-[7px] font-bold text-slate-700"
                        >
                          👟
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#0066FF] text-white text-[7px] font-bold text-center py-0.5 rounded">
                      Checkout &bull; Rs. 16,699
                    </div>
                  </div>
                  <div className="text-xs font-bold text-[#0A1633] mt-2">
                    POS Counter
                  </div>
                </div>

                {/* Preview 3: Barcode Labels */}
                <div className="text-center">
                  <div className="h-28 rounded-xl bg-gradient-to-br from-[#334155] to-[#0F172A] border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center p-2">
                    <div className="w-full bg-white rounded p-1.5 text-center shadow-xs">
                      <div className="text-[7px] font-extrabold text-[#0A1633]">Shoe Store</div>
                      <div className="text-[8px] font-black text-[#0A1633]">HS-1021</div>
                      <div className="h-4 my-0.5 bg-[repeating-linear-gradient(90deg,#0f172a,#0f172a_1px,transparent_1px,transparent_3px)]" />
                      <div className="text-[6px] font-mono text-slate-600">0108923000012</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-[#0A1633] mt-2">
                    Barcode Labels
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 2x4 Grid of 8 Feature Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featureItems.map((feat, index) => {
                const IconComponent = feat.icon;
                return (
                  <div
                    key={index}
                    className="group bg-white hover:bg-[#F8FBFF] rounded-2xl border border-slate-200/80 hover:border-blue-300 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] hover:shadow-md transition-all flex items-start justify-between gap-3.5"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl ${feat.iconBg} ${feat.iconColor} flex items-center justify-center shrink-0`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-[#0A1633] group-hover:text-[#0066FF] transition-colors">
                          {feat.title}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">
                          {feat.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 4. OUR STORES SECTION */}
      <section
        id="stores"
        className="py-14 bg-gradient-to-b from-[#F2F7FF] to-[#F8FBFF] border-y border-blue-100/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A1633] tracking-tight">
                Shops using ShoePOS
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Browse the shops currently set up on ShoePOS.
              </p>
            </div>
          </div>

          {storeDirectory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-white/70 px-6 py-10 text-center">
              <Store className="w-8 h-8 text-blue-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600">No shops are listed yet.</p>
            </div>
          ) : (
            <div
              ref={storesSwiperRef}
              className="swiper w-full overflow-x-auto"
              aria-label="Provisioned shops"
            >
              <div className="swiper-wrapper flex">
                {storesForSlider.map((tenant, index) => {
                  const hasStoreLogo = Boolean(tenant.logoUrl) && !tenant.logoUrl.endsWith('/pwa-512x512.png');
                  return (
                    <button
                      type="button"
                      key={`${tenant.id}-${index}`}
                      aria-label={`${tenant.name} store`}
                      className="swiper-slide store-item shrink-0 w-[calc((100%_-_24px)/2)] sm:w-[calc((100%_-_72px)/4)] lg:w-[calc((100%_-_96px)/5)] xl:w-[calc((100%_-_120px)/6)] bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200/80 hover:border-blue-300 p-4 shadow-2xs hover:shadow-md transition flex flex-col items-center gap-3 text-center h-32 cursor-pointer"
                    >
                      <span className="h-12 w-full flex items-center justify-center pb-3 shrink-0">
                        {hasStoreLogo ? (
                          <img src={tenant.logoUrl} alt={`${tenant.name} logo`} className="max-h-10 max-w-full object-contain" />
                        ) : (
                          <span className="w-10 h-10 rounded-xl bg-[#EBF3FF] text-[#0066FF] flex items-center justify-center text-lg font-extrabold" aria-hidden="true">
                            {tenant.name.trim().charAt(0).toUpperCase() || <Store className="w-5 h-5" />}
                          </span>
                        )}
                      </span>
                      <hr className="w-4/5 border-0 border-t border-slate-200" aria-hidden="true" />
                      <span className="w-full text-[11px] font-semibold text-slate-600 leading-tight truncate">
                        {tenant.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. PRICING SECTION */}
      <section id="pricing" className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#DCEBFF] text-[#0066FF] text-[11px] font-extrabold uppercase tracking-wider mb-2.5">
              PRICING
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0A1633] tracking-tight">
              Choose the Plan That Fits Your Business
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Simple and transparent pricing. No hidden fees. Cancel anytime.
            </p>
          </div>

          {/* 2 Subscription Plan Cards */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Plan 1: 6 Months Subscription */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#0A1633]">
                      6 Months Subscription
                    </h3>
                    <div className="text-3xl sm:text-4xl font-extrabold text-purple-700 mt-1 tracking-tight tabular-nums">
                      Rs. 10,000
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#EBF3FF] text-[#0066FF] flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>

                <ul className="space-y-3 mt-6 text-sm text-slate-700 font-medium">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Full access to all features</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Multi-Role Staff Access</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Built-in AI Assistant</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Free updates &amp; support</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Secure data backup</span>
                  </li>
                </ul>
              </div>

              <div className="mt-7 pt-2">
                <button
                  type="button"
                  onClick={() => openGetStartedWithPlan('6_MONTHS_RS_10000')}
                  className="w-full py-3 rounded-xl bg-white text-purple-700 border border-purple-600 hover:text-white hover:border-transparent hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:shadow-md hover:shadow-purple-600/25 font-bold text-sm transition-all cursor-pointer"
                >
                  Get Started
                </button>
                <p className="text-xs text-slate-500 mt-3">
                  Perfect for new stores or short-term needs.
                </p>
              </div>
            </div>

            {/* Plan 2: 1 Year Subscription (Most Popular) */}
            <div className="relative bg-white rounded-2xl border-2 border-purple-600 shadow-[0_12px_40px_rgba(147,51,234,0.16)] p-7 sm:p-8 flex flex-col justify-between">
              <div className="absolute -top-3.5 right-6 px-4 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold shadow-sm">
                Most Popular
              </div>

              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#0A1633]">
                      1 Year Subscription
                    </h3>
                    <div className="text-3xl sm:text-4xl font-extrabold text-purple-700 mt-1 tracking-tight tabular-nums">
                      Rs. 18,000
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#EBF3FF] text-[#0066FF] flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>

                <ul className="space-y-3 mt-6 text-sm text-slate-700 font-medium">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Full access to all features</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Multi-Role Staff Access</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Built-in AI Assistant</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Free updates &amp; support</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3] shrink-0" />
                    <span>Secure data backup</span>
                  </li>
                </ul>
              </div>

              <div className="mt-7 pt-2">
                <button
                  type="button"
                  onClick={() => openGetStartedWithPlan('1_YEAR_RS_18000')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white font-bold text-sm shadow-md shadow-purple-600/25 transition-all cursor-pointer"
                >
                  Get Started
                </button>
                <p className="text-xs text-slate-600 mt-3">
                  Save more. Grow faster.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. BOTTOM NAVY CTA BANNER */}
      <section
        id="about"
        className="relative overflow-hidden bg-gradient-to-r from-[#08152E] via-[#0D2758] to-[#0A224E] text-white py-11"
      >
        {/* Left Shoe Shelf Texture Overlay */}
        <div className="absolute inset-y-0 left-0 w-72 opacity-25 pointer-events-none">
          <img
            src={shoeStoreBg}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#08152E]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight text-white">
              Ready to Take Your Shoe Business to the Next Level?
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1.5 font-medium">
              Join our growing community of store owners and start managing your business smarter today.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openGetStartedWithPlan('1_YEAR_RS_18000')}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-white hover:bg-blue-50 text-[#0052CC] font-extrabold text-sm shadow-xl transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Get Started Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* MODAL 1: GET STARTED / STORE SUBSCRIPTION REQUEST (Aligned with ProductFormModal Header, Cards & Footer) */}
      {showRequestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
          onClick={() => setShowRequestModal(false)}
        >
          <div
            className="relative w-full max-w-xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 dark:border-purple-800/80 animate-in fade-in zoom-in-95 duration-150"
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
                      Register Your Shoe Store
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-purple-200/80">
                      Tell us about your shop and get started with sales and stock management
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {submitSuccess ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-slate-50/50 dark:bg-[#070B14]">
                <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Store Request Submitted!</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {submitSuccess.message}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-gray-200 dark:border-purple-800/80 -mx-6 -mb-6 px-6 py-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitSuccess(null);
                      setShowRequestModal(false);
                    }}
                    className="btn-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      onOpenSuperAdmin();
                    }}
                    style={{ color: '#ffffff' }}
                    className="btn-primary btn-pure-white px-5 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                  >
                    <span className="!text-white text-white font-bold" style={{ color: '#ffffff' }}>
                      Open SuperAdmin C-Panel to Approve
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <form
                  id="landing-store-request-form"
                  onSubmit={handleSubmitRequest}
                  className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-slate-50/50 dark:bg-[#070B14]"
                >
                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs font-medium">
                      {submitError}
                    </div>
                  )}

                  {/* CARD 1: STORE & OWNER CONTACT DETAILS */}
                  <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                      <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span>1. Store &amp; Contact Information</span>
                      </h5>
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                        Shop Details
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-1.5">
                        Store Name <span className="text-red-500 dark:text-pink-400">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={storeName}
                          onBlur={() => setStoreNameTouched(true)}
                          onChange={(e) => {
                            setStoreName(toTitleCaseLive(e.target.value));
                            if (submitError) setSubmitError(null);
                          }}
                          placeholder="e.g. Metro Footwear"
                          aria-invalid={(storeNameTouched || storeName.length > 0) && !isStoreNameValid}
                          className={`capitalize w-full pl-9 pr-9 py-2.5 rounded-xl bg-white dark:bg-purple-500/20 border text-xs font-medium text-gray-900 dark:text-purple-100 placeholder-slate-400 focus:outline-none transition shadow-2xs ${
                            (storeNameTouched || storeName.length > 0) && !isStoreNameValid
                              ? 'border-rose-400 dark:border-rose-500/70 focus:border-rose-500'
                              : isStoreNameValid
                              ? 'border-emerald-400 dark:border-emerald-500/70 focus:border-emerald-500'
                              : 'border-gray-300 dark:border-purple-400/40 focus:border-indigo-600 dark:focus:border-purple-400'
                          }`}
                        />
                        {(storeNameTouched || storeName.length > 0) && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {isStoreNameValid ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-500" />
                            )}
                          </div>
                        )}
                      </div>
                      {(storeNameTouched || storeName.length > 0) && (
                        <p
                          className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${
                            isStoreNameValid
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isStoreNameValid ? 'Store name looks great.' : storeNameErrorMsg}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-1.5">
                          Owner Email <span className="text-red-500 dark:text-pink-400">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="email"
                            required
                            value={ownerEmail}
                            onBlur={() => setEmailTouched(true)}
                            onChange={(e) => {
                              setOwnerEmail(e.target.value);
                              if (submitError) setSubmitError(null);
                            }}
                            placeholder="owner@metroshoes.pk"
                            aria-invalid={
                              (emailTouched || ownerEmail.length > 0) &&
                              (!isEmailFormatValid || emailAvailability === 'taken')
                            }
                            className={`w-full pl-9 pr-9 py-2.5 rounded-xl bg-white dark:bg-purple-500/20 border text-xs font-medium font-mono text-gray-900 dark:text-purple-100 placeholder-slate-400 focus:outline-none transition shadow-2xs ${
                              (emailTouched || ownerEmail.length > 0) &&
                              (!isEmailFormatValid || emailAvailability === 'taken')
                                ? 'border-rose-400 dark:border-rose-500/70 focus:border-rose-500'
                                : isEmailFormatValid && emailAvailability === 'available'
                                ? 'border-emerald-400 dark:border-emerald-500/70 focus:border-emerald-500'
                                : 'border-gray-300 dark:border-purple-400/40 focus:border-indigo-600 dark:focus:border-purple-400'
                            }`}
                          />
                          {(emailTouched || ownerEmail.length > 0) && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              {emailAvailability === 'checking' ? (
                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                              ) : isEmailFormatValid && emailAvailability === 'available' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                              )}
                            </div>
                          )}
                        </div>
                        {(emailTouched || ownerEmail.length > 0) && (
                          <p
                            className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${
                              !isEmailFormatValid || emailAvailability === 'taken'
                                ? 'text-rose-600 dark:text-rose-400'
                                : emailAvailability === 'checking'
                                ? 'text-indigo-600 dark:text-indigo-300'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {!trimmedEmail
                              ? 'Owner email is required.'
                              : !isEmailFormatValid
                              ? 'Enter a valid email address (e.g. owner@metroshoes.pk).'
                              : emailAvailabilityMsg}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-1.5">
                          Phone / WhatsApp <span className="text-red-500 dark:text-pink-400">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="tel"
                            required
                            value={ownerPhone}
                            onBlur={() => setPhoneTouched(true)}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9+\s\-()]/g, '');
                              setOwnerPhone(cleaned);
                              if (submitError) setSubmitError(null);
                            }}
                            placeholder="+92 300 1234567"
                            aria-invalid={(phoneTouched || ownerPhone.length > 0) && !isPhoneValid}
                            className={`w-full pl-9 pr-9 py-2.5 rounded-xl bg-white dark:bg-purple-500/20 border text-xs font-medium font-mono text-gray-900 dark:text-purple-100 placeholder-slate-400 focus:outline-none transition shadow-2xs ${
                              (phoneTouched || ownerPhone.length > 0) && !isPhoneValid
                                ? 'border-rose-400 dark:border-rose-500/70 focus:border-rose-500'
                                : isPhoneValid
                                ? 'border-emerald-400 dark:border-emerald-500/70 focus:border-emerald-500'
                                : 'border-gray-300 dark:border-purple-400/40 focus:border-indigo-600 dark:focus:border-purple-400'
                            }`}
                          />
                          {(phoneTouched || ownerPhone.length > 0) && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              {isPhoneValid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                              )}
                            </div>
                          )}
                        </div>
                        {(phoneTouched || ownerPhone.length > 0) && (
                          <p
                            className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${
                              isPhoneValid
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isPhoneValid ? 'Valid contact number.' : phoneErrorMsg}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: SUBSCRIPTION PLAN */}
                  <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                      <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span>2. Subscription Plan</span>
                      </h5>
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        Full POS Access
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-1.5">
                        Select Plan
                      </label>
                      <select
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        className="capitalize w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 text-xs font-semibold text-gray-900 dark:text-purple-100 focus:outline-none focus:border-indigo-600 dark:focus:border-purple-400 cursor-pointer transition"
                      >
                        <option value="6_MONTHS_RS_10000" className="bg-white text-gray-900 dark:bg-[#120726] dark:text-purple-100">
                          6 Months — Rs. 10,000
                        </option>
                        <option value="1_YEAR_RS_18000" className="bg-white text-gray-900 dark:bg-[#120726] dark:text-purple-100">
                          1 Year — Rs. 18,000 (Most Popular)
                        </option>
                      </select>
                    </div>
                  </div>
                </form>

                {/* MODAL FOOTER ALIGNED WITH PRODUCT FORM MODAL */}
                <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-gray-200 dark:border-purple-800/80 px-6 py-4 flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="btn-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    form="landing-store-request-form"
                    disabled={!canSubmitStoreRequest}
                    style={{ color: '#ffffff' }}
                    className="btn-primary btn-pure-white px-6 py-2.5 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="!text-white text-white font-bold" style={{ color: '#ffffff' }}>
                      {submitting
                        ? 'Submitting Request...'
                        : emailAvailability === 'checking'
                        ? 'Checking Email...'
                        : 'Submit Store Request'}
                    </span>
                    <ArrowRight className="w-4 h-4 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
