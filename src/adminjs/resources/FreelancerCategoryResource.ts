import { ResourceWithOptions } from "adminjs";
import { FreelancerCategory } from "../../models";

export const FreelancerCategoryResource: ResourceWithOptions = {
  resource: FreelancerCategory,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      freelancer_id: {
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      category_id: {
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
    editProperties: ["freelancer_id", "category_id"],
    filterProperties: ["freelancer_id", "category_id", "createdAt", "updatedAt"],
    listProperties: ["freelancer_id", "category_id"],
    showProperties: ["id", "freelancer_id", "category_id", "createdAt", "updatedAt"]
  }
};

export default FreelancerCategoryResource;
