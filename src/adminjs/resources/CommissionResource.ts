import { ResourceWithOptions } from "adminjs";
import { Commission } from "../../models";

export const CommissionResource: ResourceWithOptions = {
  resource: Commission,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      agencyId: {
        reference: "Agency",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      percentage: {
        type: "number",
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
    editProperties: ["agencyId", "percentage"],
    filterProperties: ["agencyId", "percentage", "createdAt", "updatedAt"],
    listProperties: ["agencyId", "percentage"],
    showProperties: ["id", "agencyId", "percentage", "createdAt", "updatedAt"]
  }
};

export default CommissionResource;
