export function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      resolve(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let w = img.width,
        h = img.height;
      if (w <= maxWidth) {
        resolve(file);
        return;
      }
      h = Math.round(h * (maxWidth / w));
      w = maxWidth;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          resolve(
            blob && blob.size < file.size
              ? new File([blob], file.name, { type: "image/webp" })
              : file
          );
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
