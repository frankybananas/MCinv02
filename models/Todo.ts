import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ITodo extends Document {
  user: Types.ObjectId;
  date: Date; // day-level granularity
  title: string;
  time?: string | null;
  order: number; // sort order within the date
  createdAt: Date;
  updatedAt: Date;
}

const TodoSchema = new Schema<ITodo>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  time: { type: String, trim: true, match: [/^\d{2}:\d{2}$/, 'HH:mm format'], default: null },
  order: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

TodoSchema.pre('save', function (this: ITodo, next) {
  this.updatedAt = new Date();
  next();
});

const Todo: Model<ITodo> = mongoose.models.Todo || mongoose.model<ITodo>('Todo', TodoSchema);
export default Todo;
