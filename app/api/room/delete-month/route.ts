import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Bazar from '@/models/Bazar';
import Meal from '@/models/Meal';
import Rent from '@/models/Rent';
import SharedCost from '@/models/SharedCost';

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const roomId = searchParams.get('roomId');
        const month = Number(searchParams.get('month'));
        const year = Number(searchParams.get('year'));

        await connectDB();
        const room = await Room.findById(roomId);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const userId = (session.user as any).id;
        const hasAdminPowers = room.adminId.toString() === userId || room.subAdminId?.toString() === userId;
        if (!hasAdminPowers)
            return NextResponse.json({ error: 'Only an admin can delete month data' }, { status: 403 });

        await Promise.all([
            Bazar.deleteMany({ roomId, month, year }),
            Meal.deleteMany({ roomId, month, year }),
            Rent.deleteMany({ roomId, month, year }),
            SharedCost.deleteMany({ roomId, month, year }),
        ]);

        return NextResponse.json({ message: `All data for month ${month}/${year} deleted successfully` });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
