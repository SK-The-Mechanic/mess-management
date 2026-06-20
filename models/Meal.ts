import mongoose, { Schema, Document } from 'mongoose';

export interface IMeal extends Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  count: number;
  date: number;
  dayName: string;
  month: number;
  year: number;
}

const MealSchema = new Schema<IMeal>({
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  count: { type: Number, required: true, min: 0, max: 10 },
  date: { type: Number, required: true, min: 1, max: 31 },
  dayName: { type: String, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
}, { timestamps: true });

MealSchema.index({ roomId: 1, month: 1, year: 1 });
MealSchema.index({ roomId: 1, userId: 1, date: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.models.Meal || mongoose.model<IMeal>('Meal', MealSchema);
