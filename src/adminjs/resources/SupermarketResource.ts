import { ResourceWithOptions } from "adminjs";
import { Supermarket } from "../../models";

export const SupermarketResource: ResourceWithOptions = {
  resource: Supermarket,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      owner_id: {
        isVisible: { list: false, edit: true, filter: true, show: true }
      },
      name: {
        isTitle: true,
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      cnpj: {
        type: "string",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      phone: {
        type: "string",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      address: {
        type: "string",
        isVisible: { list: false, edit: true, filter: false, show: true }
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
    editProperties: ["owner_id", "name", "cnpj", "phone", "address"],
    filterProperties: ["name", "cnpj", "phone", "createdAt", "updatedAt"],
    listProperties: ["name", "cnpj", "phone"],
    showProperties: ["id", "owner_id", "name", "cnpj", "phone", "address", "createdAt", "updatedAt"]
  }
};

export default SupermarketResource;
