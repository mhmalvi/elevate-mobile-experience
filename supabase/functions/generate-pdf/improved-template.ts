// Professional PDF Template for TradieMate
// Modern, clean design with better typography and spacing

export function generateProfessionalPDFHTML(data: {
  type: string;
  document: any;
  lineItems: any[];
  profile: any;
  client: any;
  branding?: any;
}): string {
  const { type, document, lineItems, profile, client, branding } = data;

  // Extract branding values with fallbacks
  const primaryColor = branding?.primary_color || '#2563eb'; // Professional blue
  const secondaryColor = branding?.secondary_color || '#1e40af';
  const accentColor = branding?.accent_color || '#10b981'; // Green for success states
  const textColor = branding?.text_color || '#111827';
  const mutedColor = '#6b7280';
  const logoUrl = branding?.logo_url || profile?.logo_url;
  const showLogo = branding?.show_logo_on_documents ?? true;
  const footerText = branding?.document_footer_text || 'Thank you for your business!';
  const defaultTerms = type === 'quote' ? branding?.default_quote_terms : branding?.default_invoice_terms;
  const termsText = document.terms || defaultTerms || '';
  const isQuote = type === "quote";
  const docNumber = isQuote ? document.quote_number : document.invoice_number;
  const docTitle = isQuote ? "QUOTE" : "INVOICE";

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} ${docNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: ${textColor};
      background: #ffffff;
      padding: 30px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }

    /* Header Section */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 30px;
      margin-bottom: 30px;
      border-bottom: 3px solid ${primaryColor};
    }

    .business-info {
      flex: 1;
    }

    .business-logo {
      margin-bottom: 15px;
    }

    .business-logo img {
      max-width: 160px;
      max-height: 70px;
      object-fit: contain;
      display: block;
    }

    .business-name {
      font-size: 22px;
      font-weight: 700;
      color: ${textColor};
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .business-details {
      font-size: 10px;
      color: ${mutedColor};
      line-height: 1.7;
    }

    .business-details p {
      margin: 2px 0;
    }

    .document-info {
      text-align: right;
      min-width: 200px;
    }

    .document-type {
      display: inline-block;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      color: white;
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .document-number {
      font-size: 14px;
      font-weight: 600;
      color: ${textColor};
      margin-bottom: 15px;
    }

    .document-meta {
      font-size: 10px;
      color: ${mutedColor};
      line-height: 1.8;
    }

    .document-meta strong {
      color: ${textColor};
      font-weight: 600;
    }

    /* Client & Details Grid */
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      margin-bottom: 35px;
    }

    .detail-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
    }

    .detail-card-title {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: ${primaryColor};
      margin-bottom: 12px;
    }

    .client-name {
      font-size: 15px;
      font-weight: 600;
      color: ${textColor};
      margin-bottom: 6px;
    }

    .detail-card p {
      font-size: 10px;
      color: ${mutedColor};
      line-height: 1.7;
      margin: 3px 0;
    }

    /* Description */
    .description {
      margin-bottom: 25px;
      padding: 15px;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
      font-size: 11px;
      color: #78350f;
      line-height: 1.6;
    }

    /* Line Items Table */
    .line-items {
      margin-bottom: 30px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
    }

    th {
      padding: 12px 15px;
      text-align: left;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${mutedColor};
      border-bottom: 2px solid #e5e7eb;
    }

    th:last-child {
      text-align: right;
    }

    tbody tr {
      border-bottom: 1px solid #f3f4f6;
    }

    tbody tr:last-child {
      border-bottom: none;
    }

    tbody tr:hover {
      background: #fafbfc;
    }

    td {
      padding: 14px 15px;
      font-size: 10px;
      vertical-align: top;
    }

    td:last-child {
      text-align: right;
      font-weight: 600;
    }

    .item-description {
      font-weight: 500;
      color: ${textColor};
      margin-bottom: 3px;
    }

    .item-type {
      font-size: 9px;
      color: ${mutedColor};
      text-transform: capitalize;
    }

    .item-quantity {
      color: ${mutedColor};
      font-size: 10px;
    }

    /* Totals Section */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }

    .totals-card {
      min-width: 320px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
    }

    .total-line {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 11px;
    }

    .total-line.subtotal {
      color: ${mutedColor};
    }

    .total-line.tax {
      color: ${mutedColor};
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 12px;
      margin-bottom: 8px;
    }

    .total-line.grand {
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      color: white;
      font-size: 18px;
      font-weight: 700;
      padding: 15px 20px;
      margin: 0 -20px -20px -20px;
      border-radius: 0 0 8px 8px;
    }

    .total-line.paid {
      color: ${accentColor};
      font-weight: 600;
      border-top: 2px dashed #e5e7eb;
      padding-top: 12px;
      margin-top: 12px;
    }

    .total-line.balance {
      color: ${primaryColor};
      font-size: 15px;
      font-weight: 700;
    }

    /* Payment Details */
    .payment-details {
      background: linear-gradient(to right, #eff6ff, #dbeafe);
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
    }

    .payment-details-title {
      font-size: 11px;
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: 15px;
      display: flex;
      align-items: center;
    }

    .payment-details-title::before {
      content: "💳";
      margin-right: 8px;
      font-size: 14px;
    }

    .bank-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 20px;
    }

    .bank-item {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      padding: 5px 0;
    }

    .bank-label {
      color: ${mutedColor};
      font-weight: 500;
    }

    .bank-value {
      color: ${textColor};
      font-weight: 600;
    }

    .payment-note {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #bfdbfe;
      font-size: 9px;
      color: #1e40af;
      font-style: italic;
    }

    /* Notes */
    .notes-section {
      background: #fef9f5;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 25px;
    }

    .notes-title {
      font-size: 10px;
      font-weight: 600;
      color: #c2410c;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .notes-content {
      font-size: 10px;
      color: #7c2d12;
      line-height: 1.7;
      white-space: pre-line;
    }

    /* Terms & Conditions */
    .terms-section {
      background: white;
      border: 2px solid #f3f4f6;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 25px;
    }

    .terms-title {
      font-size: 11px;
      font-weight: 600;
      color: ${textColor};
      margin-bottom: 10px;
    }

    .terms-content {
      font-size: 9px;
      color: ${mutedColor};
      line-height: 1.8;
      white-space: pre-line;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: 25px;
      border-top: 2px solid #f3f4f6;
    }

    .footer-message {
      font-size: 12px;
      font-weight: 500;
      color: ${textColor};
      margin-bottom: 10px;
    }

    .footer-details {
      font-size: 9px;
      color: ${mutedColor};
      line-height: 1.8;
    }

    .footer-details strong {
      color: ${textColor};
      font-weight: 600;
    }

    .footer-branding {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #f3f4f6;
      font-size: 8px;
      color: #9ca3af;
    }

    .footer-branding a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 500;
    }

    /* Print Styles */
    @media print {
      body {
        padding: 0;
      }

      .container {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="business-info">
        ${showLogo && logoUrl ? `
        <div class="business-logo">
          <img src="${logoUrl}" alt="${profile?.business_name || 'Business'} Logo" />
        </div>
        ` : ''}
        <h1 class="business-name">${profile?.business_name || 'TradieMate'}</h1>
        <div class="business-details">
          ${profile?.address ? `<p>${profile.address}</p>` : ''}
          ${profile?.phone ? `<p>📞 ${profile.phone}</p>` : ''}
          ${profile?.email ? `<p>✉️ ${profile.email}</p>` : ''}
          ${profile?.website ? `<p>🌐 ${profile.website}</p>` : ''}
        </div>
      </div>

      <div class="document-info">
        <div class="document-type">${docTitle}</div>
        <div class="document-number">#${docNumber}</div>
        <div class="document-meta">
          <p><strong>Date:</strong> ${formatDate(document.created_at)}</p>
          ${isQuote && document.valid_until ? `<p><strong>Valid Until:</strong> ${formatDate(document.valid_until)}</p>` : ''}
          ${!isQuote && document.due_date ? `<p><strong>Due Date:</strong> ${formatDate(document.due_date)}</p>` : ''}
        </div>
      </div>
    </div>

    <!-- Title -->
    ${document.title ? `
    <div style="margin-bottom: 25px;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${textColor}; margin-bottom: 5px;">${document.title}</h2>
    </div>
    ` : ''}

    <!-- Description -->
    ${document.description ? `
    <div class="description">
      ${document.description}
    </div>
    ` : ''}

    <!-- Client & Document Details -->
    <div class="details-grid">
      <div class="detail-card">
        <div class="detail-card-title">${isQuote ? 'Quote For' : 'Bill To'}</div>
        <div class="client-name">${client?.name || 'No client'}</div>
        ${client?.address ? `<p>${client.address}</p>` : ''}
        ${client?.suburb || client?.state || client?.postcode ? `<p>${[client.suburb, client.state, client.postcode].filter(Boolean).join(', ')}</p>` : ''}
        ${client?.phone ? `<p>📞 ${client.phone}</p>` : ''}
        ${client?.email ? `<p>✉️ ${client.email}</p>` : ''}
      </div>

      <div class="detail-card">
        <div class="detail-card-title">Document Details</div>
        <p><strong>Number:</strong> ${docNumber}</p>
        <p><strong>Date:</strong> ${formatDate(document.created_at)}</p>
        ${isQuote && document.valid_until ? `<p><strong>Valid Until:</strong> ${formatDate(document.valid_until)}</p>` : ''}
        ${!isQuote && document.due_date ? `<p><strong>Due Date:</strong> ${formatDate(document.due_date)}</p>` : ''}
        ${profile?.abn ? `<p><strong>ABN:</strong> ${profile.abn}</p>` : ''}
      </div>
    </div>

    <!-- Line Items -->
    <div class="line-items">
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Description</th>
            <th style="width: 15%; text-align: center;">Quantity</th>
            <th style="width: 17%; text-align: right;">Unit Price</th>
            <th style="width: 18%; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(item => `
            <tr>
              <td>
                <div class="item-description">${item.description || 'Item'}</div>
                ${item.item_type ? `<div class="item-type">${item.item_type}</div>` : ''}
              </td>
              <td style="text-align: center;">
                <span class="item-quantity">${item.quantity || 1} ${item.unit || 'ea'}</span>
              </td>
              <td style="text-align: right;">${formatCurrency(item.unit_price || 0)}</td>
              <td style="text-align: right; font-weight: 600; color: ${textColor};">${formatCurrency(item.total || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-card">
        <div class="total-line subtotal">
          <span>Subtotal</span>
          <span>${formatCurrency(document.subtotal || 0)}</span>
        </div>
        <div class="total-line tax">
          <span>GST (10%)</span>
          <span>${formatCurrency(document.gst || 0)}</span>
        </div>
        <div class="total-line grand">
          <span>Total ${document.currency || 'AUD'}</span>
          <span>${formatCurrency(document.total || 0)}</span>
        </div>
        ${(document.amount_paid || 0) > 0 ? `
          <div class="total-line paid">
            <span>Amount Paid</span>
            <span>-${formatCurrency(document.amount_paid)}</span>
          </div>
          <div class="total-line balance">
            <span>Balance Due</span>
            <span>${formatCurrency((document.total || 0) - (document.amount_paid || 0))}</span>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Bank Details (for invoices only) -->
    ${!isQuote && (profile?.bank_name || profile?.bank_bsb) ? `
    <div class="payment-details">
      <div class="payment-details-title">Payment Information</div>
      <div class="bank-grid">
        ${profile.bank_name ? `
          <div class="bank-item">
            <span class="bank-label">Bank</span>
            <span class="bank-value">${profile.bank_name}</span>
          </div>
        ` : ''}
        ${profile.bank_account_name ? `
          <div class="bank-item">
            <span class="bank-label">Account Name</span>
            <span class="bank-value">${profile.bank_account_name}</span>
          </div>
        ` : ''}
        ${profile.bank_bsb ? `
          <div class="bank-item">
            <span class="bank-label">BSB</span>
            <span class="bank-value">${profile.bank_bsb}</span>
          </div>
        ` : ''}
        ${profile.bank_account_number ? `
          <div class="bank-item">
            <span class="bank-label">Account Number</span>
            <span class="bank-value">${profile.bank_account_number}</span>
          </div>
        ` : ''}
      </div>
      <div class="payment-note">
        💡 Please use invoice number ${docNumber} as your payment reference
      </div>
    </div>
    ` : ''}

    <!-- Notes -->
    ${document.notes ? `
    <div class="notes-section">
      <div class="notes-title">Notes</div>
      <div class="notes-content">${document.notes}</div>
    </div>
    ` : ''}

    <!-- Terms & Conditions -->
    ${termsText ? `
    <div class="terms-section">
      <div class="terms-title">Terms & Conditions</div>
      <div class="terms-content">${termsText}</div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-message">${footerText}</div>
      <div class="footer-details">
        ${profile?.abn ? `<p><strong>ABN:</strong> ${profile.abn}</p>` : ''}
        ${(profile as any)?.license_number ? `<p><strong>License:</strong> ${(profile as any).license_number}</p>` : ''}
        ${profile?.phone ? `<p><strong>Phone:</strong> ${profile.phone}</p>` : ''}
        ${profile?.email ? `<p><strong>Email:</strong> ${profile.email}</p>` : ''}
      </div>
      <div class="footer-branding">
        Generated with <a href="https://tradiemate.com.au" target="_blank">TradieMate</a> • Professional ${isQuote ? 'Quote' : 'Invoice'} Management
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
