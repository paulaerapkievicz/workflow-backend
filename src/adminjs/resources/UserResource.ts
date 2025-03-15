import { ResourceWithOptions } from 'adminjs';
import { User } from '../../models';

export const UserResource: ResourceWithOptions = {
  resource: User,
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
      email: {
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      password: {
        type: "password",
        isVisible: {
          list: false,
          edit: true,
          filter: false,
          show: false
        }
      },
      phone: {
        type: "string",
        isVisible: { list: true, edit: true, filter: true, show: true }
      },
      birth_date: {
        type: "date",
        isVisible: { list: false, edit: true, filter: true, show: true }
      },
      role: {
        availableValues: [
          { value: "admin", label: "Administrador" },
          { value: "supermarket", label: "Supermercado" },
          { value: "freelancer", label: "Freelancer" },
          { value: "agency", label: "Agência" }
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
    editProperties: ["name", "phone", "birth_date", "email", "password", "role"],
    filterProperties: ["name", "phone", "birth_date", "email", "role", "createdAt", "updatedAt"],
    listProperties: ["name", "email", "phone", "role"],
    showProperties: ["id", "name", "phone", "birth_date", "email", "role", "createdAt", "updatedAt"]
  }
};

export default UserResource;
