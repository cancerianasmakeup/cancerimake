import jsPDF from "jspdf";
import type { Remito } from "@/types/remito";

const CANCERIANAS_LOGO =
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/logo%20solo%20(1).png";

// Función para formatear precio con formato argentino
function formatPriceARG(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Función para cargar imagen como data URL
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    // Intentar fetch primero
    const response = await fetch(url, {
      headers: {
        "Accept": "image/*",
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch logo: ${response.status}`);
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => {
        console.warn("FileReader error");
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Error loading logo:", error);
    return null;
  }
}

export async function generateRemitoPDF(remito: Remito) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = 20;

  // ========================
  // CREAR LOGO Y WATERMARK
  // ========================
  let logoData: string | null = null;

  try {
    logoData = await loadImageAsDataUrl(CANCERIANAS_LOGO);
    if (logoData) {
      console.log("✓ Logo cargado exitosamente");
    } else {
      console.warn("⚠ No se pudo cargar el logo");
    }
  } catch (error) {
    console.warn("Error al cargar logo:", error);
  }

  // ========================
  // COLORES PROFESIONALES
  // ========================
  const colors = {
    roseDeep: [230, 107, 133],
    rosePrimary: [255, 143, 163],
    roseLight: [255, 229, 236],
    roseSoft: [255, 240, 244],
    inkPrimary: [61, 42, 51],
    inkSecondary: [92, 72, 83],
    gray: [155, 122, 130],
    white: [255, 255, 255],
  };

  // ========================
  // FUNCIÓN PARA AGREGAR WATERMARK
  // ========================
  const addWatermarkPage = () => {
    if (logoData) {
      try {
        doc.setGlobalAlpha(0.12);
        doc.addImage(
          logoData,
          "PNG",
          pageWidth / 2 - 40,
          pageHeight / 2 - 40,
          80,
          80
        );
        doc.setGlobalAlpha(1);
      } catch (error) {
        console.warn("Error adding watermark:", error);
      }
    }
  };

  // Agregar watermark a primera página
  addWatermarkPage();

  // ========================
  // DECORACIONES EN ESQUINAS
  // ========================
  doc.setFillColor(...colors.roseSoft);
  doc.circle(10, 8, 5, "F");
  doc.rect(18, 12, 7, 7, "F");
  doc.circle(pageWidth - 12, 15, 4, "F");
  doc.rect(pageWidth - 24, 8, 6, 6, "F");
  doc.circle(10, pageHeight - 15, 6, "F");
  doc.rect(22, pageHeight - 20, 7, 7, "F");
  doc.circle(pageWidth - 10, pageHeight - 12, 5, "F");
  doc.rect(pageWidth - 22, pageHeight - 18, 7, 7, "F");

  // ========================
  // HEADER PREMIUM CON LOGO
  // ========================

  // Fondo superior elegante
  doc.setFillColor(...colors.roseSoft);
  doc.rect(0, 0, pageWidth, 32, "F");

  // Logo en esquina superior izquierda
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, 4, 20, 20);
    } catch (error) {
      console.warn("Could not add logo to header:", error);
    }
  }

  // Info empresa lado derecho
  doc.setFontSize(11);
  doc.setTextColor(...colors.roseDeep);
  doc.setFont("helvetica", "bold");
  doc.text("CANCERIANAS", pageWidth - margin - 40, 8, { align: "left" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.inkSecondary);
  doc.text("Belleza & Moda Premium", pageWidth - margin - 40, 12, { align: "left" });
  doc.text("www.cancerianas.com", pageWidth - margin - 40, 15, { align: "left" });

  // Título REMITO
  doc.setFontSize(48);
  doc.setTextColor(...colors.roseDeep);
  doc.setFont("helvetica", "bold");
  doc.text("REMITO", pageWidth / 2, 28, { align: "center" });

  yPosition = 40;

  // ========================
  // RECUADRO INFO REMITO
  // ========================
  const date = new Date(remito.createdAt);
  const remitNumber = remito.id.substring(0, 8).toUpperCase();

  doc.setDrawColor(...colors.rosePrimary);
  doc.setLineWidth(2);
  doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);

  doc.setDrawColor(...colors.rosePrimary);
  doc.setLineWidth(1.5);
  doc.rect(margin, yPosition, contentWidth, 16, "S");

  doc.setFillColor(...colors.roseSoft);
  doc.rect(margin, yPosition, contentWidth / 2, 16, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.roseDeep);
  doc.text(`REMITO #${remitNumber}`, margin + 4, yPosition + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.inkSecondary);
  doc.text(
    `Fecha: ${date.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    margin + 4,
    yPosition + 12
  );

  yPosition += 22;

  // ========================
  // DATOS CLIENTE
  // ========================
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.roseDeep);
  doc.text("CLIENTE", margin, yPosition);

  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.inkPrimary);
  doc.text(`${remito.clientName}`, margin, yPosition);

  yPosition += 6;

  doc.setFontSize(8);
  doc.setTextColor(...colors.inkSecondary);
  if (remito.clientEmail) {
    doc.text(`Email: ${remito.clientEmail}`, margin, yPosition);
    yPosition += 5;
  }
  if (remito.clientPhone) {
    doc.text(`Telefono: ${remito.clientPhone}`, margin, yPosition);
    yPosition += 5;
  }

  yPosition += 3;

  // ========================
  // TABLA DE ITEMS
  // ========================
  const tableConfig = {
    headerBg: colors.roseDeep,
    headerText: colors.white,
    rowBg1: colors.white,
    rowBg2: colors.roseSoft,
    rowText: colors.inkPrimary,
    colWidths: [65, 18, 25, 32],
  };

  const headerHeight = 10;
  const rowHeight = 8;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin + 0.5, yPosition + 0.5, contentWidth, 0.5, "S");

  doc.setFillColor(...tableConfig.headerBg);
  doc.rect(margin, yPosition, contentWidth, headerHeight, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...tableConfig.headerText);

  let xCol = margin + 3;
  doc.text("PRODUCTO", xCol, yPosition + 6.5);
  xCol += tableConfig.colWidths[0];
  doc.text("CANT.", xCol + 1, yPosition + 6.5, { align: "center" });
  xCol += tableConfig.colWidths[1];
  doc.text("PRECIO", xCol + 1, yPosition + 6.5, { align: "center" });
  doc.text("TOTAL", pageWidth - margin - 2, yPosition + 6.5, { align: "right" });

  yPosition += headerHeight;

  // Filas
  let subtotal = 0;
  const itemsPerPage = 8;
  let itemsOnPage = 0;

  remito.items.forEach((item, index) => {
    const itemTotal = item.quantity * item.price;
    subtotal += itemTotal;

    if (itemsOnPage >= itemsPerPage && yPosition > pageHeight - 70) {
      doc.addPage();
      addWatermarkPage();
      
      doc.setFillColor(...colors.roseSoft);
      doc.circle(10, 8, 5, "F");
      doc.circle(pageWidth - 12, 15, 4, "F");
      
      yPosition = 15;
      itemsOnPage = 0;
    }

    const bgColor = index % 2 === 0 ? tableConfig.rowBg2 : tableConfig.rowBg1;
    doc.setFillColor(...bgColor);
    doc.rect(margin, yPosition, contentWidth, rowHeight, "F");

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(margin, yPosition, contentWidth, rowHeight, "S");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...tableConfig.rowText);

    xCol = margin + 3;
    doc.text(item.product.substring(0, 40), xCol, yPosition + 5);

    xCol += tableConfig.colWidths[0];
    doc.text(item.quantity.toString(), xCol + 1, yPosition + 5, { align: "center" });

    xCol += tableConfig.colWidths[1];
    doc.text(formatPriceARG(item.price), xCol + 1, yPosition + 5, { align: "center" });

    // TOTAL alineado al borde derecho de la tabla
    doc.text(formatPriceARG(itemTotal), pageWidth - margin - 2, yPosition + 5, { align: "right" });

    yPosition += rowHeight;
    itemsOnPage++;
  });

  yPosition += 18;

  // ========================
  // TOTALES
  // ========================
  const totalsBoxWidth = 60;
  const totalsX = pageWidth - margin - totalsBoxWidth;

  doc.setFillColor(230, 230, 230);
  doc.rect(totalsX + 1, yPosition, totalsBoxWidth + 1, 24, "F");

  doc.setFillColor(...colors.roseSoft);
  doc.setDrawColor(...colors.rosePrimary);
  doc.setLineWidth(2);
  doc.rect(totalsX, yPosition, totalsBoxWidth, 24, "FD");

  let totalY = yPosition + 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.inkSecondary);
  doc.text("Subtotal", totalsX + 3, totalY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.inkPrimary);
  doc.text(formatPriceARG(subtotal), totalsX + totalsBoxWidth - 3, totalY, { align: "right" });

  totalY += 10;

  doc.setDrawColor(...colors.rosePrimary);
  doc.setLineWidth(1);
  doc.line(totalsX + 2, totalY - 2, totalsX + totalsBoxWidth - 2, totalY - 2);

  totalY += 2;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.roseDeep);
  doc.text("TOTAL", totalsX + 3, totalY + 4);

  doc.setFontSize(16);
  doc.text(formatPriceARG(subtotal), totalsX + totalsBoxWidth - 3, totalY + 4, { align: "right" });

  // ========================
  // NOTAS
  // ========================
  if (remito.notes) {
    yPosition = Math.max(yPosition + 15, 155);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.roseDeep);
    doc.text("NOTAS", margin, yPosition);

    yPosition += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.inkSecondary);

    doc.setFillColor(...colors.roseSoft);
    doc.setDrawColor(...colors.rosePrimary);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition - 2, contentWidth, 15, "FD");

    const noteLines = doc.splitTextToSize(remito.notes, contentWidth - 4);
    doc.text(noteLines, margin + 2, yPosition + 2);
  }

  // ========================
  // FOOTER
  // ========================
  const footerY = pageHeight - 12;

  doc.setDrawColor(...colors.rosePrimary);
  doc.setLineWidth(1);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.gray);
  doc.text(
    "Cancerianas | www.cancerianas.com | Instagram: @cancerianas",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // ========================
  // DESCARGAR
  // ========================
  const fileName = `Remito-${remito.clientName.replace(/\s+/g, "-")}-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}.pdf`;
  doc.save(fileName);
}
