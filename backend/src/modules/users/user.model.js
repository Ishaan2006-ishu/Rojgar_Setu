import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    capabilities: {
      type: [
        {
          type: String,
          enum: ['worker', 'employer'],
        },
      ],
      required: true,
      validate: {
        validator: (capabilities) => capabilities.length > 0,
        message: 'At least one capability is required',
      },
    },
  },
  { timestamps: true },
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

const User = mongoose.model('User', userSchema);

export default User;
