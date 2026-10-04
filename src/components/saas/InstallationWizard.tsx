import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, LoaderCircle, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { api } from '../../services/api';
import { PublicLayout } from '../common/PublicLayout';

interface InstallationWizardProps {
  onCompleted: () => void;
}

interface InstallStatus {
  dbReady: boolean;
  installed: boolean;
  hasSuperAdmin: boolean;
  missingTables: string[];
  error?: string;
}

export const InstallationWizard: React.FC<InstallationWizardProps> = ({ onCompleted }) => {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.install.status()
      .then((nextStatus: InstallStatus) => { if (mounted) setStatus(nextStatus); })
      .catch((err: any) => { if (mounted) setStatus({ dbReady: false, installed: false, hasSuperAdmin: false, missingTables: [], error: err?.message }); });
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setError('Enter the superadmin name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match. Check the confirmation and try again.');
      return;
    }
    setSaving(true);
    try {
      await api.install.bootstrap({ name: name.trim(), email: normalizedEmail, password });
      onCompleted();
    } catch (err: any) {
      setError(err?.message || 'Installation could not be completed.');
      const nextStatus = await api.install.status().catch(() => null);
      if (nextStatus) setStatus(nextStatus);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PublicLayout
      storeName="Shoe Shop POS Setup"
      badgeText={status?.dbReady ? 'Setup required' : 'Database connection'}
      badgeVariant={status?.dbReady ? 'wizard' : 'connecting'}
      subtitle="Initial platform installation"
      dbText="Secure PostgreSQL setup"
    >
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/50 bg-white/95 shadow-2xl shadow-indigo-950/20 dark:border-purple-800/70 dark:bg-[#111827]/95">
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-violet-700 px-6 py-7 text-white sm:px-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg">
            <Database className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">First run</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Install your platform</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-indigo-100">
            The installer checks the database schema and creates the first superadmin account you provide.
          </p>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          {status && !status.dbReady && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="font-bold">Database is not ready</div>
              <p className="mt-1">Check the PostgreSQL connection in your environment settings, then reload this page.</p>
              {status.error && <p className="mt-2 break-words text-xs opacity-80">{status.error}</p>}
            </div>
          )}

          {Boolean(status?.missingTables?.length) && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-100">
              <div className="flex items-center gap-2 font-bold"><Database className="h-4 w-4" /> Required database tables are missing</div>
              <p className="mt-1 text-xs leading-5">Continue to create the schema. No store or demo records will be added.</p>
            </div>
          )}

          {!status?.hasSuperAdmin && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div><div className="font-bold">Create the first superadmin</div><p className="mt-1 text-xs leading-5">Use an email and password you control. No default credentials will be generated.</p></div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!status?.hasSuperAdmin && <>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Superadmin name</span>
                <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Your name" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Superadmin email</span>
                <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="admin@example.com" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Password</span>
                <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="At least 8 characters" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Confirm password</span>
                <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder="Enter the password again" />
              </label>
            </>}

            {status?.hasSuperAdmin && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">An existing superadmin account was found and will be preserved.</div>}
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}

            <button type="submit" disabled={saving || !status?.dbReady} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:from-purple-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : status?.hasSuperAdmin ? <CheckCircle2 className="h-4 w-4" /> : <UserRoundPlus className="h-4 w-4" />}
              {saving ? 'Installing…' : status?.hasSuperAdmin ? 'Repair missing schema' : 'Create schema and superadmin'}
            </button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
};
