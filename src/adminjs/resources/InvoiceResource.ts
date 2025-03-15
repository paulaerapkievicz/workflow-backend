import { ResourceWithOptions } from "adminjs";
import { Invoice } from "../../models";

export const InvoiceResource: ResourceWithOptions = {
  resource: Invoice,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      supermarketId: {
        reference: "Supermarket",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      totalAmount: {
        type: "number",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      status: {
        availableValues: [
          { value: "pending", label: "Pendente" },
          { value: "paid", label: "Pago" },
          { value: "canceled", label: "Cancelado" }
        ],
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      createdAt: {
        type: "datetime",
        isVisible: { list: false, edit: false, filter: true, show: true }
      },
      updatedAt: {
        type: "datetime",
        isVisible: { list: false, edit: false, filter: true, show: true }
      }
    },
    editProperties: ["supermarketId", "totalAmount", "status"],
    filterProperties: ["supermarketId", "totalAmount", "status", "createdAt", "updatedAt"],
    listProperties: ["supermarketId", "totalAmount", "status"],
    showProperties: ["id", "supermarketId", "totalAmount", "status", "createdAt", "updatedAt"]
  }
};

export default InvoiceResource;
