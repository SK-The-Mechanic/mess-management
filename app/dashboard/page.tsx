'use client';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') fetchRooms();
  }, [status]);

  const fetchRooms = async () => {
    const res = await fetch('/api/room');
    const data = await res.json();
    setRooms(data.rooms || []);
    setLoading(false);
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    setErr(''); setMsg('');
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roomName }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setMsg(`Room created! Invite code: ${data.room.inviteCode}`);
    setRoomName(''); setShowCreate(false);
    fetchRooms();
  };

  const joinRoom = async () => {
    if (!inviteCode.trim()) return;
    setErr(''); setMsg('');
    const res = await fetch(`/api/room/${inviteCode.toUpperCase()}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setMsg(data.message || 'Joined!');
    setInviteCode(''); setShowJoin(false);
    fetchRooms();
  };

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0a12 100%)' }}>
      {/* Navbar */}
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>MessTrack</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{session?.user?.name}</span>
          <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Your Rooms 🏠
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage your mess expense rooms</p>
        </div>

        {msg && <div className="alert alert-success fade-in" style={{ marginBottom: '16px' }}>{msg}</div>}
        {err && <div className="alert alert-error fade-in" style={{ marginBottom: '16px' }}>{err}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
          <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => { setShowCreate(true); setShowJoin(false); }}>
            + Create Room
          </button>
          <button className="btn-ghost" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
            Join with Code
          </button>
        </div>

        {/* Create/Join forms */}
        {showCreate && (
          <div className="card fade-in" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '14px', color: 'var(--text-primary)' }}>Create New Room</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input className="input-dark" placeholder="Room name (e.g. Block C Mess)" value={roomName} onChange={e => setRoomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createRoom()} />
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px', whiteSpace: 'nowrap' }} onClick={createRoom}>Create</button>
              <button className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showJoin && (
          <div className="card fade-in" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '14px', color: 'var(--text-primary)' }}>Join a Room</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input className="input-dark" placeholder="Enter invite code (e.g. AB3X7K)" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }} onKeyDown={e => e.key === 'Enter' && joinRoom()} />
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px', whiteSpace: 'nowrap' }} onClick={joinRoom}>Join</button>
              <button className="btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Rooms list */}
        {rooms.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏠</div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>No rooms yet</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Create a room or join one with an invite code</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '14px' }}>
            {rooms.map((room: any) => {
              const isAdmin = room.adminId === (session?.user as any)?.id || room.adminId?.toString() === (session?.user as any)?.id;
              return (
                <div
                  key={room._id}
                  className="card"
                  style={{ cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onClick={() => router.push(`/room/${room.inviteCode}`)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🏠</div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{room.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', letterSpacing: '0.1em', color: 'var(--accent-bright)' }}>{room.inviteCode}</span>
                        <span>{room.members?.length} member{room.members?.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isAdmin && <span className="badge badge-purple">Admin</span>}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
