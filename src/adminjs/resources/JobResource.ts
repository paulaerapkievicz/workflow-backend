import { ResourceWithOptions } from "adminjs";
import { Job } from "../../models";

export const JobResource: ResourceWithOptions = {
  resource: Job,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      supermarketId: {
        reference: "supermarkets",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      branchId: {
        reference: "branches",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      categoryId: {
        reference: "categories",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      freelancerId: {
        reference: "freelancers",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      title: {
        isTitle: true,
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      description: {
        type: "textarea",
        isVisible: { list: false, edit: true, filter: false, show: true }
      },
      status: {
        availableValues: [
          { value: "pending", label: "Disponível" },
          { value: "accepted", label: "Aceita" },
          { value: "in_progress", label: "Em andamento" },
          { value: "completed", label: "Concluída" },
          { value: "canceled", label: "Cancelada" }
        ],
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      photosRequired: { type: "boolean", isVisible: { list: false, edit: true, filter: true, show: true } },
      agencyReviewEnabled: { type: "boolean", isVisible: { list: false, edit: true, filter: true, show: true } },
      createdAt: {
        type: "datetime",
        isVisible: { list: false, edit: false, filter: true, show: true }
      },
      updatedAt: {
        type: "datetime",
        isVisible: { list: false, edit: false, filter: true, show: true }
      }
    },
    editProperties: ["supermarketId", "branchId", "categoryId", "freelancerId", "title", "description", "status"],
    filterProperties: ["supermarketId", "branchId", "categoryId", "freelancerId", "title", "status", "createdAt", "updatedAt"],
    listProperties: ["title", "supermarketId", "branchId", "categoryId", "freelancerId", "status"],
    showProperties: ["id", "supermarketId", "branchId", "categoryId", "freelancerId", "title", "description", "status", "createdAt", "updatedAt"]
  }
};

export default JobResource;
