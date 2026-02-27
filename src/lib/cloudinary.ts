import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-utils";

const CLOUD_NAME = "djud8hb8d";

/**
 * Upload an image to Cloudinary via the edge function.
 * Returns the secure Cloudinary URL.
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = "ujebong/posts",
  options?: { maxWidth?: number; quality?: number }
): Promise<string> {
  const { maxWidth = 1080, quality = 0.75 } = options || {};
  
  // Compress client-side first
  const compressed = await compressImage(file, { maxWidth, quality });

  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("folder", folder);

  const { data, error } = await supabase.functions.invoke("cloudinary-upload", {
    body: formData,
  });

  if (error) throw new Error(error.message || "Upload failed");
  if (data?.error) throw new Error(data.error);
  
  return data.url;
}

/**
 * Get an optimized Cloudinary URL with transformations.
 * Applies auto quality, auto format, and optional width.
 */
export function getOptimizedUrl(url: string, options?: { width?: number; quality?: string }): string {
  if (!url) return "";
  
  // Only transform Cloudinary URLs
  if (!url.includes("res.cloudinary.com")) return url;
  
  const { width, quality = "auto" } = options || {};
  const transforms = [`q_${quality}`, "f_auto"];
  if (width) transforms.push(`w_${width}`);
  
  // Insert transformations into URL
  // Format: .../upload/TRANSFORMS/folder/file
  return url.replace("/upload/", `/upload/${transforms.join(",")}/`);
}

/**
 * Get a placeholder/thumbnail URL for lazy loading.
 */
export function getPlaceholderUrl(url: string): string {
  if (!url || !url.includes("res.cloudinary.com")) return "";
  return url.replace("/upload/", "/upload/w_50,q_10,e_blur:200,f_auto/");
}
