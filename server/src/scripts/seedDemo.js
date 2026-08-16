/**
 * seedDemo.js — DEVELOPMENT / SAMPLE DATA ONLY
 * ============================================================
 * This script populates the DS Properties database with a realistic,
 * internally consistent, COMPLETELY FICTIONAL Indian plotting/property
 * dataset for LOCAL DEVELOPMENT, TESTING, UI VERIFICATION and future
 * Dashboard/Reports development.
 *
 * SAFETY:
 *  - This is NOT production data and NOT real personal information.
 *  - It NEVER modifies the Admin account, authentication, or any
 *    pre-existing real records.
 *  - It NEVER deletes or wipes the database.
 *  - It is IDEMPOTENT: running `npm run seed:demo` repeatedly will
 *    reuse existing matching records by deterministic lookup keys and
 *    will NOT create duplicates.
 *
 * Run with:  npm run seed:demo
 * ============================================================
 */

import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import { env } from '../config/env.js';
import { seedCategories } from '../services/category.service.js';
import Customer from '../models/Customer.js';
import Plot from '../models/Plot.js';
import Payment from '../models/Payment.js';
import Category from '../models/Category.js';
import Expense from '../models/Expense.js';

// ---- helpers -------------------------------------------------
const D = (v) => mongoose.Types.Decimal128.fromString(new Decimal(v).toString());
const toDate = (s) => new Date(s);

// =====================================================================
// 1. CUSTOMERS  (25 fictional customers; some own 0 plots, some many)
// =====================================================================
const CUSTOMERS = [
  { key: 'c1',  name: 'Aarav Sharma',    phone: '+91 98123 45678', email: 'aarav.sharma@example.com',   address: '14, Rose Villa, Indiranagar, Bengaluru, Karnataka - 560038', notes: 'Owns multiple plots. Prefers bank transfers.' },
  { key: 'c2',  name: 'Diya Patel',      phone: '+91 98234 56789', email: 'diya.patel@example.com',     address: '22, Lotus Apartments, Navrangpura, Ahmedabad, Gujarat - 380009', notes: 'Repeat customer. Negotiated discount on P-021.' },
  { key: 'c3',  name: 'Rohan Mehta',     phone: '+91 98345 67890', email: 'rohan.mehta@example.com',    address: '7, Green Meadows, Banjara Hills, Hyderabad, Telangana - 500034', notes: 'Plot reserved, yet to start payments.' },
  { key: 'c4',  name: 'Ananya Iyer',     phone: '+91 98456 78901', email: 'ananya.iyer@example.com',    address: '3B, Lake View, Adyar, Chennai, Tamil Nadu - 600020', notes: 'Made initial token payment via UPI.' },
  { key: 'c5',  name: 'Vikram Singh',    phone: '+91 98567 89012', email: 'vikram.singh@example.com',   address: '45, Defence Colony, New Delhi - 110024', notes: 'Owns two plots. Prompt payer.' },
  { key: 'c6',  name: 'Priya Nair',      phone: '+91 98678 90123', email: 'priya.nair@example.com',     address: '9, Marine Drive, Kochi, Kerala - 682011', notes: 'Plot reserved, awaiting finance.' },
  { key: 'c7',  name: 'Arjun Reddy',     phone: '+91 98789 01234', email: 'arjun.reddy@example.com',    address: '18, Jubilee Hills, Hyderabad, Telangana - 500033', notes: 'High-value plot, nearly fully paid.' },
  { key: 'c8',  name: 'Kavya Rao',       phone: '+91 98890 12345', email: 'kavya.rao@example.com',      address: '21, Jayanagar, Bengaluru, Karnataka - 560011', notes: 'Reserved plot, no payments yet.' },
  { key: 'c9',  name: 'Suresh Kumar',    phone: '+91 98901 23456', email: 'suresh.kumar@example.com',   address: '5, T. Nagar, Chennai, Tamil Nadu - 600017', notes: 'Owns two plots, fully paid both.' },
  { key: 'c10', name: 'Meera Joshi',     phone: '+91 99012 34567', email: 'meera.joshi@example.com',    address: '33, Koregaon Park, Pune, Maharashtra - 411001', notes: 'Owns two plots, both fully paid.' },
  { key: 'c11', name: 'Karan Malhotra',  phone: '+91 99123 45678', email: 'karan.malhotra@example.com', address: '12, Vasant Kunj, New Delhi - 110070', notes: 'Reserved plot, paperwork pending.' },
  { key: 'c12', name: 'Neha Gupta',      phone: '+91 99234 56789', email: 'neha.gupta@example.com',     address: '8, Vaishali Nagar, Jaipur, Rajasthan - 302021', notes: 'Owns two plots.' },
  { key: 'c13', name: 'Aditya Verma',    phone: '+91 99345 67890', email: 'aditya.verma@example.com',   address: '27, Gomti Nagar, Lucknow, Uttar Pradesh - 226010', notes: 'Owns two plots, both fully paid.' },
  { key: 'c14', name: 'Pooja Bansal',    phone: '+91 99456 78901', email: 'pooja.bansal@example.com',   address: '16, Civil Lines, Nagpur, Maharashtra - 440001', notes: 'Reserved plot, no payments yet.' },
  { key: 'c15', name: 'Rahul Khanna',    phone: '+91 99567 89012', email: 'rahul.khanna@example.com',   address: '41, Model Town, Ludhiana, Punjab - 141002', notes: 'Owns two plots.' },
  { key: 'c16', name: 'Sanya Kapoor',    phone: '+91 99678 90123', email: 'sanya.kapoor@example.com',   address: '19, Salt Lake, Kolkata, West Bengal - 700091', notes: 'Reserved plot, awaiting loan approval.' },
  { key: 'c17', name: 'Vivek Agarwal',   phone: '+91 99789 01234', email: 'vivek.agarwal@example.com',  address: '6, Civil Lines, Prayagraj, Uttar Pradesh - 211001', notes: 'Owns two plots, both fully paid.' },
  { key: 'c18', name: 'Tanvi Desai',     phone: '+91 99890 12345', email: 'tanvi.desai@example.com',    address: '24, Satellite, Ahmedabad, Gujarat - 380015', notes: 'Reserved plot, no payments yet.' },
  { key: 'c19', name: 'Mohit Chauhan',   phone: '+91 90012 34567', email: 'mohit.chauhan@example.com',  address: '11, Rajouri Garden, New Delhi - 110027', notes: 'Enquiry only, no plots yet.' },
  { key: 'c20', name: 'Ishita Sen',      phone: '+91 90123 45678', email: 'ishita.sen@example.com',     address: '30, Ballygunge, Kolkata, West Bengal - 700019', notes: 'Referred by Aarav Sharma.' },
  { key: 'c21', name: 'Yash Tiwari',     phone: '+91 90234 56789', email: 'yash.tiwari@example.com',    address: '13, Saket, New Delhi - 110017', notes: 'Potential buyer, follow up pending.' },
  { key: 'c22', name: 'Riya Saxena',     phone: '+91 90345 67890', email: 'riya.saxena@example.com',    address: '52, Malviya Nagar, Jaipur, Rajasthan - 302017', notes: 'Visited site, undecided.' },
  { key: 'c23', name: 'Devendra Yadav',  phone: '+91 90456 78901', email: 'devendra.yadav@example.com', address: '4, Hazratganj, Lucknow, Uttar Pradesh - 226001', notes: 'Walk-in enquiry.' },
  { key: 'c24', name: 'Nandini Menon',   phone: '+91 90567 89012', email: 'nandini.menon@example.com',  address: '29, Edappally, Kochi, Kerala - 682024', notes: 'Called about available plots.' },
  { key: 'c25', name: 'Sahil Bhardwaj',  phone: '+91 90678 90123', email: 'sahil.bhardwaj@example.com', address: '17, Sector 17, Chandigarh - 160017', notes: 'Newsletter subscriber.' },
];

// =====================================================================
// 2. PLOTS  (40 plots; Available=unassigned, others=assigned)
//    Each assigned plot carries a nested `payments` array so that
//    Payment.customerId === Plot.customerId is guaranteed by construction.
// =====================================================================
const PLOTS = [
  // ---- Available (unassigned) ----
  { plotNumber: 'P-001', area: 1200, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 500000, status: 'Available', customerKey: null, notes: 'Corner plot, road-facing.' },
  { plotNumber: 'P-002', area: 1000, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 450000, status: 'Available', customerKey: null, notes: 'Near park.' },
  { plotNumber: 'P-003', area: 1500, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 650000, status: 'Available', customerKey: null, notes: 'Large plot.' },
  { plotNumber: 'P-004', area: 900,  areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 420000, status: 'Available', customerKey: null, notes: 'Standard size.' },
  { plotNumber: 'P-005', area: 1100, areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 480000, status: 'Available', customerKey: null, notes: 'East-facing.' },
  { plotNumber: 'P-006', area: 1300, areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 550000, status: 'Available', customerKey: null, notes: 'Corner.' },
  { plotNumber: 'P-007', area: 1000, areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 460000, status: 'Available', customerKey: null, notes: 'Mid-row.' },
  { plotNumber: 'P-008', area: 1400, areaUnit: 'sq.yd', location: 'DS Heritage Park, Chennai', price: 600000, status: 'Available', customerKey: null, notes: 'Premium location.' },
  { plotNumber: 'P-009', area: 800,  areaUnit: 'sq.yd', location: 'DS Heritage Park, Chennai', price: 380000, status: 'Available', customerKey: null, notes: 'Compact plot.' },
  { plotNumber: 'P-010', area: 1200, areaUnit: 'sq.yd', location: 'DS Royal Gardens, Mysuru', price: 520000, status: 'Available', customerKey: null, notes: 'Garden-facing.' },

  // ---- Reserved (assigned, customerId + negotiated price, mostly no payments yet) ----
  { plotNumber: 'P-011', area: 1000, areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 600000, status: 'Reserved', customerKey: 'c3', notes: 'Reserved on token, payments pending.', payments: [] },
  { plotNumber: 'P-012', area: 950,  areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 550000, status: 'Reserved', customerKey: 'c8', notes: 'Negotiated ₹10,000 discount.', payments: [] },
  { plotNumber: 'P-013', area: 1200, areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 700000, status: 'Reserved', customerKey: 'c14', notes: 'Discount agreed.', payments: [] },
  { plotNumber: 'P-014', area: 800,  areaUnit: 'sq.yd', location: 'DS Heritage Park, Chennai', price: 450000, status: 'Reserved', customerKey: 'c16', notes: 'Awaiting loan.', payments: [] },
  { plotNumber: 'P-015', area: 1400, areaUnit: 'sq.yd', location: 'DS Royal Gardens, Mysuru', price: 800000, status: 'Reserved', customerKey: 'c18', notes: 'Premium discount.', payments: [] },
  { plotNumber: 'P-016', area: 1500, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 900000, status: 'Reserved', customerKey: 'c4', notes: 'One token payment received.', payments: [
    { date: '2024-06-15', amount: 100000, method: 'UPI', reference: 'UPI-2024-0615', notes: 'Token amount' },
  ] },
  { plotNumber: 'P-017', area: 1100, areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 650000, status: 'Reserved', customerKey: 'c6', notes: 'Discount agreed.', payments: [] },
  { plotNumber: 'P-018', area: 900,  areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 500000, status: 'Reserved', customerKey: 'c11', notes: 'Paperwork pending.', payments: [] },

  // ---- Allocated (assigned, partial payments) ----
  { plotNumber: 'P-019', area: 1200, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 750000, status: 'Allocated', customerKey: 'c1', notes: 'One installment paid.', payments: [
    { date: '2024-02-10', amount: 200000, method: 'Bank Transfer', reference: 'NEFT-AB12', notes: 'First installment' },
  ] },
  { plotNumber: 'P-020', area: 1300, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 800000, status: 'Allocated', customerKey: 'c1', notes: 'Two installments paid.', payments: [
    { date: '2023-11-20', amount: 200000, method: 'Cash', reference: 'CSH-2023-1120', notes: 'Cash installment' },
    { date: '2024-03-15', amount: 150000, method: 'Cheque', reference: 'CHQ-4451', notes: 'Cheque installment' },
  ] },
  { plotNumber: 'P-021', area: 1600, areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 1000000, status: 'Allocated', customerKey: 'c2', notes: 'Three installments paid.', payments: [
    { date: '2023-09-05', amount: 300000, method: 'UPI', reference: 'UPI-2023-0905', notes: 'First' },
    { date: '2024-01-12', amount: 200000, method: 'Bank Transfer', reference: 'NEFT-CD34', notes: 'Second' },
    { date: '2024-05-20', amount: 150000, method: 'Cash', reference: 'CSH-2024-0520', notes: 'Third' },
  ] },
  { plotNumber: 'P-022', area: 900,  areaUnit: 'sq.yd', location: 'DS Heritage Park, Chennai', price: 500000, status: 'Allocated', customerKey: 'c5', notes: 'One installment paid.', payments: [
    { date: '2024-04-18', amount: 150000, method: 'UPI', reference: 'UPI-2024-0418', notes: 'First' },
  ] },
  { plotNumber: 'P-023', area: 1900, areaUnit: 'sq.yd', location: 'DS Royal Gardens, Mysuru', price: 1200000, status: 'Allocated', customerKey: 'c7', notes: 'Nearly fully paid.', payments: [
    { date: '2023-10-10', amount: 600000, method: 'Bank Transfer', reference: 'NEFT-EF56', notes: 'First' },
    { date: '2024-02-28', amount: 500000, method: 'Cheque', reference: 'CHQ-7782', notes: 'Second' },
  ] },
  { plotNumber: 'P-024', area: 1000, areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 600000, status: 'Allocated', customerKey: 'c9', notes: 'Two installments paid.', payments: [
    { date: '2024-01-22', amount: 250000, method: 'Cash', reference: 'CSH-2024-0122', notes: 'First' },
    { date: '2024-06-30', amount: 150000, method: 'UPI', reference: 'UPI-2024-0630', notes: 'Second' },
  ] },
  { plotNumber: 'P-025', area: 1500, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 900000, status: 'Allocated', customerKey: 'c10', notes: 'One installment paid.', payments: [
    { date: '2023-12-05', amount: 300000, method: 'Bank Transfer', reference: 'NEFT-GH78', notes: 'First' },
  ] },
  { plotNumber: 'P-026', area: 1200, areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 700000, status: 'Allocated', customerKey: 'c12', notes: 'Two installments paid.', payments: [
    { date: '2024-03-08', amount: 150000, method: 'UPI', reference: 'UPI-2024-0308', notes: 'First' },
    { date: '2024-07-14', amount: 100000, method: 'Cash', reference: 'CSH-2024-0714', notes: 'Second' },
  ] },
  { plotNumber: 'P-027', area: 1800, areaUnit: 'sq.yd', location: 'DS Royal Gardens, Mysuru', price: 1100000, status: 'Allocated', customerKey: 'c13', notes: 'Two installments paid.', payments: [
    { date: '2023-08-19', amount: 300000, method: 'Cheque', reference: 'CHQ-2210', notes: 'First' },
    { date: '2024-04-25', amount: 200000, method: 'Bank Transfer', reference: 'NEFT-IJ90', notes: 'Second' },
  ] },
  { plotNumber: 'P-028', area: 1400, areaUnit: 'sq.yd', location: 'DS Heritage Park, Chennai', price: 850000, status: 'Allocated', customerKey: 'c15', notes: 'First payment pending.', payments: [] },
  { plotNumber: 'P-029', area: 1100, areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 650000, status: 'Allocated', customerKey: 'c17', notes: 'Fully paid in single installment.', payments: [
    { date: '2024-05-11', amount: 650000, method: 'Bank Transfer', reference: 'NEFT-KL01', notes: 'Full payment' },
  ] },
  { plotNumber: 'P-030', area: 950,  areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 550000, status: 'Allocated', customerKey: 'c2', notes: 'One installment paid.', payments: [
    { date: '2024-02-02', amount: 100000, method: 'Cash', reference: 'CSH-2024-0202', notes: 'First' },
  ] },

  // ---- Sold (assigned, fully or nearly fully paid) ----
  { plotNumber: 'P-031', area: 1600, areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 1000000, status: 'Sold', customerKey: 'c1', notes: 'Fully paid.', payments: [
    { date: '2023-07-01', amount: 400000, method: 'Bank Transfer', reference: 'NEFT-MN12', notes: 'First' },
    { date: '2023-10-15', amount: 300000, method: 'UPI', reference: 'UPI-2023-1015', notes: 'Second' },
    { date: '2024-01-30', amount: 300000, method: 'Cheque', reference: 'CHQ-3394', notes: 'Final' },
  ] },
  { plotNumber: 'P-032', area: 1900, areaUnit: 'sq.yd', location: 'DS Royal Gardens, Mysuru', price: 1200000, status: 'Sold', customerKey: 'c2', notes: 'Fully paid in four installments.', payments: [
    { date: '2023-06-12', amount: 300000, method: 'Cash', reference: 'CSH-2023-0612', notes: 'First' },
    { date: '2023-09-20', amount: 300000, method: 'UPI', reference: 'UPI-2023-0920', notes: 'Second' },
    { date: '2024-01-10', amount: 300000, method: 'Bank Transfer', reference: 'NEFT-OP23', notes: 'Third' },
    { date: '2024-04-05', amount: 300000, method: 'Cheque', reference: 'CHQ-5567', notes: 'Final' },
  ] },
  { plotNumber: 'P-033', area: 1500, areaUnit: 'sq.yd', location: 'DS Heritage Park, Chennai', price: 900000, status: 'Sold', customerKey: 'c5', notes: 'Fully paid.', payments: [
    { date: '2023-11-02', amount: 500000, method: 'Bank Transfer', reference: 'NEFT-QR34', notes: 'First' },
    { date: '2024-03-19', amount: 400000, method: 'Cash', reference: 'CSH-2024-0319', notes: 'Final' },
  ] },
  { plotNumber: 'P-034', area: 2400, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 1500000, status: 'Sold', customerKey: 'c7', notes: 'Nearly fully paid (₹1,00,000 outstanding).', payments: [
    { date: '2023-08-08', amount: 600000, method: 'Bank Transfer', reference: 'NEFT-ST45', notes: 'First' },
    { date: '2024-01-25', amount: 500000, method: 'Cheque', reference: 'CHQ-6678', notes: 'Second' },
    { date: '2024-06-10', amount: 300000, method: 'UPI', reference: 'UPI-2024-0610', notes: 'Third' },
  ] },
  { plotNumber: 'P-035', area: 1200, areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 750000, status: 'Sold', customerKey: 'c9', notes: 'Fully paid.', payments: [
    { date: '2024-02-14', amount: 400000, method: 'Cash', reference: 'CSH-2024-0214', notes: 'First' },
    { date: '2024-07-22', amount: 350000, method: 'Bank Transfer', reference: 'NEFT-UV56', notes: 'Final' },
  ] },
  { plotNumber: 'P-036', area: 1300, areaUnit: 'sq.yd', location: 'DS Sai Enclave, Phase 2, Hyderabad', price: 800000, status: 'Sold', customerKey: 'c10', notes: 'Fully paid.', payments: [
    { date: '2023-10-30', amount: 300000, method: 'UPI', reference: 'UPI-2023-1030', notes: 'First' },
    { date: '2024-02-18', amount: 300000, method: 'Bank Transfer', reference: 'NEFT-WX67', notes: 'Second' },
    { date: '2024-08-05', amount: 200000, method: 'Cash', reference: 'CSH-2024-0805', notes: 'Final' },
  ] },
  { plotNumber: 'P-037', area: 1000, areaUnit: 'sq.yd', location: 'DS Heritage Park, Chennai', price: 600000, status: 'Sold', customerKey: 'c12', notes: 'Fully paid.', payments: [
    { date: '2024-03-28', amount: 350000, method: 'Cheque', reference: 'CHQ-7781', notes: 'First' },
    { date: '2024-09-12', amount: 250000, method: 'Bank Transfer', reference: 'NEFT-YZ78', notes: 'Final' },
  ] },
  { plotNumber: 'P-038', area: 2100, areaUnit: 'sq.yd', location: 'DS Royal Gardens, Mysuru', price: 1300000, status: 'Sold', customerKey: 'c13', notes: 'Fully paid.', payments: [
    { date: '2023-09-15', amount: 500000, method: 'Bank Transfer', reference: 'NEFT-AB90', notes: 'First' },
    { date: '2024-02-22', amount: 400000, method: 'UPI', reference: 'UPI-2024-0222', notes: 'Second' },
    { date: '2024-07-30', amount: 400000, method: 'Cheque', reference: 'CHQ-8890', notes: 'Final' },
  ] },
  { plotNumber: 'P-039', area: 1700, areaUnit: 'sq.yd', location: 'DS Green Valley, Sector 1, Bengaluru', price: 1050000, status: 'Sold', customerKey: 'c15', notes: 'Fully paid.', payments: [
    { date: '2024-01-05', amount: 600000, method: 'Cash', reference: 'CSH-2024-0105', notes: 'First' },
    { date: '2024-06-18', amount: 450000, method: 'Bank Transfer', reference: 'NEFT-CD01', notes: 'Final' },
  ] },
  { plotNumber: 'P-040', area: 1500, areaUnit: 'sq.yd', location: 'DS Sunrise Layout, Pune', price: 950000, status: 'Sold', customerKey: 'c17', notes: 'Fully paid.', payments: [
    { date: '2023-12-20', amount: 400000, method: 'UPI', reference: 'UPI-2023-1220', notes: 'First' },
    { date: '2024-04-15', amount: 300000, method: 'Cheque', reference: 'CHQ-9901', notes: 'Second' },
    { date: '2024-09-28', amount: 250000, method: 'Bank Transfer', reference: 'NEFT-EF02', notes: 'Final' },
  ] },
];

// =====================================================================
// 3. EXPENSES  (40 fictional expense records; references expense cats)
// =====================================================================
const EXPENSES = [
  { categoryName: 'Road Construction', date: '2023-07-10', amount: 250000, description: 'Road material purchase - Phase 1', reference: 'INV-RC-001', notes: 'Tar & aggregates' },
  { categoryName: 'Road Construction', date: '2024-01-15', amount: 180000, description: 'Road laying labor & material', reference: 'INV-RC-014', notes: '' },
  { categoryName: 'Gutter Work',      date: '2023-08-20', amount: 95000,  description: 'Gutter construction materials', reference: 'INV-GW-003', notes: 'Sector 1 drains' },
  { categoryName: 'Gutter Work',      date: '2024-03-12', amount: 120000, description: 'Stormwater drain work', reference: 'INV-GW-009', notes: '' },
  { categoryName: 'Electricity',      date: '2023-09-05', amount: 145000, description: 'Electrical pole installation', reference: 'INV-EL-002', notes: '3 poles' },
  { categoryName: 'Electricity',      date: '2024-02-28', amount: 88000,  description: 'Street light wiring', reference: 'INV-EL-011', notes: '' },
  { categoryName: 'Water',            date: '2023-10-18', amount: 76000,  description: 'Water connection work', reference: 'INV-WT-004', notes: 'Borewell + pipeline' },
  { categoryName: 'Water',            date: '2024-04-22', amount: 64000,  description: 'Overhead tank maintenance', reference: 'INV-WT-012', notes: '' },
  { categoryName: 'Labor',            date: '2023-11-01', amount: 55000,  description: 'Site labor payment - weekly', reference: 'LAB-2301', notes: '10 workers' },
  { categoryName: 'Labor',            date: '2023-12-15', amount: 60000,  description: 'Site labor payment - weekly', reference: 'LAB-2312', notes: '' },
  { categoryName: 'Labor',            date: '2024-01-20', amount: 58000,  description: 'Site labor payment - weekly', reference: 'LAB-2401', notes: '' },
  { categoryName: 'Labor',            date: '2024-02-25', amount: 62000,  description: 'Site labor payment - weekly', reference: 'LAB-2402', notes: '' },
  { categoryName: 'Labor',            date: '2024-03-30', amount: 65000,  description: 'Site labor payment - weekly', reference: 'LAB-2403', notes: '' },
  { categoryName: 'Labor',            date: '2024-05-10', amount: 70000,  description: 'Skilled labor - masonry', reference: 'LAB-2405', notes: '' },
  { categoryName: 'Legal',            date: '2023-09-25', amount: 45000,  description: 'Legal/documentation expense', reference: 'LEG-001', notes: 'Sale deed drafting' },
  { categoryName: 'Legal',            date: '2024-06-15', amount: 38000,  description: 'Stamp duty & registration aid', reference: 'LEG-007', notes: '' },
  { categoryName: 'Other',            date: '2023-10-05', amount: 22000,  description: 'Site office rent', reference: 'OTH-001', notes: '3 months' },
  { categoryName: 'Other',            date: '2024-01-08', amount: 15000,  description: 'Printing & signage', reference: 'OTH-014', notes: 'Layout boards' },
  { categoryName: 'Other',            date: '2024-07-19', amount: 30000,  description: 'Security guard service', reference: 'OTH-022', notes: 'Q2' },
  { categoryName: 'Road Construction', date: '2024-08-12', amount: 210000, description: 'Internal roads - Phase 2', reference: 'INV-RC-031', notes: '' },
  { categoryName: 'Gutter Work',      date: '2024-09-05', amount: 105000, description: 'Kerb stone laying', reference: 'INV-GW-018', notes: '' },
  { categoryName: 'Electricity',      date: '2024-10-10', amount: 132000, description: 'Transformer connection charges', reference: 'INV-EL-020', notes: '' },
  { categoryName: 'Water',            date: '2024-11-14', amount: 71000,  description: 'Water tanker supply', reference: 'INV-WT-025', notes: 'Summer' },
  { categoryName: 'Labor',            date: '2024-06-20', amount: 68000,  description: 'Site labor payment - weekly', reference: 'LAB-2406', notes: '' },
  { categoryName: 'Labor',            date: '2024-07-25', amount: 72000,  description: 'Site labor payment - weekly', reference: 'LAB-2407', notes: '' },
  { categoryName: 'Labor',            date: '2024-08-30', amount: 75000,  description: 'Site labor payment - weekly', reference: 'LAB-2408', notes: '' },
  { categoryName: 'Legal',            date: '2024-09-18', amount: 42000,  description: 'Boundary dispute legal fee', reference: 'LEG-012', notes: '' },
  { categoryName: 'Other',            date: '2024-02-14', amount: 18000,  description: 'Tea & refreshments for labor', reference: 'OTH-016', notes: '' },
  { categoryName: 'Other',            date: '2024-03-22', amount: 25000,  description: 'Fuel for site vehicle', reference: 'OTH-019', notes: '' },
  { categoryName: 'Road Construction', date: '2025-01-10', amount: 195000, description: 'Road repair & patchwork', reference: 'INV-RC-040', notes: '' },
  { categoryName: 'Gutter Work',      date: '2025-02-15', amount: 98000,  description: 'Drain desilting', reference: 'INV-GW-027', notes: '' },
  { categoryName: 'Electricity',      date: '2025-03-20', amount: 115000, description: 'Additional street lights', reference: 'INV-EL-028', notes: '' },
  { categoryName: 'Water',            date: '2025-04-25', amount: 67000,  description: 'Pipeline extension', reference: 'INV-WT-030', notes: '' },
  { categoryName: 'Labor',            date: '2025-01-30', amount: 78000,  description: 'Site labor payment - weekly', reference: 'LAB-2501', notes: '' },
  { categoryName: 'Labor',            date: '2025-03-05', amount: 80000,  description: 'Site labor payment - weekly', reference: 'LAB-2503', notes: '' },
  { categoryName: 'Legal',            date: '2025-04-10', amount: 40000,  description: 'Title verification fee', reference: 'LEG-018', notes: '' },
  { categoryName: 'Other',            date: '2025-02-20', amount: 20000,  description: 'Site cleaning & waste removal', reference: 'OTH-031', notes: '' },
  { categoryName: 'Other',            date: '2025-05-15', amount: 35000,  description: 'Annual maintenance contract', reference: 'OTH-035', notes: 'Pump' },
  { categoryName: 'Road Construction', date: '2025-06-01', amount: 230000, description: 'Main gate & compound wall', reference: 'INV-RC-045', notes: '' },
  { categoryName: 'Electricity',      date: '2025-06-20', amount: 125000, description: 'Meter installation - new plots', reference: 'INV-EL-033', notes: '' },
];

// =====================================================================
// 4. SEEDING
// =====================================================================
async function seed() {
  console.log('========================================================');
  console.log(' DS Properties — DEMO / SAMPLE DATA SEED (development only)');
  console.log('========================================================');
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to MongoDB: ${env.mongoUri}\n`);

  // --- 4.1 Categories (idempotent via seedCategories) ---
  const createdCats = await seedCategories();
  const expenseCats = await Category.find({ type: 'expense' });
  const catByName = Object.fromEntries(expenseCats.map((c) => [c.name, c]));
  console.log(`Categories ready (${expenseCats.length} expense categories). Newly created: ${createdCats}`);

  // --- 4.2 Customers (idempotent by name + phone) ---
  const customerMap = {};
  let newCustomers = 0;
  for (const c of CUSTOMERS) {
    const { key, ...data } = c;
    let doc = await Customer.findOne({ name: data.name, phone: data.phone });
    if (!doc) {
      doc = await Customer.create(data);
      newCustomers += 1;
    }
    customerMap[key] = doc;
  }
  console.log(`Customers: ${CUSTOMERS.length} defined, ${newCustomers} newly created.`);

  // --- 4.3 Plots (idempotent by plotNumber) ---
  const plotMap = {};
  let newPlots = 0;
  for (const p of PLOTS) {
    const { customerKey, payments, ...plotData } = p;
    let doc = await Plot.findOne({ plotNumber: plotData.plotNumber });
    if (!doc) {
      const data = { ...plotData };
      data.customerId = customerKey ? customerMap[customerKey]._id : null;
      doc = await Plot.create(data);
      newPlots += 1;
    }
    plotMap[plotData.plotNumber] = doc;
  }
  console.log(`Plots: ${PLOTS.length} defined, ${newPlots} newly created.`);

  // --- 4.4 Payments (idempotent by plotId + date + amount) ---
  let newPayments = 0;
  let totalPaymentRows = 0;
  for (const p of PLOTS) {
    const plot = plotMap[p.plotNumber];
    if (!plot.customerId || !p.payments || p.payments.length === 0) continue;
    const customer = customerMap[p.customerKey];
    for (const pay of p.payments) {
      totalPaymentRows += 1;
      const exists = await Payment.findOne({
        plotId: plot._id,
        date: toDate(pay.date),
        amount: D(pay.amount),
      });
      if (!exists) {
        await Payment.create({
          customerId: customer._id,
          plotId: plot._id,
          amount: D(pay.amount),
          date: toDate(pay.date),
          method: pay.method,
          reference: pay.reference || undefined,
          notes: pay.notes || undefined,
        });
        newPayments += 1;
      }
    }
  }
  console.log(`Payments: ${totalPaymentRows} defined, ${newPayments} newly created.`);

  // --- 4.5 Expenses (idempotent by categoryId + date + amount + description) ---
  let newExpenses = 0;
  for (const e of EXPENSES) {
    const cat = catByName[e.categoryName];
    if (!cat) {
      console.warn(`  ! Skipping expense "${e.description}" — category "${e.categoryName}" not found.`);
      continue;
    }
    const exists = await Expense.findOne({
      categoryId: cat._id,
      date: toDate(e.date),
      amount: D(e.amount),
      description: e.description,
    });
    if (!exists) {
      await Expense.create({
        amount: D(e.amount),
        date: toDate(e.date),
        categoryId: cat._id,
        description: e.description,
        reference: e.reference || undefined,
        notes: e.notes || undefined,
        deleted: false,
      });
      newExpenses += 1;
    }
  }
  console.log(`Expenses: ${EXPENSES.length} defined, ${newExpenses} newly created.`);

  await mongoose.disconnect();
  console.log('\nSeed complete. Running verification...\n');
  await verify();
}

// =====================================================================
// 5. VERIFICATION
// =====================================================================
async function verify() {
  await mongoose.connect(env.mongoUri);

  const customers = await Customer.find();
  const plots = await Plot.find();
  const payments = await Payment.find();
  const expenses = await Expense.find();
  const categories = await Category.find();

  const errors = [];
  const warnings = [];

  // Customers
  const zeroPlotCustomers = customers.filter(
    (c) => !plots.some((p) => p.customerId && p.customerId.toString() === c._id.toString())
  );
  const multiPlotCustomers = customers.filter(
    (c) => plots.filter((p) => p.customerId && p.customerId.toString() === c._id.toString()).length > 1
  );

  // Plots
  const plotNumberSet = new Set(plots.map((p) => p.plotNumber));
  if (plotNumberSet.size !== plots.length) errors.push('Plot numbers are NOT unique.');

  const available = plots.filter((p) => p.status === 'Available');
  for (const p of available) {
    if (p.customerId) errors.push(`Available plot ${p.plotNumber} has a customerId.`);
  }
  const assigned = plots.filter((p) => p.status !== 'Available');
  for (const p of assigned) {
    if (!p.customerId) errors.push(`Assigned plot ${p.plotNumber} (${p.status}) has no customerId.`);
    if (p.price === null || p.price === undefined) errors.push(`Assigned plot ${p.plotNumber} (${p.status}) has no price.`);
  }

  // Payments
  const plotById = Object.fromEntries(plots.map((p) => [p._id.toString(), p]));
  const customerById = Object.fromEntries(customers.map((c) => [c._id.toString(), c]));
  const paidByPlot = {};
  for (const pay of payments) {
    const plot = plotById[pay.plotId.toString()];
    if (!plot) { errors.push(`Payment ${pay._id} references missing plot.`); continue; }
    const cust = customerById[pay.customerId.toString()];
    if (!cust) { errors.push(`Payment ${pay._id} references missing customer.`); continue; }
    if (plot.customerId && pay.customerId.toString() !== plot.customerId.toString()) {
      errors.push(`Payment ${pay._id} customerId != plot ${plot.plotNumber} customerId.`);
    }
    if (!plot.customerId) {
      errors.push(`Payment ${pay._id} belongs to unassigned plot ${plot.plotNumber}.`);
    }
    if (plot.price === null || plot.price === undefined) {
      errors.push(`Payment ${pay._id} belongs to plot ${plot.plotNumber} with no price.`);
    }
    paidByPlot[plot._id.toString()] = (paidByPlot[plot._id.toString()] || 0) + Number(pay.amount.toString());
  }

  // Overpayment check (only assigned plots carry receivables)
  let totalOutstanding = 0;
  for (const plot of plots) {
    if (!plot.customerId) continue;
    if (plot.price === null || plot.price === undefined) continue;
    const paid = paidByPlot[plot._id.toString()] || 0;
    const price = Number(plot.price.toString());
    if (paid > price + 1e-9) {
      errors.push(`Plot ${plot.plotNumber} is overpaid (paid ${paid} > price ${price}).`);
    }
    totalOutstanding += Math.max(0, price - paid);
  }

  // Expenses
  const expenseCatIds = new Set(categories.filter((c) => c.type === 'expense').map((c) => c._id.toString()));
  for (const e of expenses) {
    if (!expenseCatIds.has(e.categoryId.toString())) errors.push(`Expense ${e._id} references non-expense category.`);
    if (Number(e.amount.toString()) <= 0) errors.push(`Expense ${e._id} has non-positive amount.`);
    if (e.deleted) warnings.push(`Expense ${e._id} is soft-deleted (unexpected for seed data).`);
  }

  // Categories
  const catKeys = categories.map((c) => `${c.type}|${c.normalizedName}`);
  if (new Set(catKeys).size !== catKeys.length) errors.push('Duplicate categories detected.');

  // ---- Report ----
  console.log('==================== VERIFICATION REPORT ====================');
  console.log(`Customers           : ${customers.length}`);
  console.log(`  - with 0 plots    : ${zeroPlotCustomers.length}`);
  console.log(`  - with >1 plot    : ${multiPlotCustomers.length}`);
  console.log(`Plots               : ${plots.length}`);
  console.log(`  - Available       : ${available.length}`);
  console.log(`  - Reserved        : ${plots.filter((p) => p.status === 'Reserved').length}`);
  console.log(`  - Allocated       : ${plots.filter((p) => p.status === 'Allocated').length}`);
  console.log(`  - Sold            : ${plots.filter((p) => p.status === 'Sold').length}`);
  console.log(`Payments            : ${payments.length}`);
  console.log(`Expenses            : ${expenses.length}`);
  console.log(`Categories          : ${categories.length} (expense: ${categories.filter((c) => c.type === 'expense').length}, income: ${categories.filter((c) => c.type === 'income').length})`);
  console.log(`Total received      : ₹${Object.values(paidByPlot).reduce((a, b) => a + b, 0).toLocaleString('en-IN')}`);
  console.log(`Total outstanding   : ₹${Math.round(totalOutstanding).toLocaleString('en-IN')}`);
  console.log('------------------------------------------------------------');
  if (warnings.length) {
    console.log('Warnings:');
    warnings.forEach((w) => console.log('  - ' + w));
  }
  if (errors.length) {
    console.log('FAILED CHECKS:');
    errors.forEach((e) => console.log('  ✗ ' + e));
    console.log('============================================================');
    await mongoose.disconnect();
    process.exit(1);
  } else {
    console.log('All consistency checks PASSED ✓');
    console.log('============================================================');
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Demo seed failed:', err.message);
  process.exit(1);
});
