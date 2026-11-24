import mongoose from 'mongoose';

const employerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    employerType: {
      type: String,
      enum: ['individual', 'business'],
      required: true,
    },
    displayName: { type: String, required: true, trim: true },
    businessCategory: { type: String, trim: true },
    description: { type: String, maxlength: 500, trim: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (coordinates) =>
            coordinates === undefined ||
            (coordinates.length === 2 &&
              coordinates[0] >= -180 &&
              coordinates[0] <= 180 &&
              coordinates[1] >= -90 &&
              coordinates[1] <= 90),
          message: 'Location coordinates must be valid longitude and latitude',
        },
      },
      area: { type: String, trim: true },
      city: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active',
    },
  },
  { timestamps: true },
);

employerSchema.index(
  { location: '2dsphere' },
  { partialFilterExpression: { 'location.coordinates': { $exists: true } } },
);

const EmployerProfile = mongoose.model('EmployerProfile', employerSchema);

export default EmployerProfile;
