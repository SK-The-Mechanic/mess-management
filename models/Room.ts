import mongoose, { Schema, Document } from 'mongoose';

export type EditPermission = 'admin' | 'owner' | 'all';

export interface IRoomMember {
    userId: mongoose.Types.ObjectId;
    name: string;
    email: string;
    role: 'admin' | 'member';
    joinedAt: Date;
}

export interface IRoom extends Document {
    name: string;
    inviteCode: string;
    adminId: mongoose.Types.ObjectId;
    subAdminId?: mongoose.Types.ObjectId | null;
    members: IRoomMember[];
    editPermission: EditPermission;
    createdAt: Date;
}

const RoomMemberSchema = new Schema<IRoomMember>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
});

const RoomSchema = new Schema<IRoom>({
    name: { type: String, required: true, trim: true },
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Exactly one sub-admin per room, appointed/removed only by adminId.
    // Sub-admin gets the same powers as the main admin, except they
    // cannot appoint or remove a sub-admin themselves.
    subAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    members: [RoomMemberSchema],
    editPermission: { type: String, enum: ['admin', 'owner', 'all'], default: 'all' },
}, { timestamps: true });

export default mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);
