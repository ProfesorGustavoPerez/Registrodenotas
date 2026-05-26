import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface PDFProgress {
  current: number;
  total: number;
}

/**
 * Captures a list of DOM elements and converts them into a single PDF downloaded as 'filename'.
 * Each element is drawn on a separate Letter (Carta) sized page.
 */
export async function downloadElementsAsPDF(
  elements: HTMLElement[],
  filename: string,
  onProgress?: (progress: PDFProgress) => void
) {
  if (elements.length === 0) return;

  // Create a US Letter PDF document (portrait mode, millimeters)
  // US Letter is 8.5 x 11 inches, which is 215.9 x 279.4 mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
    compress: true
  });

  const total = elements.length;

  for (let i = 0; i < total; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total });
    }

    const element = elements[i];

    // We can use a clean high-resolution canvas capture.
    // Specifying scale 2 or 2.5 ensures print-quality crispness.
    const canvas = await html2canvas(element, {
      scale: 2.2, // Crisp high-definition render
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.clientWidth,
      windowHeight: element.clientHeight,
      ignoreElements: (el) => el.classList?.contains("no-print")
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    if (i > 0) {
      doc.addPage("letter", "portrait");
    }

    // Since the .ficha-page is designed to fit 21.59cm x 26.5cm+ dimensions,
    // we map it directly to the full 215.9 mm x 279.4 mm page.
    doc.addImage(imgData, "JPEG", 0, 0, 215.9, 279.4, undefined, "FAST");
  }

  doc.save(filename);
}
