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
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } }, { new: true })

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



const changeCurrentUserPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body

    if (newPassword !== confirmPassword) {
        throw new apiError(400, "New password and confirm password do not match");
    }

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordMatch(oldPassword)

    if (!isPasswordCorrect) {
        throw new apiError(400, "Invalid old password");
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(new apiResponse(200, "Password changed successfully", {}))
})


const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new apiResponse(200, "Current user fetched successfully", req.user))
})

const updateCurrentUser = asyncHandler(async (req, res) => {
    const { username, email } = req.body

    if (!username || !email) {
        throw new apiError(400, "Username and email are required");
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: { username, email } }, { new: true }).select("-password")

    return res.status(200).json(new apiResponse(200, "Current user updated successfully", updatedUser))
})


const updateCurrentUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = await req.file?.path;

    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar is required");
    }

    const avatar = await uploadCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new apiError(400, "Failed to upload avatar");
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: { avatar: avatar.url } }, { new: true }).select("-password")

    return res.status(200).json(new apiResponse(200, "Avatar updated successfully", updatedUser))
})


const updateCurrentUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = await req.file?.path;

    if (!coverImageLocalPath) {
        throw new apiError(400, "Cover image is required");
    }

    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new apiError(400, "Failed to upload cover image");
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: { coverImage: coverImage.url } }, { new: true }).select("-password")

    return res.status(200).json(new apiResponse(200, "Cover image updated successfully", updatedUser))
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = await req.params

    if (!username.trim()) {
        throw new apiError(400, "Username is required");
    }

    const channel = await User.aggregate([
        { $match: { username: username?.toLowerCase() } },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                subscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true, else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullname: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new apiError(404, "Channel not found");
    }

    return res
        .status(200)
        .json(new apiResponse(200, "Channel profile fetched successfully", channel[0]))
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullname: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    }
                ]
            }
        }

    ])

    if (!user?.length) {
        throw new apiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new apiResponse(200, "Watch history fetched successfully", user[0].watchHistory))
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentUserPassword, getCurrentUser, updateCurrentUser, updateCurrentUserAvatar, updateCurrentUserCoverImage, getUserChannelProfile, getWatchHistory }