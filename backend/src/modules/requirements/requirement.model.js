import mongoose from 'mongoose';

export const WORK_TYPES = ['permanent', 'part_time', 'on_demand', 'short_term'];
export const PRICING_METHODS = ['fixed', 'open_to_offers', 'negotiable'];
export const PAY_UNITS = ['hour', 'day', 'month', 'job'];
export const REQUIREMENT_STATUSES = ['draft', 'open', 'paused', 'filled', 'closed'];
// Statuses in which the employer can no longer edit the requirement.
export const LOCKED_STATUSES = ['filled', 'closed'];

const workLocationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
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
        message: 'Work location must contain valid longitude and latitude',
      },
    },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
  },
  { _id: false },
);

const scheduleSchema = new mongoose.Schema(
  {
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationHours: { type: Number, min: 0 },
  },
  { _id: false },
);

const pricingSchema = new mongoose.Schema(
  {
    method: { type: String, enum: PRICING_METHODS, required: true },
    // Money is stored as integer minor units (paise) to avoid float errors.
    amountMinor: {
      type: Number,
      min: 1,
      validate: {
        validator: (value) => value === undefined || Number.isInteger(value),
        message: 'Amount must be an integer number of minor units',
      },
    },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },
    unit: { type: String, enum: PAY_UNITS },
  },
  { _id: false },
);

const requirementSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployerProfile',
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    occupation: { type: String, required: true, trim: true, maxlength: 100 },
    requiredSkills: { type: [{ type: String, trim: true }], default: [] },
    workType: { type: String, enum: WORK_TYPES, required: true },
    workLocation: { type: workLocationSchema, required: true },
    schedule: { type: scheduleSchema, required: true },
    vacanciesTotal: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Vacancies must be an integer' },
    },
    vacanciesFilled: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator(value) {
          return Number.isInteger(value) && value <= this.vacanciesTotal;
        },
        message: 'Filled vacancies cannot exceed total vacancies',
      },
    },
    pricing: { type: pricingSchema, required: true },
    status: { type: String, enum: REQUIREMENT_STATUSES, default: 'open' },
    closedAt: { type: Date },
    closeReason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

requirementSchema.index({ workLocation: '2dsphere' });
requirementSchema.index({ employerId: 1, status: 1, createdAt: -1 });
requirementSchema.index({ status: 1, occupation: 1, createdAt: -1 });
requirementSchema.index({ requiredSkills: 1 });

const Requirement = mongoose.model('Requirement', requirementSchema);

export default Requirement;
