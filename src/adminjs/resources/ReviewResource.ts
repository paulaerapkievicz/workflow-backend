import { ResourceWithOptions } from "adminjs";
import { Review } from "../../models";

export const ReviewResource: ResourceWithOptions = {
  resource: Review,
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
      rating: {
        type: "number",
        isVisible: { list: true, edit: true, filter: true, show: true },
        availableValues: [
          { value: 1, label: "⭐" },
          { value: 2, label: "⭐⭐" },
          { value: 3, label: "⭐⭐⭐" },
          { value: 4, label: "⭐⭐⭐⭐" },
          { value: 5, label: "⭐⭐⭐⭐⭐" }
        ]
      },
      comment: {
        type: "textarea",
        isVisible: { list: false, edit: true, filter: true, show: true }
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
    editProperties: ["jobId", "freelancerId", "rating", "comment"],
    filterProperties: ["jobId", "freelancerId", "rating", "createdAt", "updatedAt"],
    listProperties: ["jobId", "freelancerId", "rating"],
    showProperties: ["id", "jobId", "freelancerId", "rating", "comment", "createdAt", "updatedAt"]
  }
};

export default ReviewResource;
