import jsPDF from 'jspdf';

export function generateDocPdf(doc, siteName, existingPdf, startY) {
  const pdf = existingPdf || new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 54;
  let y = startY || 60;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pdf.internal.pageSize.getWidth() - marginX * 2;

  if (!existingPdf) {
    // Title page header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(doc.title, marginX, y);
    y += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Document No.: ${doc.docNum}  |  Facility: ${siteName}`, marginX, y);
    y += 10;
    pdf.setDrawColor(200);
    pdf.line(marginX, y, marginX + maxWidth, y);
    y += 20;
  }

  doc.sections.forEach(sec => {
    if (y > pageHeight - 80) { pdf.addPage(); y = 60; }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(sec.heading, marginX, y);
    y += 16;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(sec.body, maxWidth);
    lines.forEach(line => {
      if (y > pageHeight - 40) { pdf.addPage(); y = 60; }
      pdf.text(line, marginX, y);
      y += 12;
    });
    y += 12;
  });

  return pdf;
}

export function downloadDocAsPdf(doc, siteName) {
  const pdf = generateDocPdf(doc, siteName);
  pdf.save(`${doc.docNum}_${doc.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf`);
}

export function downloadPackageAsPdf(docs, siteName) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  docs.forEach((doc, i) => {
    if (i > 0) pdf.addPage();
    generateDocPdf(doc, siteName, pdf, 60);
  });
  pdf.save('Brick_PermitOS_Document_Package.pdf');
}