/**
 * Utility functions for client-side image reading, downscaling, and compression.
 */

/**
 * Safely reads a File into a base64 Data URL.
 * If the image exceeds maxDimension (default 1600px), it is proportionally downscaled
 * on an offscreen HTML5 canvas to prevent memory bloat and UI freezing on mobile devices.
 * 
 * Note: Never clear file input value synchronously before this promise resolves.
 */
export async function readFileAsDataUrl(file: File, maxDimension = 1600): Promise<string> {
  if (!file) {
    throw new Error('ไม่พบไฟล์ที่เลือก');
  }

  // Basic MIME check if available
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์ที่เป็นรูปภาพเท่านั้น (เช่น JPG, PNG, WebP)');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string' || !result) {
        reject(new Error('ไม่สามารถอ่านข้อมูลรูปภาพได้'));
        return;
      }

      // If file is already small (< 500KB), return directly
      if (file.size < 500 * 1024) {
        resolve(result);
        return;
      }

      // If larger than 500KB, load into offscreen Image to check dimensions
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          // If within bounds, return original
          if (width <= maxDimension && height <= maxDimension && file.size < 1024 * 1024) {
            resolve(result);
            return;
          }

          // Downscale proportionally to fit inside maxDimension x maxDimension
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          // Fill white background for transparency safety in JPEG
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const downscaled = canvas.toDataURL('image/jpeg', 0.88);
          resolve(downscaled);
        } catch {
          // Fallback to original result if canvas fails
          resolve(result);
        }
      };

      img.onerror = () => {
        // Fallback to original result
        resolve(result);
      };

      img.src = result;
    };

    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์รูปภาพ กรุณาลองใหม่อีกครั้ง'));
    };

    reader.onabort = () => {
      reject(new Error('การอ่านรูปภาพถูกยกเลิก กรุณาลองใหม่อีกครั้ง'));
    };

    reader.readAsDataURL(file);
  });
}
