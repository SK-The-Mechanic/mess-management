'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
        setLoading(true); setError('');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
            });

            let data: any = null;
            try {
                data = await res.json();
            } catch {
                setError('Unexpected server response. Please try again.');
                setLoading(false);
                return;
            }

            if (!res.ok) { setError(data?.error || 'Something went wrong'); setLoading(false); return; }
            router.push('/login?registered=1');
        } catch (err) {
            setError('Network error. Check your connection and try again.');
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
            <div className="conic-bg absolute inset-0" />
            <div className="absolute top-1/3 right-1/3 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />

            <div className="auth-card glass glow-accent relative z-10 mx-4 rounded-2xl p-8 fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2" />
                            <line x1="19" y1="8" x2="19" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <line x1="22" y1="11" x2="16" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Create Account</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Join MessTrack today</p>
                </div>

                {error && <div className="alert alert-error mb-4">{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                        { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Omar Ahmed' },
                        { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
                        { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', show: showPassword, setShow: setShowPassword },
                        { key: 'confirm', label: 'Confirm Password', type: 'password', placeholder: '••••••••', show: showConfirm, setShow: setShowConfirm },
                    ].map(f => (
                        <div key={f.key}>
                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                            {f.type === 'password' ? (
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={f.show ? 'text' : 'password'}
                                        className="input-dark"
                                        placeholder={f.placeholder}
                                        value={(form as any)[f.key]}
                                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        style={{ paddingRight: '42px' }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => f.setShow!(s => !s)}
                                        aria-label={f.show ? 'Hide password' : 'Show password'}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}
                                    >
                                        {f.show ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type={f.type}
                                    className="input-dark"
                                    placeholder={f.placeholder}
                                    value={(form as any)[f.key]}
                                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    required
                                />
                            )}
                        </div>
                    ))}

                    <button type="submit" className="btn-primary mt-2" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <Link href="/login" style={{ color: 'var(--accent-bright)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                </p>
            </div>
        </div>
    );
}
