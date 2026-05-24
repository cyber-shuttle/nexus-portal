import html2canvas from "html2canvas-pro";

export async function captureViewport(): Promise<Blob> {
  await document.fonts.ready;
  const canvas = await html2canvas(document.body, {
    backgroundColor: null,
    useCORS: true,
    scale: window.devicePixelRatio,
    logging: false,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    ignoreElements: (el) =>
      el.hasAttribute?.("data-feedback-ignore") ||
      el.closest?.("[data-feedback-ignore]") !== null,
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob returned null"));
    }, "image/png");
  });
}
