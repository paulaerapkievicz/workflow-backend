import { ResourceWithOptions } from "adminjs";
import { Branch } from "../../models";

export const BranchResource: ResourceWithOptions = {
  resource: Branch,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      supermarket_id: {
        isVisible: { list: false, edit: true, filter: true, show: true }
      },
      name: {
        isTitle: true,
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      address: {
        type: "string",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      phone: {
        type: "string",
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
    editProperties: ["supermarket_id", "name", "address", "phone"],
    filterProperties: ["name", "address", "phone", "createdAt", "updatedAt"],
    listProperties: ["name", "address", "phone"],
    showProperties: ["id", "supermarket_id", "name", "address", "phone", "createdAt", "updatedAt"]
  }
};

export default BranchResource;
