import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import autoTable from "https://esm.sh/jspdf-autotable@3.5.29";

// Formatting helpers
const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;
const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export const generatePDFBinary = (data: {
    type: string;
    document: any;
    lineItems: any[];
    profile: any;
    client: any;
    branding?: any;
}, logoBase64?: string): Uint8Array => {
    const { type, document, lineItems, profile, client, branding } = data;

    const doc = new jsPDF();

    // Colors
    const primaryColor = branding?.primary_color || '#2563eb';
    const secondaryColor = branding?.secondary_color || '#1e40af';
    const textColor = branding?.text_color || '#111827';
    const mutedColor = '#6b7280';

    const isQuote = type === "quote";
    const docTitle = isQuote ? "QUOTE" : "INVOICE";
    const docNumber = isQuote ? document.quote_number : document.invoice_number;

    let yPos = 20;
    const margin = 20;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    // --- Header ---

    // Logo
    if (logoBase64) {
        try {
            // Assume PNG or JPEG based on standard usage, jsPDF handles it usually
            // Scale logo to fit max width 40mm, max height 20mm
            doc.addImage(logoBase64, 'JPEG', margin, yPos, 40, 20, undefined, 'FAST');
            // We don't advance yPos here yet, we'll align text to the right
        } catch (e) {
            console.error("Error adding logo:", e);
        }
    }

    // Business Details (Left aligned, under logo or at top)
    let headerTextY = yPos + (logoBase64 ? 25 : 0);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textColor);
    doc.text(profile?.business_name || 'Your Business', margin, headerTextY);
    headerTextY += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(mutedColor);

    const bizDetails = [
        profile?.address,
        profile?.phone ? `Phone: ${profile.phone}` : null,
        profile?.email ? `Email: ${profile.email}` : null,
        profile?.website ? `Web: ${profile.website}` : null
    ].filter(Boolean);

    bizDetails.forEach(line => {
        doc.text(line as string, margin, headerTextY);
        headerTextY += 5;
    });

    // Document Info (Right aligned)
    let rightColX = pageWidth - margin;
    let rightColY = 20;

    // Doc Badge
    doc.setFillColor(primaryColor);
    doc.roundedRect(rightColX - 30, rightColY, 30, 8, 1, 1, 'F');
    doc.setTextColor("#ffffff");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(docTitle, rightColX - 15, rightColY + 5.5, { align: "center" });

    rightColY += 15;
    doc.setTextColor(textColor);
    doc.setFontSize(12);
    doc.text(`#${docNumber}`, rightColX, rightColY, { align: "right" });

    rightColY += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(mutedColor);

    doc.text(`Date: ${formatDate(document.created_at)}`, rightColX, rightColY, { align: "right" });
    rightColY += 5;

    if (isQuote && document.valid_until) {
        doc.text(`Valid Until: ${formatDate(document.valid_until)}`, rightColX, rightColY, { align: "right" });
    } else if (!isQuote && document.due_date) {
        doc.text(`Due Date: ${formatDate(document.due_date)}`, rightColX, rightColY, { align: "right" });
    }

    // Move Y to below header
    yPos = Math.max(headerTextY, rightColY) + 10;

    // Line separator
    doc.setDrawColor(primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // --- Title & Description ---
    if (document.title) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(textColor);
        doc.text(document.title, margin, yPos);
        yPos += 7;
    }

    if (document.description) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(mutedColor);
        const descLines = doc.splitTextToSize(document.description, contentWidth);
        doc.text(descLines, margin, yPos);
        yPos += (descLines.length * 5) + 5;
    }

    yPos += 5;

    // --- Client & Bill To Details ---
    const leftColX = margin;
    const colWidth = contentWidth / 2;
    const rightDetailX = margin + colWidth;

    const startDetailY = yPos;

    // Left: Bill To
    doc.setFontSize(8);
    doc.setTextColor(primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text(isQuote ? "QUOTE FOR" : "BILL TO", leftColX, yPos);
    yPos += 5;

    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text(client?.name || 'No client', leftColX, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setTextColor(mutedColor);
    doc.setFont("helvetica", "normal");

    const clientDetails = [
        client?.address,
        [client?.suburb, client?.state, client?.postcode].filter(Boolean).join(', '),
        client?.phone,
        client?.email
    ].filter(Boolean);

    clientDetails.forEach(line => {
        doc.text(line as string, leftColX, yPos);
        yPos += 5;
    });

    // Right: Document Stats
    let rightDetailY = startDetailY;
    doc.setFontSize(8);
    doc.setTextColor(primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("DOCUMENT DETAILS", rightDetailX, rightDetailY);
    rightDetailY += 5;

    doc.setFontSize(9);
    doc.setTextColor(mutedColor);
    doc.setFont("helvetica", "normal");

    const stats = [
        `Number: ${docNumber}`,
        `Date: ${formatDate(document.created_at)}`,
        profile?.abn ? `ABN: ${profile.abn}` : null
    ].filter(Boolean);

    stats.forEach(line => {
        doc.text(line as string, rightDetailX, rightDetailY);
        rightDetailY += 5;
    });

    yPos = Math.max(yPos, rightDetailY) + 10;

    // --- Line Items Table ---

    const tableHeaders = [["DESCRIPTION", "QUANTITY", "UNIT PRICE", "AMOUNT"]];
    const tableData = lineItems.map(item => [
        item.description || "Item",
        `${item.quantity || 1} ${item.unit || ''}`,
        formatCurrency(item.unit_price || 0),
        formatCurrency(item.total || 0)
    ]);

    autoTable(doc, {
        startY: yPos,
        head: tableHeaders,
        body: tableData,
        theme: 'plain',
        headStyles: {
            fillColor: '#f3f4f6',
            textColor: mutedColor,
            fontSize: 8,
            fontStyle: 'bold',
            cellPadding: 3
        },
        bodyStyles: {
            textColor: textColor,
            fontSize: 9,
            cellPadding: 3,
            valign: 'top'
        },
        columnStyles: {
            0: { cellWidth: 'auto' }, // Description
            1: { cellWidth: 25, halign: 'center' }, // Qty
            2: { cellWidth: 30, halign: 'right' }, // Price
            3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } // Amount
        },
        styles: { overflow: 'linebreak' },
        margin: { left: margin, right: margin },
    });

    // @ts-ignore
    yPos = doc.lastAutoTable.finalY + 10;

    // --- Totals ---
    // Right aligned block
    const totalsWidth = 70;
    const totalsX = pageWidth - margin - totalsWidth;

    // Subtotal
    doc.setFontSize(9);
    doc.setTextColor(mutedColor);
    doc.text("Subtotal", totalsX, yPos);
    doc.text(formatCurrency(document.subtotal || 0), pageWidth - margin, yPos, { align: "right" });
    yPos += 6;

    // GST
    doc.text("GST (10%)", totalsX, yPos);
    doc.text(formatCurrency(document.gst || 0), pageWidth - margin, yPos, { align: "right" });
    yPos += 8;

    // Grand Total Background
    doc.setFillColor(primaryColor);
    doc.rect(totalsX - 2, yPos - 6, totalsWidth + 2, 12, 'F');

    doc.setTextColor("#ffffff");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Total ${document.currency || 'AUD'}`, totalsX + 2, yPos);
    doc.text(formatCurrency(document.total || 0), pageWidth - margin, yPos, { align: "right" });
    yPos += 12;

    // Balance Due
    if ((document.amount_paid || 0) > 0) {
        doc.setTextColor(mutedColor);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Amount Paid", totalsX, yPos);
        doc.text(`-${formatCurrency(document.amount_paid)}`, pageWidth - margin, yPos, { align: "right" });
        yPos += 6;

        const balance = (document.total || 0) - (document.amount_paid || 0);
        doc.setTextColor(primaryColor);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Balance Due", totalsX, yPos);
        doc.text(formatCurrency(balance), pageWidth - margin, yPos, { align: "right" });
        yPos += 10;
    }

    // --- Payment Details (Invoice Only) ---
    if (!isQuote && (profile?.bank_name || profile?.bank_bsb)) {
        yPos += 5;
        doc.setFillColor('#eff6ff');
        doc.rect(margin, yPos, contentWidth, 30, 'F');

        let pY = yPos + 6;
        doc.setFontSize(9);
        doc.setTextColor(primaryColor);
        doc.setFont("helvetica", "bold");
        doc.text("PAYMENT INFORMATION", margin + 5, pY);
        pY += 6;

        doc.setTextColor(textColor);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        // Grid for bank details
        const bankLeft = margin + 5;
        const bankRight = margin + (contentWidth / 2);

        if (profile.bank_name) {
            doc.setTextColor(mutedColor);
            doc.text("Bank:", bankLeft, pY);
            doc.setTextColor(textColor);
            doc.text(profile.bank_name, bankLeft + 25, pY);
        }
        if (profile.bank_account_name) {
            doc.setTextColor(mutedColor);
            doc.text("Account Name:", bankRight, pY);
            doc.setTextColor(textColor);
            doc.text(profile.bank_account_name, bankRight + 25, pY);
        }
        pY += 5;

        if (profile.bank_bsb) {
            doc.setTextColor(mutedColor);
            doc.text("BSB:", bankLeft, pY);
            doc.setTextColor(textColor);
            doc.text(profile.bank_bsb, bankLeft + 25, pY);
        }
        if (profile.bank_account_number) {
            doc.setTextColor(mutedColor);
            doc.text("Account No:", bankRight, pY);
            doc.setTextColor(textColor);
            doc.text(profile.bank_account_number, bankRight + 25, pY);
        }

        yPos += 35;
    }

    // --- Footer ---
    // Position at bottom
    const footerY = 280;
    doc.setDrawColor('#f3f4f6');
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(8);
    doc.setTextColor(mutedColor);
    doc.text(branding?.document_footer_text || 'Thank you for your business!', margin, footerY + 5);

    const footerLine2 = [
        profile?.abn ? `ABN: ${profile.abn}` : null,
        profile?.email ? `Email: ${profile.email}` : null
    ].filter(Boolean).join(' | ');

    doc.text(footerLine2, pageWidth - margin, footerY + 5, { align: "right" });

    return new Uint8Array(doc.output('arraybuffer'));
};
