import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  githubUsername: {
    type: String,
    trim: true,
    sparse: true
  },
  githubConnectedAt: {
    type: Date,
    default: null
  },
  profileUrl: {
    type: String,
    unique: true,
    sparse: true
  },
  contributions: {
    totalPoints: {
      type: Number,
      default: 0
    },
    repositories: [{
      name: String,
      owner: String,
      url: String,
      contributions: Number,
      points: Number,
      lastContribution: Date
    }],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to validate password
userSchema.methods.validatePassword = async function(plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

// Static method to generate JWT token
userSchema.statics.generateToken = function(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "24h" });
};

// Instance method to generate profile URL
userSchema.methods.generateProfileUrl = function() {
  if (!this.profileUrl) {
    this.profileUrl = `profile-${this._id.toString().slice(-8)}`;
  }
  return this.profileUrl;
};

// Instance method to update contributions
userSchema.methods.updateContributions = function(contributionData) {
  this.contributions = {
    ...this.contributions,
    ...contributionData,
    lastUpdated: new Date()
  };
  return this.save();
};

// Create User model
const User = mongoose.model('User', userSchema);

export default User;
