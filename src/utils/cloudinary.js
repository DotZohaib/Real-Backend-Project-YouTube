import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadCloudinary = async (filePath) => {
    try {

        if (!filePath) {
            throw new Error('File path is required for uploading to Cloudinary');
        }
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'public/images',
        });
        fs.unlinkSync(filePath); // Clean up the local file after successful upload
        return result;
    } catch (error) {
        fs.unlinkSync(filePath); // Clean up the local file after upload attempt
        console.error('Error uploading to Cloudinary:', error);
        throw error;
    }
}

export { uploadCloudinary };