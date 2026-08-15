import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Customer from '../models/Customer.js';
import Plot from '../models/Plot.js';
import Payment from '../models/Payment.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/errors.js';

const REPORT_TYPES = ['customers', 'plots', 'payments', 'expenses', 'income', 'financial'];
const PLOT_STATUSES = ['Available', 'Reserved', 'Allocated', 'Sold'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

function isValidId(v) {
  return v && mongoose.Types.ObjectId.isValid(v);
}

function parseDateParam(v) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new AppError('Invalid date filter', 400);
  return d;
}

function parseDateRange(query) {
  const from = parseDateParam(query.dateFrom);
  const to = parseDateParam(query.dateTo);
  if (from && to && from > to) throw new AppError('dateFrom must not be after dateTo', 400);
  return { dateFrom: from, dateTo: to };
}

function normalizeMatch(value) {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(normalizeMatch);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeMatch(v);
    return out;
  }
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value) && /^[a-fA-F0-9]{24}$/.test(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
}

async function sumDecimal(model, match) {
  const pipeline = [];
  if (match && Object.keys(match).length) pipeline.push({ $match: normalizeMatch(match) });
  pipeline.push({ $group: { _id: null, total: { $sum: '$amount' } } });
  const [row] = await model.aggregate(pipeline);
  if (!row || row.total === null || row.total === undefined) return new Decimal(0);
  return new Decimal(row.total.toString());
}

function paginate(rows, page, limit) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;
  return {
    rows: rows.slice(skip, skip + limitNum),
    pagination: { page: pageNum, limit: limitNum, total: rows.length, totalPages: Math.ceil(rows.length / limitNum) },
  };
}

// ---------------- Customer Report ----------------
async function buildCustomerReport(query, opts) {
  const search = query.search ? String(query.search).trim() : '';
  const hasPlots = query.hasPlots || 'all';

  const customerFilter = {};
  if (search) {
    customerFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const customers = await Customer.find(customerFilter).select('name phone email');

  const plotCounts = await Plot.aggregate([{ $group: { _id: '$customerId', count: { $sum: 1 } } }]);
  const countByCustomer = new Map();
  for (const r of plotCounts) {
    if (r._id) countByCustomer.set(r._id.toString(), r.count);
  }

  let filtered = customers;
  if (hasPlots === 'with') filtered = customers.filter((c) => (countByCustomer.get(c._id.toString()) || 0) > 0);
  else if (hasPlots === 'without') filtered = customers.filter((c) => (countByCustomer.get(c._id.toString()) || 0) === 0);

  const ids = filtered.map((c) => c._id);
  const [agreementRows, paidRows] = await Promise.all([
    Plot.aggregate([
      { $match: { customerId: { $in: ids } } },
      { $group: { _id: '$customerId', agreement: { $sum: '$agreementAmount' } } },
    ]),
    Payment.aggregate([
      { $match: { customerId: { $in: ids } } },
      { $group: { _id: '$customerId', paid: { $sum: '$amount' } } },
    ]),
  ]);
  const agreementByCustomer = new Map(agreementRows.map((r) => [r._id.toString(), new Decimal(r.agreement.toString())]));
  const paidByCustomer = new Map(paidRows.map((r) => [r._id.toString(), new Decimal(r.paid.toString())]));

  const rows = filtered.map((c) => {
    const agreement = agreementByCustomer.get(c._id.toString()) || new Decimal(0);
    const paid = paidByCustomer.get(c._id.toString()) || new Decimal(0);
    const outstanding = Decimal.max(0, agreement.minus(paid));
    return {
      _id: c._id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      plotCount: countByCustomer.get(c._id.toString()) || 0,
      agreementValue: agreement.toString(),
      paymentReceived: paid.toString(),
      outstanding: outstanding.toString(),
    };
  });

  const summary = rows.reduce(
    (acc, r) => {
      acc.agreementValue = acc.agreementValue.plus(new Decimal(r.agreementValue));
      acc.paymentReceived = acc.paymentReceived.plus(new Decimal(r.paymentReceived));
      acc.outstanding = acc.outstanding.plus(new Decimal(r.outstanding));
      return acc;
    },
    { agreementValue: new Decimal(0), paymentReceived: new Decimal(0), outstanding: new Decimal(0) }
  );

  const summaryObj = {
    customers: rows.length,
    agreementValue: summary.agreementValue.toString(),
    paymentReceived: summary.paymentReceived.toString(),
    outstanding: summary.outstanding.toString(),
  };
  const { rows: pageRows, pagination } = opts.paginate ? paginate(rows, query.page, query.limit) : { rows, pagination: null };
  return {
    reportType: 'customers',
    filters: { search, hasPlots },
    rows: pageRows,
    summary: summaryObj,
    pagination,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------- Plot Report ----------------
async function buildPlotReport(query, opts) {
  const status = query.status && query.status !== 'All' ? query.status : null;
  if (status && !PLOT_STATUSES.includes(status)) throw new AppError('Invalid plot status filter', 400);
  const customerId = query.customer && query.customer !== 'All' ? query.customer : null;
  if (customerId && !isValidId(customerId)) throw new AppError('Invalid customer filter', 400);
  const location = query.location ? String(query.location).trim() : '';

  const filter = {};
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  if (location) filter.location = { $regex: location, $options: 'i' };

  const plots = await Plot.find(filter).populate('customerId', 'name').sort({ plotNumber: 1 });
  const plotIds = plots.map((p) => p._id);
  const paidRows = await Payment.aggregate([
    { $match: { plotId: { $in: plotIds } } },
    { $group: { _id: '$plotId', paid: { $sum: '$amount' } } },
  ]);
  const paidByPlot = new Map(paidRows.map((r) => [r._id.toString(), new Decimal(r.paid.toString())]));

  const rows = plots.map((p) => {
    const assigned = !!(p.customerId && p.agreementAmount !== null && p.agreementAmount !== undefined);
    const paid = paidByPlot.get(p._id.toString()) || new Decimal(0);
    const outstanding = assigned ? Decimal.max(0, new Decimal(p.agreementAmount.toString()).minus(paid)) : null;
    return {
      _id: p._id,
      plotNumber: p.plotNumber,
      area: p.area ?? '',
      areaUnit: p.areaUnit || '',
      location: p.location || '',
      status: p.status,
      listPrice: p.price ? p.price.toString() : '',
      agreementAmount: assigned ? p.agreementAmount.toString() : null,
      customerName: p.customerId ? p.customerId.name : 'Unassigned',
      paid: assigned ? paid.toString() : null,
      outstanding: outstanding ? outstanding.toString() : null,
    };
  });

  const summary = rows.reduce(
    (acc, r) => {
      acc.plots += 1;
      if (r.agreementAmount) acc.agreementValue = acc.agreementValue.plus(new Decimal(r.agreementAmount));
      if (r.paid) acc.totalPaid = acc.totalPaid.plus(new Decimal(r.paid));
      if (r.outstanding) acc.totalOutstanding = acc.totalOutstanding.plus(new Decimal(r.outstanding));
      return acc;
    },
    { plots: 0, agreementValue: new Decimal(0), totalPaid: new Decimal(0), totalOutstanding: new Decimal(0) }
  );

  const summaryObj = {
    plots: summary.plots,
    agreementValue: summary.agreementValue.toString(),
    totalPaid: summary.totalPaid.toString(),
    totalOutstanding: summary.totalOutstanding.toString(),
  };
  const { rows: pageRows, pagination } = opts.paginate ? paginate(rows, query.page, query.limit) : { rows, pagination: null };
  return {
    reportType: 'plots',
    filters: { status: status || 'All', customer: customerId || 'All', location },
    rows: pageRows,
    summary: summaryObj,
    pagination,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------- Payment Report ----------------
async function buildPaymentReport(query, opts) {
  const { dateFrom, dateTo } = parseDateRange(query);
  const customerId = query.customer && query.customer !== 'All' ? query.customer : null;
  const plotId = query.plot && query.plot !== 'All' ? query.plot : null;
  const method = query.method && query.method !== 'All' ? query.method : null;
  if (customerId && !isValidId(customerId)) throw new AppError('Invalid customer filter', 400);
  if (plotId && !isValidId(plotId)) throw new AppError('Invalid plot filter', 400);
  if (method && !PAYMENT_METHODS.includes(method)) throw new AppError('Invalid payment method filter', 400);

  const filter = {};
  if (dateFrom || dateTo) filter.date = { ...(dateFrom ? { $gte: dateFrom } : {}), ...(dateTo ? { $lte: dateTo } : {}) };
  if (customerId) filter.customerId = customerId;
  if (plotId) filter.plotId = plotId;
  if (method) filter.method = method;

  const total = await sumDecimal(Payment, filter);
  let items;
  if (opts.paginate) {
    const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
    items = await Payment.find(filter)
      .populate('customerId', 'name')
      .populate('plotId', 'plotNumber')
      .sort({ date: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
  } else {
    items = await Payment.find(filter)
      .populate('customerId', 'name')
      .populate('plotId', 'plotNumber')
      .sort({ date: -1, createdAt: -1 });
  }

  const rows = items.map((p) => ({
    _id: p._id,
    date: p.date,
    customerName: p.customerId ? p.customerId.name : '',
    plotNumber: p.plotId ? p.plotId.plotNumber : '',
    amount: p.amount.toString(),
    method: p.method,
    reference: p.reference || '',
    notes: p.notes || '',
  }));

  const summaryObj = { totalPayments: total.toString(), count: rows.length };
  const { rows: pageRows, pagination } = opts.paginate
    ? { rows, pagination: { page: Math.max(1, parseInt(query.page, 10) || 1), limit: Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50)), total: rows.length, totalPages: 1 } }
    : { rows, pagination: null };
  return {
    reportType: 'payments',
    filters: { dateFrom: query.dateFrom || null, dateTo: query.dateTo || null, customer: customerId || 'All', plot: plotId || 'All', method: method || 'All' },
    rows: pageRows,
    summary: summaryObj,
    pagination,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------- Expense Report ----------------
async function buildExpenseReport(query, opts) {
  const { dateFrom, dateTo } = parseDateRange(query);
  const categoryId = query.category && query.category !== 'All' ? query.category : null;
  if (categoryId) {
    if (!isValidId(categoryId)) throw new AppError('Invalid category filter', 400);
    const cat = await Category.findById(categoryId);
    if (!cat) throw new AppError('Category not found', 400);
  }

  const filter = { deleted: false };
  if (dateFrom || dateTo) filter.date = { ...(dateFrom ? { $gte: dateFrom } : {}), ...(dateTo ? { $lte: dateTo } : {}) };
  if (categoryId) filter.categoryId = categoryId;

  const total = await sumDecimal(Expense, filter);
  let items;
  if (opts.paginate) {
    const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
    items = await Expense.find(filter)
      .populate('categoryId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
  } else {
    items = await Expense.find(filter).populate('categoryId', 'name').sort({ date: -1, createdAt: -1 });
  }

  const rows = items.map((e) => ({
    _id: e._id,
    date: e.date,
    categoryName: e.categoryId ? e.categoryId.name : '',
    description: e.description || '',
    reference: e.reference || '',
    amount: e.amount.toString(),
    notes: e.notes || '',
  }));

  const summaryObj = { totalExpenses: total.toString(), count: rows.length };
  const { rows: pageRows, pagination } = opts.paginate
    ? { rows, pagination: { page: Math.max(1, parseInt(query.page, 10) || 1), limit: Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50)), total: rows.length, totalPages: 1 } }
    : { rows, pagination: null };
  return {
    reportType: 'expenses',
    filters: { dateFrom: query.dateFrom || null, dateTo: query.dateTo || null, category: categoryId || 'All' },
    rows: pageRows,
    summary: summaryObj,
    pagination,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------- Income Report ----------------
async function buildIncomeReport(query, opts) {
  const { dateFrom, dateTo } = parseDateRange(query);
  const categoryId = query.category && query.category !== 'All' ? query.category : null;
  if (categoryId) {
    if (!isValidId(categoryId)) throw new AppError('Invalid category filter', 400);
    const cat = await Category.findById(categoryId);
    if (!cat) throw new AppError('Category not found', 400);
  }

  const filter = {};
  if (dateFrom || dateTo) filter.date = { ...(dateFrom ? { $gte: dateFrom } : {}), ...(dateTo ? { $lte: dateTo } : {}) };
  if (categoryId) filter.categoryId = categoryId;

  const total = await sumDecimal(Income, filter);
  let items;
  if (opts.paginate) {
    const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
    items = await Income.find(filter)
      .populate('categoryId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
  } else {
    items = await Income.find(filter).populate('categoryId', 'name').sort({ date: -1, createdAt: -1 });
  }

  const rows = items.map((i) => ({
    _id: i._id,
    date: i.date,
    categoryName: i.categoryId ? i.categoryId.name : '',
    description: i.description || '',
    reference: i.reference || '',
    amount: i.amount.toString(),
    notes: i.notes || '',
  }));

  const summaryObj = { totalOtherIncome: total.toString(), count: rows.length };
  const { rows: pageRows, pagination } = opts.paginate
    ? { rows, pagination: { page: Math.max(1, parseInt(query.page, 10) || 1), limit: Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50)), total: rows.length, totalPages: 1 } }
    : { rows, pagination: null };
  return {
    reportType: 'income',
    filters: { dateFrom: query.dateFrom || null, dateTo: query.dateTo || null, category: categoryId || 'All' },
    rows: pageRows,
    summary: summaryObj,
    pagination,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------- Combined Financial Report ----------------
async function buildFinancialReport(query, opts) {
  const { dateFrom, dateTo } = parseDateRange(query);
  const paymentMatch = {};
  const incomeMatch = {};
  const expenseMatch = { deleted: false };
  if (dateFrom || dateTo) {
    const range = { ...(dateFrom ? { $gte: dateFrom } : {}), ...(dateTo ? { $lte: dateTo } : {}) };
    paymentMatch.date = range;
    incomeMatch.date = range;
    expenseMatch.date = range;
  }

  const [customerPaymentsReceived, otherIncome, expenses] = await Promise.all([
    sumDecimal(Payment, paymentMatch),
    sumDecimal(Income, incomeMatch),
    sumDecimal(Expense, expenseMatch),
  ]);

  // Outstanding receivables are current-state, not date-filtered.
  const [plots, paidRows] = await Promise.all([
    Plot.find({ agreementAmount: { $ne: null } }).select('agreementAmount'),
    Payment.aggregate([{ $group: { _id: '$plotId', paid: { $sum: '$amount' } } }]),
  ]);
  const paidByPlot = new Map(paidRows.map((r) => [r._id.toString(), new Decimal(r.paid.toString())]));
  let outstandingReceivables = new Decimal(0);
  for (const plot of plots) {
    const agreement = new Decimal(plot.agreementAmount.toString());
    const paid = paidByPlot.get(plot._id.toString()) || new Decimal(0);
    const outstanding = Decimal.max(0, agreement.minus(paid));
    if (outstanding.gt(0)) outstandingReceivables = outstandingReceivables.plus(outstanding);
  }

  const operatingIncomeResult = otherIncome.minus(expenses);
  const summaryObj = {
    customerPaymentsReceived: customerPaymentsReceived.toString(),
    otherIncome: otherIncome.toString(),
    expenses: expenses.toString(),
    operatingIncomeResult: operatingIncomeResult.toString(),
    outstandingReceivables: outstandingReceivables.toString(),
  };

  return {
    reportType: 'financial',
    filters: { dateFrom: query.dateFrom || null, dateTo: query.dateTo || null },
    rows: [],
    summary: summaryObj,
    pagination: null,
    generatedAt: new Date().toISOString(),
  };
}

const BUILDERS = {
  customers: buildCustomerReport,
  plots: buildPlotReport,
  payments: buildPaymentReport,
  expenses: buildExpenseReport,
  income: buildIncomeReport,
  financial: buildFinancialReport,
};

export function getReportTypes() {
  return REPORT_TYPES;
}

export async function buildReport(type, query, opts = { paginate: true }) {
  const builder = BUILDERS[type];
  if (!builder) throw new AppError('Invalid report type', 400);
  return builder(query, opts);
}

// ---------------- Exports ----------------
const REPORT_TITLES = {
  customers: 'Customer Report',
  plots: 'Plot Report',
  payments: 'Payment Report',
  expenses: 'Expense Report',
  income: 'Income Report',
  financial: 'Combined Financial Report',
};

function formatINR(value) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN');
}

// Column metadata: [{ key, header }]
function reportColumns(type) {
  switch (type) {
    case 'customers':
      return [
        { key: 'name', header: 'Customer' },
        { key: 'phone', header: 'Phone' },
        { key: 'email', header: 'Email' },
        { key: 'plotCount', header: 'Plots' },
        { key: 'agreementValue', header: 'Agreement Value', money: true },
        { key: 'paymentReceived', header: 'Payments Received', money: true },
        { key: 'outstanding', header: 'Outstanding', money: true },
      ];
    case 'plots':
      return [
        { key: 'plotNumber', header: 'Plot' },
        { key: 'area', header: 'Area' },
        { key: 'areaUnit', header: 'Unit' },
        { key: 'location', header: 'Location' },
        { key: 'status', header: 'Status' },
        { key: 'listPrice', header: 'List Price', money: true },
        { key: 'agreementAmount', header: 'Agreement', money: true },
        { key: 'customerName', header: 'Customer' },
        { key: 'paid', header: 'Paid', money: true },
        { key: 'outstanding', header: 'Outstanding', money: true },
      ];
    case 'payments':
      return [
        { key: 'date', header: 'Date' },
        { key: 'customerName', header: 'Customer' },
        { key: 'plotNumber', header: 'Plot' },
        { key: 'amount', header: 'Amount', money: true },
        { key: 'method', header: 'Method' },
        { key: 'reference', header: 'Reference' },
        { key: 'notes', header: 'Notes' },
      ];
    case 'expenses':
    case 'income':
      return [
        { key: 'date', header: 'Date' },
        { key: 'categoryName', header: 'Category' },
        { key: 'description', header: 'Description' },
        { key: 'reference', header: 'Reference' },
        { key: 'amount', header: 'Amount', money: true },
        { key: 'notes', header: 'Notes' },
      ];
    default:
      return [];
  }
}

function cellText(type, col, row) {
  const v = row[col.key];
  if (col.money) {
    if (v === null || v === undefined || v === '') return '—';
    return formatINR(v);
  }
  if (col.key === 'date') return fmtDate(v);
  return v === null || v === undefined ? '' : String(v);
}

function summaryLines(report) {
  const s = report.summary;
  switch (report.reportType) {
    case 'customers':
      return [
        ['Customers', s.customers],
        ['Total Agreement Value', formatINR(s.agreementValue)],
        ['Total Payments Received', formatINR(s.paymentReceived)],
        ['Total Outstanding', formatINR(s.outstanding)],
      ];
    case 'plots':
      return [
        ['Plots', s.plots],
        ['Total Agreement Value', formatINR(s.agreementValue)],
        ['Total Paid', formatINR(s.totalPaid)],
        ['Total Outstanding', formatINR(s.totalOutstanding)],
      ];
    case 'payments':
      return [['Total Payments Received', formatINR(s.totalPayments)], ['Records', s.count]];
    case 'expenses':
      return [['Total Expenses', formatINR(s.totalExpenses)], ['Records', s.count]];
    case 'income':
      return [['Total Other Income', formatINR(s.totalOtherIncome)], ['Records', s.count]];
    case 'financial':
      return [
        ['Customer Payments Received', formatINR(s.customerPaymentsReceived)],
        ['Other Income', formatINR(s.otherIncome)],
        ['Expenses', formatINR(s.expenses)],
        ['Operating Income Result', formatINR(s.operatingIncomeResult)],
        ['Outstanding Receivables', formatINR(s.outstandingReceivables)],
      ];
    default:
      return [];
  }
}

function buildCSV(report) {
  const cols = reportColumns(report.reportType);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [];
  lines.push(`"DS Properties - ${REPORT_TITLES[report.reportType]}"`);
  lines.push(`"Generated At","${report.generatedAt}"`);
  lines.push(`"Filters","${JSON.stringify(report.filters).replace(/"/g, '""')}"`);
  lines.push(cols.map((c) => esc(c.header)).join(','));
  for (const row of report.rows) {
    lines.push(cols.map((c) => esc(cellText(report.reportType, c, row))).join(','));
  }
  for (const [label, value] of summaryLines(report)) {
    lines.push(esc(label) + ',' + esc(typeof value === 'string' && value.startsWith('₹') ? value : String(value)));
  }
  return lines.join('\n');
}

function buildExcel(report) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  const cols = reportColumns(report.reportType);

  ws.addRow([`DS Properties — ${REPORT_TITLES[report.reportType]}`]);
  ws.addRow([`Generated At: ${report.generatedAt}`]);
  ws.addRow([`Filters: ${JSON.stringify(report.filters)}`]);
  ws.addRow([]);

  const headerRow = ws.addRow(cols.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
  headerRow.font = { bold: true, color: { argb: 'FFF2EFEA' } };

  for (const row of report.rows) {
    const values = cols.map((c) => {
      const v = row[c.key];
      if (c.money) return v === null || v === '' ? null : Number(v);
      if (c.key === 'date') return v ? new Date(v) : null;
      return v === null || v === undefined ? '' : v;
    });
    const r = ws.addRow(values);
    cols.forEach((c, idx) => {
      if (c.money) {
        const cell = r.getCell(idx + 1);
        if (cell.value !== null) {
          cell.numFmt = '₹#,##0.00';
        }
      }
    });
  }

  const startSummary = ws.rowCount + 2;
  for (const [label, value] of summaryLines(report)) {
    const r = ws.addRow([label, typeof value === 'string' && value.startsWith('₹') ? value : String(value)]);
    r.font = { bold: true };
  }

  ws.columns.forEach((column, idx) => {
    let max = 10;
    ws.eachRow((r) => {
      const cell = r.getCell(idx + 1);
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    column.width = Math.min(40, max + 2);
  });

  return wb.xlsx.writeBuffer();
}

function buildPDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cols = reportColumns(report.reportType);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1A1A2E').text('DS Properties', { align: 'left' });
    doc.font('Helvetica-Bold').fontSize(13).text(REPORT_TITLES[report.reportType]);
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text(`Generated At: ${report.generatedAt}`);
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text(`Filters: ${JSON.stringify(report.filters)}`);
    doc.moveDown();

    if (report.rows.length === 0 && report.reportType !== 'financial') {
      doc.font('Helvetica').text('No records found for the selected filters.');
    } else {
      const tableTop = doc.y;
      const pageWidth = doc.page.width - 80;
      const colWidths = cols.map(() => pageWidth / cols.length);
      let y = tableTop;

      const drawHeader = () => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#F2EFEA');
        doc.rect(40, y, pageWidth, 18).fill('#1A1A2E');
        let x = 44;
        cols.forEach((c, i) => {
          doc.text(c.header, x, y + 5, { width: colWidths[i] - 6, ellipsis: true });
          x += colWidths[i];
        });
        y += 18;
      };
      drawHeader();

      doc.font('Helvetica').fontSize(8).fillColor('#1A1A2E');
      report.rows.forEach((row, ri) => {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 40;
          drawHeader();
          doc.font('Helvetica').fontSize(8).fillColor('#1A1A2E');
        }
        let x = 44;
        cols.forEach((c, i) => {
          const text = cellText(report.reportType, c, row);
          doc.text(text, x, y + 4, { width: colWidths[i] - 6, ellipsis: true });
          x += colWidths[i];
        });
        doc.rect(40, y, pageWidth, 16).stroke('#DDDDDD');
        y += 16;
      });
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A1A2E').text('Summary', { underline: true });
    for (const [label, value] of summaryLines(report)) {
      doc.font('Helvetica').fontSize(9).text(`${label}: ${value}`);
    }

    doc.end();
  });
}

export async function exportReport(type, query, format) {
  const report = await buildReport(type, query, { paginate: false });
  const title = REPORT_TITLES[type] || 'Report';
  if (format === 'csv') {
    return { contentType: 'text/csv; charset=utf-8', content: buildCSV(report), filename: `${type}-report.csv` };
  }
  if (format === 'excel') {
    const buf = await buildExcel(report);
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: buf,
      filename: `${type}-report.xlsx`,
    };
  }
  if (format === 'pdf') {
    const buf = await buildPDF(report);
    return { contentType: 'application/pdf', content: buf, filename: `${type}-report.pdf` };
  }
  throw new AppError('Unsupported export format', 400);
}
