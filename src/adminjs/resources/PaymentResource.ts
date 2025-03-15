import { ResourceWithOptions } from "adminjs";
import { Payment } from "../../models";

export const PaymentResource: ResourceWithOptions = {
  resource: Payment,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      jobId: {
        reference: "Job",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      freelancerId: {
        reference: "Freelancer",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      amount: {
        type: "number",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      status: {
        availableValues: [
          { value: "pending", label: "Pendente" },
          { value: "paid", label: "Pago" },
          { value: "failed", label: "Falhou" }
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
    editProperties: ["jobId", "freelancerId", "amount", "status"],
    filterProperties: ["jobId", "freelancerId", "amount", "status", "createdAt", "updatedAt"],
    listProperties: ["jobId", "freelancerId", "amount", "status"],
    showProperties: ["id", "jobId", "freelancerId", "amount", "status", "createdAt", "updatedAt"]
  }
};

export default PaymentResource;
