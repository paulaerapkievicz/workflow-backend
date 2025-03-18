import { Request, Response } from 'express';
import { invoiceService } from '../services/invoiceService';

export const invoiceController = {
    // POST /invoices - Cria uma nova invoice
    async create(req: Request, res: Response) {
        try {
            const invoice = await invoiceService.create(req.body);
            res.status(201).json(invoice);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao criar invoice', error });
        }
    },

    // GET /invoices - Lista todas as invoices
    async index(req: Request, res: Response) {
        try {
            const invoices = await invoiceService.getAllInvoices();
            res.status(200).json(invoices);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao listar invoices', error });
        }
    },

    // GET /invoices/:id - Busca uma invoice pelo ID
    async show(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const invoice = await invoiceService.findById(id);
            if (!invoice) {
                return res.status(404).json({ message: 'Invoice não encontrada' });
            }
            res.status(200).json(invoice);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar invoice', error });
        }
    },

    // PUT /invoices/:id - Atualiza uma invoice
    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updatedInvoice = await invoiceService.update(id, req.body);
            if (!updatedInvoice) {
                return res.status(404).json({ message: 'Invoice não encontrada' });
            }
            res.status(200).json(updatedInvoice);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao atualizar invoice', error });
        }
    },

    // DELETE /invoices/:id - Deleta uma invoice
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const deleted = await invoiceService.delete(id);
            if (!deleted) {
                return res.status(404).json({ message: 'Invoice não encontrada' });
            }
            res.status(200).json({ message: 'Invoice deletada com sucesso' });
        } catch (error) {
            res.status(500).json({ message: 'Erro ao deletar invoice', error });
        }
    },

    // GET /invoices/supermarket/:supermarketId - Busca invoices de um supermercado específico
    async getBySupermarket(req: Request, res: Response) {
        try {
            const { supermarketId } = req.params;
            const invoices = await invoiceService.findBySupermarket(supermarketId);
            res.status(200).json(invoices);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar invoices do supermercado', error });
        }
    }
};
