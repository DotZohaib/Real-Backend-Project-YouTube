import { asyncHandler } from '../utils/asyncHandler.js';
import { apiError } from '../utils/apiError.js';
import { User } from '../models/user.model.js';
import { uploadCloudinary } from '../utils/cloudinary.js';
import { apiResponse } from '../utils/apiResponse.js';
import jwt from 'jsonwebtoken';


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({
            validateBeforeSave: false
        })

        return { accessToken, refreshToken }


    } catch (error) {
        throw new apiError(500, "Failed to generate tokens");
    }
}


const registerUser = asyncHandler(async (req, res) => {
    const { username, fullname, email, password } = req.body;


    if (
        [
            fullname, username, email, password
        ].some((field) => field?.trim() === "")
    ) {
        throw new apiError(400, "All fields are required");
    }

    const existUser = await User.findOne({ email })

    if (existUser) {
        throw new apiError(409, "User already exist");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar is required");
    }
    if (!coverImageLocalPath) {
        throw new apiError(400, "Cover image is required");
    }

    const avatar = await uploadCloudinary(avatarLocalPath)
    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new apiError(400, "Avatar is required");
    }
    if (!coverImage) {
        throw new apiError(400, "Cover image is required");
    }

    const user = await User.create({
        username,
        fullname,
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage.url
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new apiError(500, "Failed to create user");
    }

    return res.status(201).json(new apiResponse(201, "User registered successfully", createdUser))
});


const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (
        [email, password].some((field) => field?.trim() === "")
    ) {
        throw new apiError(400, "All fields are required");
    }

    const user = await User.findOne({ email })

    if (!user) {
        throw new apiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordMatch(password)

    if (!isPasswordValid) {
        throw new apiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new apiResponse(200, "User logged in successfully", { user: loggedInUser, accessToken, refreshToken }))


})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: undefined } }, { new: true })

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new apiResponse(200, "User logOut successfully", {}))

})


const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if (!incomingRefreshToken) {
            throw new apiError(400, "Refresh token is required");
        }

        const decodedRefreshToken = await jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedRefreshToken._id)

        if (!user) {
            throw new apiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "Refresh token expires, please login again");
        }

        const options = {
            httpOnly: true,
            secure: true,
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new apiResponse(200, "Access token refreshed successfully", { accessToken, newRefreshToken }))

    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token");
    }

})


export { registerUser, loginUser, logoutUser, refreshAccessToken }