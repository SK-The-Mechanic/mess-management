import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Bazar from '@/models/Bazar';
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
        const data = await Bazar.find({ roomId, month: Number(month), year: Number(year) }).sort({ date: 1 });
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
        const { roomId, amount, date, month, year, note } = body;

        await connectDB();
        const room = await Room.findById(roomId);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const sessionUserId = (session.user as any).id;
        const isAdmin = room.adminId.toString() === sessionUserId || room.subAdminId?.toString() === sessionUserId;

        // Permission check
        const perm = room.editPermission;
        if (perm === 'admin' && !isAdmin)
            return NextResponse.json({ error: 'Only admin can add entries' }, { status: 403 });

        // Use targetUserId from body if admin, or if everyone-can-edit is on, else own ID
        const canTargetOthers = isAdmin || perm === 'all';
        const targetUserId = canTargetOthers && body.userId ? body.userId : sessionUserId;
        const member = room.members.find((m: any) => m.userId.toString() === targetUserId);
        if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

        const entry = await Bazar.findOneAndUpdate(
            { roomId, userId: targetUserId, date: Number(date), month: Number(month), year: Number(year) },
            { $set: { amount: Number(amount), userName: member.name, note: note || '' } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return NextResponse.json({ entry }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const entryId = searchParams.get('id');
        const roomId = searchParams.get('roomId');

        await connectDB();
        const room = await Room.findById(roomId);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const userId = (session.user as any).id;
        const isAdmin = room.adminId.toString() === userId || room.subAdminId?.toString() === userId;
        if (!isAdmin) return NextResponse.json({ error: 'Only admin can delete entries' }, { status: 403 });

        await Bazar.findByIdAndDelete(entryId);
        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}