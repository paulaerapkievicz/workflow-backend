// src/services/invoiceService.ts
import { Invoice, InvoiceCreationAttributes } from '../models/Invoice';
import { Job } from '../models/Job';
import { Payment } from '../models/Payment';

const includes = [
  { model: Job, as: 'invoiceJob' },
  { model: Payment, as: 'invoicePayment' },
];

export const invoiceService = {
  async create(data: InvoiceCreationAttributes) {
    return Invoice.create(data);
  },

  async getAllInvoices() {
    return Invoice.findAll({ include: includes, order: [['createdAt', 'DESC']] });
  },

  async findById(id: string) {
    return Invoice.findByPk(id, { include: includes });
  },

  async update(id: string, data: Partial<InvoiceCreationAttributes>) {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) return null;
    return invoice.update(data);
  },

  async delete(id: string) {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) return null;
    await invoice.destroy();
    return true;
  },

  async findBySupermarket(supermarketId: string) {
    return Invoice.findAll({ where: { supermarketId }, include: includes, order: [['createdAt', 'DESC']] });
  },
};
