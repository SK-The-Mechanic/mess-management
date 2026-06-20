import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Rent from '@/models/Rent';
import Room from '@/models/Room';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const roomId = searchParams.get('roomId');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        await connectDB();
        const data = await Rent.find({ roomId, month: Number(month), year: Number(year) });
        return NextResponse.json({ data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { roomId, userId: targetUserId, payable, paid, month, year } = body;

        await connectDB();
        const room = await Room.findById(roomId);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const sessionUserId = (session.user as any).id;
        const isAdmin = room.adminId.toString() === sessionUserId || room.subAdminId?.toString() === sessionUserId;
        const perm = room.editPermission;

        if (perm === 'admin' && !isAdmin)
            return NextResponse.json({ error: 'Only admin can edit rent' }, { status: 403 });
        if (perm === 'owner' && !isAdmin && targetUserId !== sessionUserId)
            return NextResponse.json({ error: 'You can only edit your own rent' }, { status: 403 });

        const member = room.members.find((m: any) => m.userId.toString() === targetUserId);
        if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

        const entry = await Rent.findOneAndUpdate(
            { roomId, userId: targetUserId, month: Number(month), year: Number(year) },
            { userName: member.name, payable: Number(payable), paid: Number(paid) },
            { upsert: true, new: true }
        );

        return NextResponse.json({ entry });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
