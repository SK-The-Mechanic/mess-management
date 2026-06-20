import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import SharedCost from '@/models/SharedCost';
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
        const data = await SharedCost.find({ roomId, month: Number(month), year: Number(year) });
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
        const { roomId, name, amount, month, year } = body;

        await connectDB();
        const room = await Room.findById(roomId);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const userId = (session.user as any).id;
        const isAdmin = room.adminId.toString() === userId || room.subAdminId?.toString() === userId;
        if (room.editPermission === 'admin' && !isAdmin)
            return NextResponse.json({ error: 'Only admin can edit shared costs' }, { status: 403 });

        const entry = await SharedCost.findOneAndUpdate(
            { roomId, name, month: Number(month), year: Number(year) },
            { amount: Number(amount) },
            { upsert: true, new: true }
        );

        return NextResponse.json({ entry });
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
        if (!isAdmin)
            return NextResponse.json({ error: 'Only admin can delete' }, { status: 403 });

        await SharedCost.findByIdAndDelete(entryId);
        return NextResponse.json({ message: 'Deleted' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
