import mongoose, { Schema, Document } from 'mongoose';

export interface IRent extends Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  payable: number;
  paid: number;
  month: number;
  year: number;
}

const RentSchema = new Schema<IRent>({
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  payable: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
}, { timestamps: true });

RentSchema.index({ roomId: 1, month: 1, year: 1 });
RentSchema.index({ roomId: 1, userId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.models.Rent || mongoose.model<IRent>('Rent', RentSchema);
