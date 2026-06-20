import mongoose, { Schema, Document } from 'mongoose';

export interface ISharedCost extends Document {
  roomId: mongoose.Types.ObjectId;
  name: string;
  amount: number;
  month: number;
  year: number;
}

const SharedCostSchema = new Schema<ISharedCost>({
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
}, { timestamps: true });

SharedCostSchema.index({ roomId: 1, month: 1, year: 1 });

export default mongoose.models.SharedCost || mongoose.model<ISharedCost>('SharedCost', SharedCostSchema);
