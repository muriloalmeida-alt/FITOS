/// Reduz a foto no próprio aparelho antes do envio (EPIC-35): uma foto de
/// celular de 4–12 MB vira um JPEG de algumas centenas de KB. Respeita a
/// orientação da câmera (EXIF). `square` recorta o centro (foto de perfil).
export async function resizeImage(file: Blob, options: { max: number; square?: boolean; quality?: number }): Promise<{ blob: Blob; width: number; height: number }> {
  const source = await loadImage(file);
  const srcW = "naturalWidth" in source ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!srcW || !srcH) throw new Error("Não foi possível ler a foto.");

  const crop = options.square ? Math.min(srcW, srcH) : null;
  const sx = crop ? (srcW - crop) / 2 : 0;
  const sy = crop ? (srcH - crop) / 2 : 0;
  const sw = crop ?? srcW;
  const sh = crop ?? srcH;
  const scale = Math.min(1, options.max / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto.");
  context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", options.quality ?? 0.85));
  if (!blob) throw new Error("Não foi possível preparar a foto.");
  return { blob, width, height };
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Alguns navegadores não decodificam HEIC/opções; cai para <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new Error("Não foi possível abrir esta foto. Tente outra.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
