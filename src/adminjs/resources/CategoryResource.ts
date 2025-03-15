import { ResourceWithOptions } from "adminjs";
import { Category } from "../../models";

export const CategoryResource: ResourceWithOptions = {
  resource: Category,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      name: {
        isTitle: true,
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
    editProperties: ["name"],
    filterProperties: ["name", "createdAt", "updatedAt"],
    listProperties: ["name"],
    showProperties: ["id", "name", "createdAt", "updatedAt"]
  }
};

export default CategoryResource;
