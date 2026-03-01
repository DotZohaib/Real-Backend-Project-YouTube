import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userModel = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  fullname: {
    type: String,
    required: true,
    index: true,
  },
  avatar: {
    type: String,
    required: true,

  },
  coverImage: {
    type: String,
  },
  watchHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Video",
  }],
  password: {
    type: String,
    required: true,
    minlength: [6, "Password must be at least 6 characters long"],

  },
  refreshToken: {
    type: String,
  },

},
  { timestamps: true }

)


userModel.pre("save", async function () {
  if (!this.isModified("password")) return
  this.password = await bcrypt.hash(this.password, 10)

});

userModel.methods.isPasswordMatch = async function (password) {
  return await bcrypt.compare(password, this.password)
}


userModel.methods.generateAccessToken = async function () {
  return await jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullname: this.fullname,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  )
}
userModel.methods.generateRefreshToken = async function () {
  return await jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  )
 }

export const User = mongoose.model("User", userModel)