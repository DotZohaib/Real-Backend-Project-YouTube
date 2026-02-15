import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token = await req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        if (!token) {
            throw new apiError(401, "Unauthorized: No token provided");
        }

        const decodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken._id).select("-password -refreshToken")
        if (!user) {
            throw new apiError(401, "Invalid token: User not found");
        }
        req.user = user;
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        throw new apiError(401, "Unauthorized: Invalid token");
    }
})  