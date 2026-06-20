'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getDaysInMonth(month: number, year: number) {
    return new Date(year, month, 0).getDate();
}

function getDayName(date: number, month: number, year: number) {
    return DAYS[new Date(year, month - 1, date).getDay()];
}

function isToday(date: number, month: number, year: number) {
    const now = new Date();
    return date === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
}

function isPastDay(date: number, month: number, year: number) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rowDate = new Date(year, month - 1, date);
    return rowDate < today;
}

// ──────────────────────────────────────
// Confirm Modal (reusable for delete + overwrite confirmations)
// ──────────────────────────────────────
function ConfirmModal({ title, desc, onConfirm, onCancel, variant = 'danger', confirmLabel, warningText }: any) {
    const isDanger = variant === 'danger';
    return (
        <div className="modal-overlay">
            <div className="modal fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: isDanger ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        {isDanger ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        )}
                    </div>
                    <div>
                        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px' }}>{title}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{desc}</p>
                    </div>
                </div>
                {(warningText !== false) && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
                        {warningText || (
                            <>⚠️ This action <strong style={{ color: '#ef4444' }}>cannot be undone</strong>. All data will be permanently removed from the database.</>
                        )}
                    </p>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" onClick={onCancel}>Cancel</button>
                    <button className={isDanger ? 'btn-danger' : 'btn-primary'} style={!isDanger ? { width: 'auto' } : undefined} onClick={onConfirm}>
                        {confirmLabel || (isDanger ? 'Yes, Delete' : 'Confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────
// Bazar Table
// ──────────────────────────────────────
function BazarTable({ roomId, members, month, year, isAdmin, editPerm, currentUserId }: any) {
    const totalDays = getDaysInMonth(month, year);
    const [entries, setEntries] = useState<any[]>([]);
    const [editCell, setEditCell] = useState<string | null>(null);
    const [cellValues, setCellValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<any>(null);
    const [confirmOverwrite, setConfirmOverwrite] = useState<{ key: string; amount: number; previous: number } | null>(null);
    const originalValues = useRef<Record<string, string>>({});

    const canEdit = (memberId: string) => {
        if (isAdmin) return true;
        if (editPerm === 'all') return true;
        if (editPerm === 'owner') return memberId === currentUserId;
        return false;
    };

    const fetchData = useCallback(async () => {
        const res = await fetch(`/api/bazar?roomId=${roomId}&month=${month}&year=${year}`);
        const data = await res.json();
        setEntries(data.data || []);
        const map: Record<string, string> = {};
        (data.data || []).forEach((e: any) => {
            map[`${e.date}-${e.userId}`] = String(e.amount);
        });
        setCellValues(map);
        originalValues.current = { ...map };
    }, [roomId, month, year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleFocus = (key: string) => {
        setEditCell(key);
    };

    const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
        if (e.key === 'Escape') {
            setCellValues(v => ({ ...v, [key]: originalValues.current[key] || '' }));
            setEditCell(null);
        }
        if (e.key === 'Enter') {
            // Blur the input ourselves and let onBlur own the save.
            // This avoids saving twice (once from this handler, once from blur).
            (e.target as HTMLInputElement).blur();
        }
    };

    // Actually performs the POST. Called either immediately (new entry)
    // or after the user confirms an overwrite of an existing value.
    const commitSave = async (key: string, amount: number) => {
        const [date, userId] = key.split('-');
        setSaving(true);
        const res = await fetch('/api/bazar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, userId, amount, date: Number(date), month, year }),
        });
        if (res.ok) {
            originalValues.current[key] = String(amount);
            await fetchData();
        } else {
            // Revert on failure so the UI doesn't show an unsaved value as if it stuck.
            setCellValues(v => ({ ...v, [key]: originalValues.current[key] || '' }));
        }
        setSaving(false);
        setEditCell(null);
    };

    const saveCell = (key: string) => {
        const amount = parseFloat(cellValues[key] || '0');
        if (isNaN(amount) || amount < 0) { setCellValues(v => ({ ...v, [key]: originalValues.current[key] || '' })); return; }

        const previous = parseFloat(originalValues.current[key] || '0');

        // No-op if the value hasn't actually changed since the last save —
        // prevents duplicate entries from repeated Enter presses / refocus.
        if (amount === previous) { setEditCell(null); return; }

        // Editing an existing real entry needs confirmation, to avoid
        // accidental overwrites (e.g. stray backspace, mis-click).
        if (previous > 0) {
            setConfirmOverwrite({ key, amount, previous });
            return;
        }

        // Brand-new entry (cell was empty/0) — save right away.
        commitSave(key, amount);
    };

    const handleDeleteEntry = async (entryId: string) => {
        await fetch(`/api/bazar?id=${entryId}&roomId=${roomId}`, { method: 'DELETE' });
        fetchData();
        setConfirmDelete(null);
    };

    // Totals
    const memberTotals: Record<string, number> = {};
    members.forEach((m: any) => { memberTotals[m.userId] = 0; });
    entries.forEach((e: any) => { if (memberTotals[e.userId] !== undefined) memberTotals[e.userId] += e.amount; });
    const grandTotal = Object.values(memberTotals).reduce((a, b) => a + b, 0);

    const midpoint = Math.ceil(totalDays / 2);
    const leftDays = Array.from({ length: midpoint }, (_, i) => i + 1);
    const rightDays = Array.from({ length: totalDays - midpoint }, (_, i) => i + midpoint + 1);

    const renderRows = (days: number[]) => days.map(day => {
        const dayName = getDayName(day, month, year);
        const todayRow = isToday(day, month, year);
        const pastRow = !todayRow && isPastDay(day, month, year);
        return (
            <tr key={day} className={todayRow ? 'today-row' : pastRow ? 'past-row' : undefined}>
                <td style={{ textAlign: 'left', color: todayRow ? 'var(--accent-bright)' : 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>{dayName}</td>
                <td style={{ fontWeight: 700, color: todayRow ? 'var(--accent-bright)' : 'var(--text-primary)' }}>{day}{todayRow && ' •'}</td>
                {members.map((m: any) => {
                    const key = `${day}-${m.userId}`;
                    const entry = entries.find((e: any) => e.date === day && e.userId === m.userId);
                    const val = cellValues[key] || '';
                    const editable = canEdit(m.userId);
                    return (
                        <td key={m.userId}>
                            {editable ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                    <input
                                        type="number"
                                        value={val}
                                        onFocus={() => handleFocus(key)}
                                        onBlur={() => { if (editCell === key) saveCell(key); }}
                                        onKeyDown={e => handleKeyDown(e, key)}
                                        onChange={e => setCellValues(v => ({ ...v, [key]: e.target.value }))}
                                        min="0"
                                        placeholder="0"
                                    />
                                    {isAdmin && entry && (
                                        <button
                                            onClick={() => setConfirmDelete({ id: entry._id, amount: entry.amount, userName: m.name, date: day })}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 }}
                                            title="Delete entry"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <span style={{ color: val ? 'var(--text-primary)' : 'var(--text-muted)' }}>{val || '—'}</span>
                            )}
                        </td>
                    );
                })}
            </tr>
        );
    });

    const TableHead = () => (
        <thead>
            <tr>
                <th style={{ textAlign: 'left' }}>Day</th>
                <th>Date</th>
                {members.map((m: any) => <th key={m.userId}>{m.name}</th>)}
            </tr>
        </thead>
    );

    return (
        <div>
            {confirmDelete && (
                <ConfirmModal
                    title="Delete Bazar Entry"
                    desc={`Remove ৳${confirmDelete.amount} entry for ${confirmDelete.userName} on day ${confirmDelete.date}?`}
                    onConfirm={() => handleDeleteEntry(confirmDelete.id)}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}
            {confirmOverwrite && (
                <ConfirmModal
                    variant="info"
                    title="Change Existing Entry?"
                    desc={`This day already has ৳${confirmOverwrite.previous} saved.`}
                    warningText={`Update it to ৳${confirmOverwrite.amount}? This will replace the previous value, not add to it.`}
                    confirmLabel="Yes, Update"
                    onConfirm={() => {
                        const { key, amount } = confirmOverwrite;
                        setConfirmOverwrite(null);
                        commitSave(key, amount);
                    }}
                    onCancel={() => {
                        // Revert the input back to the last saved value — the user
                        // backed out, so nothing should appear to have changed.
                        setCellValues(v => ({ ...v, [confirmOverwrite.key]: originalValues.current[confirmOverwrite.key] || '' }));
                        setConfirmOverwrite(null);
                        setEditCell(null);
                    }}
                />
            )}
            <div className="split-table-wrap">
                <div className="split-table-col">
                    <table className="data-table">
                        <TableHead />
                        <tbody>{renderRows(leftDays)}</tbody>
                    </table>
                </div>
                <div className="split-table-col">
                    <table className="data-table">
                        <TableHead />
                        <tbody>{renderRows(rightDays)}</tbody>
                    </table>
                </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '24px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Bazar Cost:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-bright)' }}>৳{grandTotal.toFixed(2)}</span>
            </div>
            {saving && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}>Saving...</p>}
        </div>
    );
}

// ──────────────────────────────────────
// Meal Table
// ──────────────────────────────────────
function MealTable({ roomId, members, month, year, isAdmin, editPerm, currentUserId }: any) {
    const totalDays = getDaysInMonth(month, year);
    const [entries, setEntries] = useState<any[]>([]);
    const [cellValues, setCellValues] = useState<Record<string, string>>({});
    const [confirmOverwrite, setConfirmOverwrite] = useState<{ key: string; count: number; previous: number } | null>(null);
    const originalValues = useRef<Record<string, string>>({});

    const canEdit = (memberId: string) => {
        if (isAdmin) return true;
        if (editPerm === 'all') return true;
        if (editPerm === 'owner') return memberId === currentUserId;
        return false;
    };

    const fetchData = useCallback(async () => {
        const res = await fetch(`/api/meal?roomId=${roomId}&month=${month}&year=${year}`);
        const data = await res.json();
        setEntries(data.data || []);
        const map: Record<string, string> = {};
        (data.data || []).forEach((e: any) => { map[`${e.date}-${e.userId}`] = String(e.count); });
        setCellValues(map);
        originalValues.current = { ...map };
    }, [roomId, month, year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Actually performs the POST. Called either immediately (new entry)
    // or after the user confirms an overwrite of an existing value.
    const commitSave = async (key: string, count: number) => {
        const [date, userId] = key.split('-');
        originalValues.current[key] = String(count);
        await fetch('/api/meal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, targetUserId: userId, count, date: Number(date), dayName: getDayName(Number(date), month, year), month, year }),
        });
        await fetchData();
    };

    const saveCell = (key: string, value: string) => {
        const count = parseFloat(value || '0');
        if (isNaN(count) || count < 0) return;

        const previous = parseFloat(originalValues.current[key] || '0');

        // No-op if unchanged — prevents duplicate saves from Enter+blur firing twice.
        if (count === previous) return;

        // Editing an existing real entry needs confirmation, to avoid
        // accidental overwrites (e.g. stray backspace, mis-click).
        if (previous > 0) {
            setConfirmOverwrite({ key, count, previous });
            return;
        }

        // Brand-new entry (cell was empty/0) — save right away.
        commitSave(key, count);
    };

    const memberTotals: Record<string, number> = {};
    members.forEach((m: any) => { memberTotals[m.userId] = 0; });
    entries.forEach((e: any) => { if (memberTotals[e.userId] !== undefined) memberTotals[e.userId] += e.count; });
    const totalMeals = Object.values(memberTotals).reduce((a, b) => a + b, 0);

    const midpoint = Math.ceil(totalDays / 2);
    const leftDays = Array.from({ length: midpoint }, (_, i) => i + 1);
    const rightDays = Array.from({ length: totalDays - midpoint }, (_, i) => i + midpoint + 1);

    const renderRows = (days: number[]) => days.map(day => {
        const dayName = getDayName(day, month, year);
        const todayRow = isToday(day, month, year);
        const pastRow = !todayRow && isPastDay(day, month, year);
        return (
            <tr key={day} className={todayRow ? 'today-row' : pastRow ? 'past-row' : undefined}>
                <td style={{ textAlign: 'left', color: todayRow ? 'var(--accent-bright)' : 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>{dayName}</td>
                <td style={{ fontWeight: 700, color: todayRow ? 'var(--accent-bright)' : 'var(--text-primary)' }}>{day}{todayRow && ' •'}</td>
                {members.map((m: any) => {
                    const key = `${day}-${m.userId}`;
                    const val = cellValues[key] || '';
                    const editable = canEdit(m.userId);
                    return (
                        <td key={m.userId}>
                            {editable ? (
                                <input
                                    type="number"
                                    value={val}
                                    onBlur={e => { if (e.target.value !== originalValues.current[key]) saveCell(key, e.target.value); }}
                                    onKeyDown={e => {
                                        if (e.key === 'Escape') { setCellValues(v => ({ ...v, [key]: originalValues.current[key] || '' })); }
                                        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                                    }}
                                    onChange={e => setCellValues(v => ({ ...v, [key]: e.target.value }))}
                                    min="0" max="10" step="0.5" placeholder="0"
                                />
                            ) : (
                                <span style={{ color: val ? 'var(--text-primary)' : 'var(--text-muted)' }}>{val || '—'}</span>
                            )}
                        </td>
                    );
                })}
            </tr>
        );
    });

    const TableHead = () => (
        <thead>
            <tr>
                <th style={{ textAlign: 'left' }}>Day</th>
                <th>Date</th>
                {members.map((m: any) => <th key={m.userId}>{m.name}</th>)}
            </tr>
        </thead>
    );

    return (
        <div>
            {confirmOverwrite && (
                <ConfirmModal
                    variant="info"
                    title="Change Existing Entry?"
                    desc={`This day already has ${confirmOverwrite.previous} meal(s) saved.`}
                    warningText={`Update it to ${confirmOverwrite.count}? This will replace the previous value, not add to it.`}
                    confirmLabel="Yes, Update"
                    onConfirm={() => {
                        const { key, count } = confirmOverwrite;
                        setConfirmOverwrite(null);
                        commitSave(key, count);
                    }}
                    onCancel={() => {
                        setCellValues(v => ({ ...v, [confirmOverwrite.key]: originalValues.current[confirmOverwrite.key] || '' }));
                        setConfirmOverwrite(null);
                    }}
                />
            )}
            <div className="split-table-wrap">
                <div className="split-table-col">
                    <table className="data-table">
                        <TableHead />
                        <tbody>{renderRows(leftDays)}</tbody>
                    </table>
                </div>
                <div className="split-table-col">
                    <table className="data-table">
                        <TableHead />
                        <tbody>{renderRows(rightDays)}</tbody>
                    </table>
                </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '24px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Meals:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-bright)' }}>{totalMeals}</span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────
// Rent Table
// ──────────────────────────────────────
function RentTable({ roomId, members, month, year, isAdmin, editPerm, currentUserId }: any) {
    const [rents, setRents] = useState<any[]>([]);
    const [vals, setVals] = useState<Record<string, { payable: string; paid: string }>>({});
    const origVals = useRef<Record<string, { payable: string; paid: string }>>({});

    const canEdit = (memberId: string) => {
        if (isAdmin) return true;
        if (editPerm === 'all') return true;
        if (editPerm === 'owner') return memberId === currentUserId;
        return false;
    };

    const fetchData = useCallback(async () => {
        const res = await fetch(`/api/rent?roomId=${roomId}&month=${month}&year=${year}`);
        const data = await res.json();
        setRents(data.data || []);
        const map: any = {};
        members.forEach((m: any) => {
            const r = (data.data || []).find((r: any) => r.userId === m.userId || r.userId?.toString() === m.userId);
            map[m.userId] = { payable: r ? String(r.payable) : '', paid: r ? String(r.paid) : '' };
        });
        setVals(map);
        origVals.current = JSON.parse(JSON.stringify(map));
    }, [roomId, month, year, members]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const saveRent = async (userId: string) => {
        await fetch('/api/rent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, userId, payable: Number(vals[userId]?.payable || 0), paid: Number(vals[userId]?.paid || 0), month, year }),
        });
        await fetchData();
    };

    return (
        <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Name</th>
                        <th>Payable (৳)</th>
                        <th>Paid (৳)</th>
                        <th>Pending (৳)</th>
                        <th>Return (৳)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map((m: any) => {
                        const v = vals[m.userId] || { payable: '', paid: '' };
                        const payable = Number(v.payable || 0);
                        const paid = Number(v.paid || 0);
                        const diff = paid - payable;
                        const editable = canEdit(m.userId);
                        return (
                            <tr key={m.userId}>
                                <td style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                                <td>
                                    {editable ? (
                                        <input type="number" value={v.payable} onChange={e => setVals(prev => ({ ...prev, [m.userId]: { ...prev[m.userId], payable: e.target.value } }))} onBlur={() => saveRent(m.userId)} onKeyDown={e => e.key === 'Enter' && saveRent(m.userId)} placeholder="0" />
                                    ) : <span>{payable || '—'}</span>}
                                </td>
                                <td>
                                    {editable ? (
                                        <input type="number" value={v.paid} onChange={e => setVals(prev => ({ ...prev, [m.userId]: { ...prev[m.userId], paid: e.target.value } }))} onBlur={() => saveRent(m.userId)} onKeyDown={e => e.key === 'Enter' && saveRent(m.userId)} placeholder="0" />
                                    ) : <span>{paid || '—'}</span>}
                                </td>
                                <td style={{ color: diff < 0 ? '#ef4444' : 'var(--text-muted)' }}>{diff < 0 ? Math.abs(diff) : 0}</td>
                                <td style={{ color: diff > 0 ? '#10b981' : 'var(--text-muted)' }}>{diff > 0 ? diff : 0}</td>
                                <td>
                                    {diff === 0 && payable > 0 ? <span className="badge badge-green">Paid</span>
                                        : diff < 0 ? <span className="badge badge-red">Pending</span>
                                            : diff > 0 ? <span className="badge badge-yellow">Overpaid</span>
                                                : <span className="badge" style={{ background: 'rgba(71,85,105,0.2)', color: 'var(--text-muted)' }}>—</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ──────────────────────────────────────
// Shared Costs Table
// ──────────────────────────────────────
function SharedCostTable({ roomId, members, month, year, isAdmin, editPerm }: any) {
    const DEFAULT_COSTS = ['Home Rent', 'Electric Bill', 'Net', 'Dust', 'Khala', 'Gas', 'Extra'];
    const [costs, setCosts] = useState<any[]>([]);
    const [vals, setVals] = useState<Record<string, string>>({});
    const [newName, setNewName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<any>(null);

    const canEdit = isAdmin || editPerm === 'all';

    const fetchData = useCallback(async () => {
        const res = await fetch(`/api/costs?roomId=${roomId}&month=${month}&year=${year}`);
        const data = await res.json();
        setCosts(data.data || []);
        const map: Record<string, string> = {};
        (data.data || []).forEach((c: any) => { map[c.name] = String(c.amount); });
        // Ensure all defaults exist
        DEFAULT_COSTS.forEach(n => { if (!map[n]) map[n] = ''; });
        setVals(map);
    }, [roomId, month, year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const saveCost = async (name: string) => {
        const amount = Number(vals[name] || 0);
        await fetch('/api/costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, name, amount, month, year }),
        });
        await fetchData();
    };

    const deleteCost = async (id: string) => {
        await fetch(`/api/costs?id=${id}&roomId=${roomId}`, { method: 'DELETE' });
        fetchData();
        setConfirmDelete(null);
    };

    const addCustomCost = () => {
        if (!newName.trim()) return;
        setVals(v => ({ ...v, [newName]: '' }));
        setNewName('');
    };

    const allCostNames = [...new Set([...DEFAULT_COSTS, ...Object.keys(vals)])];
    const totalAmount = allCostNames.reduce((s, n) => s + Number(vals[n] || 0), 0);
    const perPerson = members.length > 0 ? totalAmount / members.length : 0;

    return (
        <div>
            {confirmDelete && (
                <ConfirmModal
                    title="Delete Cost Entry"
                    desc={`Remove "${confirmDelete.name}" cost?`}
                    onConfirm={() => deleteCost(confirmDelete.id)}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>Cost Name</th>
                            <th>Amount (৳)</th>
                            <th>Per Person (৳)</th>
                            {isAdmin && <th>Action</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {allCostNames.map(name => {
                            const amount = Number(vals[name] || 0);
                            const entry = costs.find(c => c.name === name);
                            return (
                                <tr key={name}>
                                    <td style={{ textAlign: 'left', color: 'var(--text-primary)', fontWeight: 500 }}>{name}</td>
                                    <td>
                                        {canEdit ? (
                                            <input type="number" value={vals[name] || ''} onChange={e => setVals(v => ({ ...v, [name]: e.target.value }))} onBlur={() => saveCost(name)} onKeyDown={e => e.key === 'Enter' && saveCost(name)} placeholder="0" />
                                        ) : <span>{amount || '—'}</span>}
                                    </td>
                                    <td style={{ color: 'var(--text-primary)' }}>{amount > 0 ? (amount / members.length).toFixed(0) : '—'}</td>
                                    {isAdmin && (
                                        <td>
                                            {entry && (
                                                <button onClick={() => setConfirmDelete({ id: entry._id, name })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px' }}>
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        <tr style={{ background: 'rgba(99,102,241,0.08)' }}>
                            <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--accent-bright)', fontSize: '12px', textTransform: 'uppercase' }}>Total</td>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{totalAmount.toFixed(0)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{perPerson.toFixed(0)}</td>
                            {isAdmin && <td />}
                        </tr>
                    </tbody>
                </table>
            </div>
            {isAdmin && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                    <input className="input-dark" placeholder="Add custom cost name..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomCost()} style={{ maxWidth: '280px' }} />
                    <button className="btn-ghost" onClick={addCustomCost}>+ Add</button>
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────
// Summary / Meal Rate Section
// ──────────────────────────────────────
function SummarySection({ roomId, members, month, year }: any) {
    const [bazarData, setBazarData] = useState<any[]>([]);
    const [mealData, setMealData] = useState<any[]>([]);

    useEffect(() => {
        const fetchAll = async () => {
            const [b, m] = await Promise.all([
                fetch(`/api/bazar?roomId=${roomId}&month=${month}&year=${year}`).then(r => r.json()),
                fetch(`/api/meal?roomId=${roomId}&month=${month}&year=${year}`).then(r => r.json()),
            ]);
            setBazarData(b.data || []);
            setMealData(m.data || []);
        };
        fetchAll();
    }, [roomId, month, year]);

    const totalBazar = bazarData.reduce((s: number, e: any) => s + e.amount, 0);
    const totalMeals = mealData.reduce((s: number, e: any) => s + e.count, 0);
    const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;

    const memberStats = members.map((m: any) => {
        const bazar = bazarData.filter((e: any) => e.userId === m.userId || e.userId?.toString() === m.userId).reduce((s: number, e: any) => s + e.amount, 0);
        const meals = mealData.filter((e: any) => e.userId === m.userId || e.userId?.toString() === m.userId).reduce((s: number, e: any) => s + e.count, 0);
        const consume = meals * mealRate;
        const diff = bazar - consume;
        return { ...m, bazar, meals, consume, diff };
    });

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card">
                    <span className="stat-label">Total Bazar</span>
                    <span className="stat-value" style={{ color: 'var(--accent-bright)' }}>৳{totalBazar.toFixed(0)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Total Meals</span>
                    <span className="stat-value">{totalMeals}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Meal Rate</span>
                    <span className="stat-value" style={{ color: '#10b981' }}>৳{mealRate.toFixed(2)}</span>
                </div>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Member</th>
                        <th>Bazar (৳)</th>
                        <th>Meals</th>
                        <th>Consume (৳)</th>
                        <th>Return / Pending</th>
                    </tr>
                </thead>
                <tbody>
                    {memberStats.map((m: any) => (
                        <tr key={m.userId}>
                            <td style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                            <td>{m.bazar.toFixed(2)}</td>
                            <td>{m.meals}</td>
                            <td>{m.consume.toFixed(2)}</td>
                            <td>
                                {m.diff > 0
                                    ? <span className="badge badge-green">+{m.diff.toFixed(2)} Return</span>
                                    : m.diff < 0
                                        ? <span className="badge badge-red">{m.diff.toFixed(2)} Pending</span>
                                        : <span className="badge badge-purple">Settled</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ──────────────────────────────────────
// Main Room Page
// ──────────────────────────────────────
export default function RoomPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const code = params?.code as string;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [room, setRoom] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'bazar' | 'meal' | 'rent' | 'costs' | 'settings'>('summary');
    const [loading, setLoading] = useState(true);
    const [confirmDeleteMonth, setConfirmDeleteMonth] = useState(false);
    const [msg, setMsg] = useState('');
    const [monthPanelOpen, setMonthPanelOpen] = useState(false);
    const monthSliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && code) fetchRoom();
    }, [status, code]);

    const fetchRoom = async () => {
        const res = await fetch(`/api/room/${code}`);
        if (!res.ok) { router.push('/dashboard'); return; }
        const data = await res.json();
        setRoom(data.room);
        setLoading(false);
    };

    const currentUserId = (session?.user as any)?.id;
    const isMainAdmin = room?.adminId === currentUserId || room?.adminId?.toString() === currentUserId;
    const isSubAdmin = !!room?.subAdminId && (room.subAdminId === currentUserId || room.subAdminId?.toString() === currentUserId);
    // Sub-admin has every admin power EXCEPT appointing/removing a sub-admin —
    // that stays gated behind isMainAdmin specifically, wherever it's checked.
    const hasAdminPowers = isMainAdmin || isSubAdmin;
    const members = room?.members || [];

    // Generate months (last 12 months + next 3)
    const monthOptions: { month: number; year: number; label: string }[] = [];
    for (let i = -11; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        monthOptions.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
    }

    const deleteMonth = async () => {
        await fetch(`/api/room/delete-month?roomId=${room._id}&month=${month}&year=${year}`, { method: 'DELETE' });
        setConfirmDeleteMonth(false);
        setMsg(`All data for ${MONTHS[month - 1]} ${year} deleted.`);
        setTimeout(() => setMsg(''), 4000);
    };

    const updatePermission = async (perm: string) => {
        await fetch(`/api/room/${code}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ editPermission: perm }),
        });
        fetchRoom();
    };

    const assignSubAdmin = async (userId: string | null) => {
        const res = await fetch(`/api/room/${code}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subAdminId: userId }),
        });
        if (res.ok) {
            setMsg(userId ? 'Sub-admin assigned.' : 'Sub-admin removed.');
            setTimeout(() => setMsg(''), 3000);
            fetchRoom();
        }
    };

    const [resetPasswordTarget, setResetPasswordTarget] = useState<{ userId: string; name: string } | null>(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [resetPasswordError, setResetPasswordError] = useState('');
    const [resetPasswordSaving, setResetPasswordSaving] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const submitPasswordReset = async () => {
        if (!resetPasswordTarget) return;
        if (newPasswordValue.length < 6) { setResetPasswordError('Password must be at least 6 characters'); return; }
        setResetPasswordSaving(true);
        setResetPasswordError('');
        const res = await fetch('/api/room/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: room._id, targetUserId: resetPasswordTarget.userId, newPassword: newPasswordValue }),
        });
        const data = await res.json();
        if (res.ok) {
            setMsg(`Password updated for ${resetPasswordTarget.name}.`);
            setTimeout(() => setMsg(''), 3000);
            setResetPasswordTarget(null);
            setNewPasswordValue('');
        } else {
            setResetPasswordError(data.error || 'Something went wrong');
        }
        setResetPasswordSaving(false);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(code);
        setMsg('Invite code copied!');
        setTimeout(() => setMsg(''), 2000);
    };

    if (loading || status === 'loading') return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
            <div style={{ color: 'var(--text-muted)' }}>Loading room...</div>
        </div>
    );

    const TABS = [
        { key: 'summary', label: '📊 Summary' },
        { key: 'bazar', label: '🛒 Bazar' },
        { key: 'meal', label: '🍽️ Meals' },
        { key: 'rent', label: '🏠 Rent' },
        { key: 'costs', label: '💡 Costs' },
        ...(hasAdminPowers ? [{ key: 'settings', label: '⚙️ Settings' }] : []),
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0a0f 0%, #0d0d1a 60%, #0a0a12 100%)' }}>
            {confirmDeleteMonth && (
                <ConfirmModal
                    title={`Delete ${MONTHS[month - 1]} ${year} Data`}
                    desc="This will permanently delete ALL bazar, meal, rent, and cost data for this month."
                    onConfirm={deleteMonth}
                    onCancel={() => setConfirmDeleteMonth(false)}
                />
            )}

            {/* Navbar */}
            <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => setMonthPanelOpen(true)}
                        aria-label="Open month picker"
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                    </button>
                    <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
                        Rooms
                    </Link>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--border-bright)' }}><path d="M9 18l6-6-6-6" /></svg>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>{room?.name}</span>
                    {isMainAdmin && <span className="badge badge-purple" style={{ fontSize: '10px' }}>Admin</span>}
                    {isSubAdmin && <span className="badge badge-purple" style={{ fontSize: '10px' }}>Sub-Admin</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="badge badge-purple" style={{ fontSize: '11px' }}>{MONTHS[month - 1]} {year}</span>
                    {msg && <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 500 }}>{msg}</span>}
                    <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', fontFamily: 'monospace', letterSpacing: '0.1em' }} onClick={copyCode}>
                        {code} 📋
                    </button>
                </div>
            </nav>

            {/* Month Side Panel */}
            {monthPanelOpen && (
                <>
                    <div
                        onClick={() => setMonthPanelOpen(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 49 }}
                    />
                    <div
                        className="fade-in"
                        style={{
                            position: 'fixed', top: 0, left: 0, bottom: 0, width: '260px', maxWidth: '80vw',
                            background: 'var(--bg-card)', borderRight: '1px solid var(--border-bright)',
                            zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '4px 0 30px rgba(0,0,0,0.5)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>Select Month</span>
                            <button
                                onClick={() => setMonthPanelOpen(false)}
                                aria-label="Close month picker"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div ref={monthSliderRef} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', overflowY: 'auto' }}>
                            {monthOptions.map(opt => (
                                <button
                                    key={`${opt.month}-${opt.year}`}
                                    className={`month-pill ${opt.month === month && opt.year === year ? 'active' : ''}`}
                                    style={{ width: '100%', textAlign: 'left' }}
                                    onClick={() => { setMonth(opt.month); setYear(opt.year); setMonthPanelOpen(false); }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key as any)}
                            style={{
                                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                                background: activeTab === t.key ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.05)',
                                color: activeTab === t.key ? 'white' : 'var(--text-muted)',
                                boxShadow: activeTab === t.key ? '0 2px 10px rgba(99,102,241,0.3)' : 'none',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                    {hasAdminPowers && (
                        <button
                            className="btn-danger"
                            style={{ marginLeft: 'auto', fontSize: '12px', padding: '8px 16px' }}
                            onClick={() => setConfirmDeleteMonth(true)}
                        >
                            🗑️ Delete Month
                        </button>
                    )}
                </div>

                {/* Table Card */}
                <div className="card fade-in" style={{ overflowX: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h2 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                            {TABS.find(t => t.key === activeTab)?.label} — {MONTHS[month - 1]} {year}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {members.map((m: any) => (
                                <span key={m.userId} className="badge badge-purple" style={{ fontSize: '10px' }}>{m.name}</span>
                            ))}
                        </div>
                    </div>

                    {activeTab === 'summary' && <SummarySection roomId={room._id} members={members} month={month} year={year} />}
                    {activeTab === 'bazar' && <BazarTable roomId={room._id} members={members} month={month} year={year} isAdmin={hasAdminPowers} editPerm={room.editPermission} currentUserId={currentUserId} />}
                    {activeTab === 'meal' && <MealTable roomId={room._id} members={members} month={month} year={year} isAdmin={hasAdminPowers} editPerm={room.editPermission} currentUserId={currentUserId} />}
                    {activeTab === 'rent' && <RentTable roomId={room._id} members={members} month={month} year={year} isAdmin={hasAdminPowers} editPerm={room.editPermission} currentUserId={currentUserId} />}
                    {activeTab === 'costs' && <SharedCostTable roomId={room._id} members={members} month={month} year={year} isAdmin={hasAdminPowers} editPerm={room.editPermission} />}

                    {activeTab === 'settings' && hasAdminPowers && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px' }}>Edit Permissions</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>Control who can edit data in this room.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {[
                                        { val: 'all', label: '👥 Everyone can edit', desc: 'All members can edit any column' },
                                        { val: 'owner', label: '🔒 Column owners only', desc: 'Each member can only edit their own column' },
                                        { val: 'admin', label: '👑 Admin only', desc: 'Only you (admin) can edit all data' },
                                    ].map(opt => (
                                        <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${room.editPermission === opt.val ? 'var(--accent)' : 'var(--border)'}`, background: room.editPermission === opt.val ? 'rgba(99,102,241,0.08)' : 'transparent', transition: 'all 0.2s' }}>
                                            <input type="radio" name="perm" value={opt.val} checked={room.editPermission === opt.val} onChange={() => updatePermission(opt.val)} style={{ accentColor: 'var(--accent)' }} />
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{opt.label}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{opt.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px' }}>Members</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {members.map((m: any) => {
                                        const memberId = m.userId?.toString?.() || m.userId;
                                        const isThisMainAdmin = room.adminId?.toString?.() === memberId || room.adminId === memberId;
                                        const isThisSubAdmin = !!room.subAdminId && (room.subAdminId?.toString?.() === memberId || room.subAdminId === memberId);
                                        return (
                                            <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                                <div>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{m.name}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>{m.email}</span>
                                                </div>
                                                {isThisMainAdmin ? (
                                                    <span className="badge badge-purple">Admin</span>
                                                ) : isThisSubAdmin ? (
                                                    <span className="badge badge-purple">Sub-Admin</span>
                                                ) : (
                                                    <span className="badge" style={{ background: 'rgba(71,85,105,0.2)', color: 'var(--text-secondary)' }}>Member</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sub-admin appointment — main admin only. Sub-admin cannot
                  see or use this control, by design, so this whole block
                  is gated on isMainAdmin rather than hasAdminPowers. */}
                            {isMainAdmin && (
                                <div>
                                    <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px' }}>Sub-Admin</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>
                                        Give one member admin-level access (edit permissions, delete entries, delete month data). Only you can change this.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {members
                                            .filter((m: any) => {
                                                const memberId = m.userId?.toString?.() || m.userId;
                                                return memberId !== (room.adminId?.toString?.() || room.adminId);
                                            })
                                            .map((m: any) => {
                                                const memberId = m.userId?.toString?.() || m.userId;
                                                const isCurrentSubAdmin = !!room.subAdminId && (room.subAdminId?.toString?.() === memberId || room.subAdminId === memberId);
                                                return (
                                                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '8px', background: isCurrentSubAdmin ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isCurrentSubAdmin ? 'var(--accent)' : 'var(--border)'}` }}>
                                                        <div>
                                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{m.name}</span>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>{m.email}</span>
                                                        </div>
                                                        {isCurrentSubAdmin ? (
                                                            <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => assignSubAdmin(null)}>
                                                                Remove Sub-Admin
                                                            </button>
                                                        ) : (
                                                            <button className="btn-primary" style={{ width: 'auto', fontSize: '12px', padding: '6px 14px' }} onClick={() => assignSubAdmin(memberId)}>
                                                                Make Sub-Admin
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        {members.length <= 1 && (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>Invite more roommates to assign a sub-admin.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Password reset — main admin only, same restriction as
                  sub-admin appointment. No OTP/email flow needed for a
                  small mess; admin just sets the new password directly. */}
                            {isMainAdmin && (
                                <div>
                                    <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px' }}>Reset a Member's Password</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>
                                        Set a new password for someone who's forgotten theirs. Only you can do this.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {members.map((m: any) => {
                                            const memberId = m.userId?.toString?.() || m.userId;
                                            return (
                                                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                                    <div>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{m.name}</span>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>{m.email}</span>
                                                    </div>
                                                    <button
                                                        className="btn-ghost"
                                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                                        onClick={() => { setResetPasswordTarget({ userId: memberId, name: m.name }); setNewPasswordValue(''); setResetPasswordError(''); setShowNewPassword(false); }}
                                                    >
                                                        Reset Password
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {resetPasswordTarget && (
                                <div className="modal-overlay">
                                    <div className="modal fade-in">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                                            </div>
                                            <div>
                                                <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px' }}>Reset Password</h3>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Set a new password for {resetPasswordTarget.name}</p>
                                            </div>
                                        </div>

                                        {resetPasswordError && <div className="alert alert-error" style={{ marginBottom: '14px' }}>{resetPasswordError}</div>}

                                        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Password</label>
                                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                className="input-dark"
                                                placeholder="••••••••"
                                                value={newPasswordValue}
                                                onChange={e => setNewPasswordValue(e.target.value)}
                                                style={{ paddingRight: '42px' }}
                                                autoFocus
                                                onKeyDown={e => { if (e.key === 'Enter') submitPasswordReset(); }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(s => !s)}
                                                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}
                                            >
                                                {showNewPassword ? (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                                ) : (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                )}
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                            <button className="btn-ghost" onClick={() => { setResetPasswordTarget(null); setNewPasswordValue(''); setResetPasswordError(''); }} disabled={resetPasswordSaving}>
                                                Cancel
                                            </button>
                                            <button className="btn-primary" style={{ width: 'auto' }} onClick={submitPasswordReset} disabled={resetPasswordSaving || newPasswordValue.length < 6}>
                                                {resetPasswordSaving ? 'Saving...' : 'Set New Password'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px' }}>Invite Code</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 700, color: 'var(--accent-bright)', letterSpacing: '0.2em' }}>{code}</span>
                                    <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={copyCode}>Copy</button>
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>Share this code with your roommates to invite them.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
