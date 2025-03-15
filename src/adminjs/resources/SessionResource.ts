import { ResourceWithOptions } from "adminjs";
import { Session } from "../../models";

export const SessionResource: ResourceWithOptions = {
  resource: Session,
  options: {
    navigation: "Administração",
    properties: {
      id: {
        isVisible: { list: false, edit: false, filter: false, show: true }
      },
      userId: {
        reference: "User",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      token: {
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
    editProperties: ["userId"],
    filterProperties: ["userId", "token", "createdAt", "updatedAt"],
    listProperties: ["userId", "token"],
    showProperties: ["id", "userId", "token", "createdAt", "updatedAt"]
  }
};

export default SessionResource;
