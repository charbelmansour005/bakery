import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const adminSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type AdminDoc = InferSchemaType<typeof adminSchema>;

const Admin =
  (mongoose.models.Admin as Model<AdminDoc>) ||
  mongoose.model<AdminDoc>("Admin", adminSchema);

export default Admin;
//test
