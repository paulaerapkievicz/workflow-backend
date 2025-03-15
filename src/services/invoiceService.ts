// src/services/invoiceService.ts
import { Invoice, InvoiceCreationAttributes } from '../models/Invoice';

export const invoiceService = {
  // Criar invoice
  // POST /invoices - Cria uma nova fatura
  async createInvoice(data: InvoiceCreationAttributes) {
    return Invoice.create(data);
  },

  // Buscar todas as invoices
  // GET /invoices - Lista todas as faturas
  async getAllInvoices() {
    return Invoice.findAll();
  },

  // Buscar invoice por ID
  // GET /invoices/:id - Retorna uma fatura específica por ID
  async getInvoiceById(id: string) {
    return Invoice.findByPk(id);
  },

  // Deletar invoice
  // DELETE /invoices/:id - Remove uma fatura
  async deleteInvoice(id: string) {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) return null;
    return invoice.destroy();
  },

  // Atualizar status da invoice
  // PATCH /invoices/:id/status - Atualiza o status da fatura
  async updateInvoiceStatus(id: string, status: 'pending' | 'paid' | 'canceled') {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) return null;
    invoice.status = status;
    return invoice.save();
  },

  // Buscar invoices de um supermercado
  // GET /invoices/supermarket/:supermarketId - Lista faturas de um supermercado
  async getInvoicesBySupermarket(supermarketId: string) {
    return Invoice.findAll({ where: { supermarketId } });
  }
};