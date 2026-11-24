import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const workerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    occupation: { type: String, required: true, trim: true },
    skills: {
      type: [{ type: String, trim: true }],
      required: true,
      validate: {
        validator: (skills) =>
          skills.length > 0 && skills.every((skill) => skill.length > 0),
        message: 'At least one skill is required',
      },
    },
    experienceYears: { type: Number, min: 0, default: 0 },
    expectedCompensation: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, default: 'INR', trim: true },
      unit: {
        type: String,
        enum: ['hour', 'day', 'month', 'job'],
        default: 'day',
      },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) =>
            coordinates.length === 2 &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90,
          message: 'Location coordinates must be valid longitude and latitude',
        },
      },
      area: { type: String, trim: true },
      city: { type: String, trim: true },
    },
    preferredRadiusKm: { type: Number, min: 1, default: 10 },
    availability: { type: [availabilitySchema], default: [] },
    bio: { type: String, maxlength: 500, trim: true },
    profileStatus: {
      type: String,
      enum: ['draft', 'active', 'paused'],
      default: 'active',
    },
  },
  { timestamps: true },
);

workerSchema.index({ location: '2dsphere' });

const WorkerProfile = mongoose.model('WorkerProfile', workerSchema);

export default WorkerProfile;
