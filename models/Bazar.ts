import mongoose, { Schema, Document } from 'mongoose';

export interface IBazar extends Document {
    roomId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    userName: string;
    amount: number;
    date: number;
    month: number;
    year: number;
    note?: string;
    createdAt: Date;
}

const BazarSchema = new Schema<IBazar>({
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Number, required: true, min: 1, max: 31 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    note: { type: String, default: '' },
}, { timestamps: true });

// Compound index for fast querying
BazarSchema.index({ roomId: 1, month: 1, year: 1 });
// Unique: one bazar entry per member, per day, per month — prevents
// duplicate rows from double-submits (e.g. pressing Enter twice).
BazarSchema.index({ roomId: 1, userId: 1, date: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.models.Bazar || mongoose.model<IBazar>('Bazar', BazarSchema);
