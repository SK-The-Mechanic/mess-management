import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import User from '@/models/User';

// Main admin sets a new password for any member of their room.
// Deliberately restricted to the main admin only (not sub-admin) —
// this is a sensitive power, kept separate from the rest of the
// sub-admin permission set.
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { roomId, targetUserId, newPassword } = await req.json();
        if (!roomId || !targetUserId || !newPassword)
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        if (typeof newPassword !== 'string' || newPassword.length < 6)
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

        await connectDB();
        const room = await Room.findById(roomId);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const sessionUserId = (session.user as any).id;
        if (room.adminId.toString() !== sessionUserId)
            return NextResponse.json({ error: 'Only the main admin can reset passwords' }, { status: 403 });

        const isMember = room.members.some((m: any) => m.userId.toString() === targetUserId);
        if (!isMember)
            return NextResponse.json({ error: 'That user is not a member of this room' }, { status: 400 });

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        targetUser.password = newPassword; // pre('save') hook hashes this automatically
        await targetUser.save();

        return NextResponse.json({ message: `Password updated for ${targetUser.name}` });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}