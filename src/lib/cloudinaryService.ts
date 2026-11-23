import "server-only";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadFileBufferToCloudinary(
  file: File
): Promise<{ secureUrl: string; kind: string; filename: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const isImage = file.type.startsWith("image/");
  const isAudioVideo = file.type.startsWith("audio/") || file.type.startsWith("video/");
  const resourceType = isImage ? "image" : isAudioVideo ? "video" : "raw";
  const lastDot = file.name.lastIndexOf(".");
  const fileExtension = lastDot !== -1 ? file.name.substring(lastDot) : "";
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const publicId = `${uniqueId}${fileExtension}`;

  const uploadResult = (await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "taskflow_uploads",
        resource_type: resourceType,
        public_id: publicId,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(bytes);
  })) as any;

  return {
    secureUrl: uploadResult.secure_url,
    kind: isImage ? "IMAGE" : "FILE",
    filename: file.name || "upload",
  };
}
