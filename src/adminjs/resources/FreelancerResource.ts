import { ResourceWithOptions } from "adminjs";
import { Freelancer } from "../../models";

export const FreelancerResource: ResourceWithOptions = {
  resource: Freelancer,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      user_id: {
        isVisible: { list: false, edit: true, filter: true, show: true }
      },
      agency_id: {
        isVisible: { list: false, edit: true, filter: true, show: true }
      },
      name: {
        isTitle: true,
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      phone: {
        type: "string",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      document: {
        type: "string",
        isVisible: { list: false, edit: true, filter: true, show: true }
      },
      status: {
        availableValues: [
          { value: "active", label: "Ativo" },
          { value: "inactive", label: "Inativo" }
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
    editProperties: ["user_id", "agency_id", "name", "phone", "document", "status"],
    filterProperties: ["name", "phone", "document", "status", "createdAt", "updatedAt"],
    listProperties: ["name", "phone", "status"],
    showProperties: ["id", "user_id", "agency_id", "name", "phone", "document", "status", "createdAt", "updatedAt"]
  }
};

export default FreelancerResource;
