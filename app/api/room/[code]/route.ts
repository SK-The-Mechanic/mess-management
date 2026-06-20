import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import User from '@/models/User';

// Join room by invite code
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const user = await User.findById((session.user as any).id);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const room = await Room.findOne({ inviteCode: code.toUpperCase() });
        if (!room) return NextResponse.json({ error: 'Room not found. Check invite code.' }, { status: 404 });

        const alreadyMember = room.members.some((m: any) => m.userId.toString() === user._id.toString());
        if (alreadyMember) return NextResponse.json({ room, message: 'Already a member' });

        room.members.push({ userId: user._id, name: user.name, email: user.email, role: 'member' });
        await room.save();

        return NextResponse.json({ room, message: 'Joined successfully!' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// Get room by code
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const room = await Room.findOne({ inviteCode: code.toUpperCase() });
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const isMember = room.members.some((m: any) => m.userId.toString() === (session.user as any).id);
        if (!isMember) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

        return NextResponse.json({ room });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// Update room settings — editPermission: main admin or sub-admin.
// subAdminId (appoint/remove sub-admin): main admin ONLY, always.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { editPermission, subAdminId } = body;
        await connectDB();

        const room = await Room.findOne({ inviteCode: code.toUpperCase() });
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const userId = (session.user as any).id;
        const isMainAdmin = room.adminId.toString() === userId;
        const isSubAdmin = !!room.subAdminId && room.subAdminId.toString() === userId;

        if (editPermission !== undefined) {
            if (!isMainAdmin && !isSubAdmin)
                return NextResponse.json({ error: 'Only an admin can change settings' }, { status: 403 });
            room.editPermission = editPermission;
        }

        // Appointing/removing a sub-admin is reserved for the main admin only —
        // a sub-admin must never be able to appoint another sub-admin or swap
        // themselves out, regardless of any other power they hold.
        if (subAdminId !== undefined) {
            if (!isMainAdmin)
                return NextResponse.json({ error: 'Only the main admin can manage the sub-admin' }, { status: 403 });

            if (subAdminId === null) {
                room.subAdminId = null;
            } else {
                if (subAdminId === room.adminId.toString())
                    return NextResponse.json({ error: 'Main admin cannot be set as sub-admin' }, { status: 400 });
                const isTargetMember = room.members.some((m: any) => m.userId.toString() === subAdminId);
                if (!isTargetMember)
                    return NextResponse.json({ error: 'Selected user is not a member of this room' }, { status: 400 });
                room.subAdminId = subAdminId;
            }
        }

        await room.save();
        return NextResponse.json({ room });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
