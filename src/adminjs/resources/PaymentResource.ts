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
        reference: "jobs",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      freelancerId: {
        reference: "freelancers",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      amount: {
        type: "number",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      status: {
        availableValues: [
          { value: "settled", label: "Liberado" },
          { value: "canceled", label: "Cancelado" }
        ],
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      grossAmount: { type: "number", isVisible: { list: true, edit: false, filter: false, show: true } },
      agencyAmount: { type: "number", isVisible: { list: true, edit: false, filter: false, show: true } },
      freelancerAmount: { type: "number", isVisible: { list: true, edit: false, filter: false, show: true } },
      createdAt: {
        type: "datetime",
        isVisible: { list: false, edit: false, filter: true, show: true }
      },
      updatedAt: {
        type: "datetime",
        isVisible: { list: false, edit: false, filter: true, show: true }
      }
    },
    editProperties: ["status"],
    filterProperties: ["jobId", "freelancerId", "status", "createdAt", "updatedAt"],
    listProperties: ["jobId", "freelancerId", "grossAmount", "agencyAmount", "freelancerAmount", "status"],
    showProperties: ["id", "jobId", "freelancerId", "grossAmount", "agencyAmount", "freelancerAmount", "status", "paidAt", "releasedAt", "createdAt"]
  }
};

export default PaymentResource;
