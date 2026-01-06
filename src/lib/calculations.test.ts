import { describe, it, expect } from 'vitest';

/**
 * Tests for financial calculations used in quotes and invoices
 */

describe('GST Calculations', () => {
  const calculateGST = (amount: number): number => {
    return Math.round(amount * 0.1 * 100) / 100;
  };

  it('should calculate 10% GST correctly', () => {
    expect(calculateGST(100)).toBe(10);
    expect(calculateGST(1000)).toBe(100);
    expect(calculateGST(50)).toBe(5);
  });

  it('should handle decimal amounts', () => {
    expect(calculateGST(99.99)).toBe(10);
    expect(calculateGST(123.45)).toBe(12.35);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateGST(33.33)).toBe(3.33);
    expect(calculateGST(66.67)).toBe(6.67);
  });

  it('should handle zero', () => {
    expect(calculateGST(0)).toBe(0);
  });

  it('should handle large amounts', () => {
    expect(calculateGST(10000)).toBe(1000);
    expect(calculateGST(99999.99)).toBe(10000);
  });
});

describe('Total Calculations', () => {
  const calculateTotal = (subtotal: number, gst: number): number => {
    return Math.round((subtotal + gst) * 100) / 100;
  };

  it('should add subtotal and GST correctly', () => {
    expect(calculateTotal(100, 10)).toBe(110);
    expect(calculateTotal(1000, 100)).toBe(1100);
  });

  it('should handle decimal values', () => {
    expect(calculateTotal(99.99, 10)).toBe(109.99);
    expect(calculateTotal(123.45, 12.35)).toBe(135.8);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateTotal(10.005, 1.001)).toBe(11.01);
  });
});

describe('Line Item Calculations', () => {
  const calculateLineTotal = (quantity: number, rate: number): number => {
    return Math.round(quantity * rate * 100) / 100;
  };

  it('should calculate line item total correctly', () => {
    expect(calculateLineTotal(10, 85)).toBe(850);
    expect(calculateLineTotal(2.5, 100)).toBe(250);
    expect(calculateLineTotal(1, 1500)).toBe(1500);
  });

  it('should handle decimal quantities and rates', () => {
    expect(calculateLineTotal(2.5, 85.50)).toBe(213.75);
    expect(calculateLineTotal(0.5, 200)).toBe(100);
  });

  it('should round correctly', () => {
    expect(calculateLineTotal(3, 33.33)).toBe(99.99);
  });

  it('should handle zero quantity or rate', () => {
    expect(calculateLineTotal(0, 100)).toBe(0);
    expect(calculateLineTotal(10, 0)).toBe(0);
  });
});

describe('Invoice Balance Calculations', () => {
  const calculateBalance = (total: number, amountPaid: number): number => {
    return Math.round((total - amountPaid) * 100) / 100;
  };

  it('should calculate remaining balance', () => {
    expect(calculateBalance(1100, 0)).toBe(1100);
    expect(calculateBalance(1100, 500)).toBe(600);
    expect(calculateBalance(1100, 1100)).toBe(0);
  });

  it('should handle partial payments', () => {
    expect(calculateBalance(1000, 250)).toBe(750);
    expect(calculateBalance(1500.50, 500.25)).toBe(1000.25);
  });

  it('should handle overpayment', () => {
    expect(calculateBalance(1000, 1200)).toBe(-200);
  });
});

describe('Discount Calculations', () => {
  const applyDiscount = (amount: number, discountPercent: number): number => {
    const discount = (amount * discountPercent) / 100;
    return Math.round((amount - discount) * 100) / 100;
  };

  it('should apply percentage discount correctly', () => {
    expect(applyDiscount(100, 10)).toBe(90);
    expect(applyDiscount(1000, 15)).toBe(850);
    expect(applyDiscount(500, 20)).toBe(400);
  });

  it('should handle decimal discounts', () => {
    expect(applyDiscount(1000, 5.5)).toBe(945);
    expect(applyDiscount(200, 12.5)).toBe(175);
  });

  it('should handle 0% discount', () => {
    expect(applyDiscount(100, 0)).toBe(100);
  });

  it('should handle 100% discount', () => {
    expect(applyDiscount(100, 100)).toBe(0);
  });
});

describe('Hourly Rate Calculations', () => {
  const calculateHourlyTotal = (hours: number, rate: number): number => {
    return Math.round(hours * rate * 100) / 100;
  };

  it('should calculate hourly total correctly', () => {
    expect(calculateHourlyTotal(8, 85)).toBe(680);
    expect(calculateHourlyTotal(40, 85)).toBe(3400);
  });

  it('should handle partial hours', () => {
    expect(calculateHourlyTotal(0.5, 85)).toBe(42.5);
    expect(calculateHourlyTotal(2.25, 100)).toBe(225);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateHourlyTotal(3.333, 85)).toBe(283.31);
  });
});

describe('Deposit Calculations', () => {
  const calculateDeposit = (total: number, depositPercent: number): number => {
    return Math.round((total * depositPercent) / 100 * 100) / 100;
  };

  it('should calculate deposit correctly', () => {
    expect(calculateDeposit(1000, 50)).toBe(500);
    expect(calculateDeposit(2000, 25)).toBe(500);
    expect(calculateDeposit(1500, 33.33)).toBe(499.95);
  });

  it('should handle common deposit percentages', () => {
    expect(calculateDeposit(10000, 10)).toBe(1000);
    expect(calculateDeposit(5000, 20)).toBe(1000);
    expect(calculateDeposit(3000, 30)).toBe(900);
  });
});

describe('Payment Due Date Calculations', () => {
  const addDaysToDate = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  it('should add payment terms to invoice date', () => {
    const invoiceDate = new Date('2026-01-06');

    const net7 = addDaysToDate(invoiceDate, 7);
    expect(net7.getDate()).toBe(13);

    const net14 = addDaysToDate(invoiceDate, 14);
    expect(net14.getDate()).toBe(20);

    const net30 = addDaysToDate(invoiceDate, 30);
    expect(net30.getDate()).toBe(5);
    expect(net30.getMonth()).toBe(1); // February
  });
});
