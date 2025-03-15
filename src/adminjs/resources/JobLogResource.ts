import { ResourceWithOptions } from "adminjs";
import { JobLog } from "../../models";

export const JobLogResource: ResourceWithOptions = {
  resource: JobLog,
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
      status: {
        availableValues: [
          { value: "created", label: "Criado" },
          { value: "started", label: "Iniciado" },
          { value: "in_progress", label: "Em Andamento" },
          { value: "completed", label: "Concluído" },
          { value: "canceled", label: "Cancelado" }
        ],
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      timestamp: {
        type: "datetime",
        isVisible: { list: true, edit: false, filter: true, show: true }
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
    editProperties: ["jobId", "freelancerId", "status"],
    filterProperties: ["jobId", "freelancerId", "status", "timestamp", "createdAt", "updatedAt"],
    listProperties: ["jobId", "freelancerId", "status", "timestamp"],
    showProperties: ["id", "jobId", "freelancerId", "status", "timestamp", "createdAt", "updatedAt"]
  }
};

export default JobLogResource;
