import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Meal from '@/models/Meal';
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
        const data = await Meal.find({ roomId, month: Number(month), year: Number(year) }).sort({ date: 1 });
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
        const { roomId, count, date, dayName, month, year, targetUserId } = body;

        await connectDB();
        const room = await Room.findById(roomId);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const userId = (session.user as any).id;
        const isAdmin = room.adminId.toString() === userId || room.subAdminId?.toString() === userId;
        const perm = room.editPermission;

        // Determine who we're saving for
        const targetId = targetUserId || userId;
        const targetMember = room.members.find((m: any) => m.userId.toString() === targetId);
        if (!targetMember) return NextResponse.json({ error: 'Target user not found in room' }, { status: 404 });

        // Permission check
        if (perm === 'admin' && !isAdmin)
            return NextResponse.json({ error: 'Only admin can edit' }, { status: 403 });
        if (perm === 'owner' && !isAdmin && targetId !== userId)
            return NextResponse.json({ error: 'You can only edit your own column' }, { status: 403 });

        const existing = await Meal.findOne({ roomId, userId: targetId, date: Number(date), month: Number(month), year: Number(year) });

        if (existing) {
            existing.count = Number(count);
            existing.dayName = dayName;
            await existing.save();
            return NextResponse.json({ entry: existing });
        }

        const entry = await Meal.create({
            roomId, userId: targetId, userName: targetMember.name,
            count: Number(count), date: Number(date), dayName,
            month: Number(month), year: Number(year),
        });

        return NextResponse.json({ entry }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
