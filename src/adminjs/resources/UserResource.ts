import { ResourceWithOptions } from 'adminjs';
import bcrypt from 'bcrypt';
import { User } from '../../models';

const hashPasswordBeforeSave = async (request: any) => {
  if (request?.payload?.password) {
    request.payload.passwordHash = await bcrypt.hash(request.payload.password, 10);
    delete request.payload.password;
  } else if (request?.payload) {
    // Evita sobrescrever o hash existente com vazio.
    delete request.payload.password;
  }
  return request;
};

export const UserResource: ResourceWithOptions = {
  resource: User,
  options: {
    navigation: 'Administração',
    properties: {
      id: { isVisible: { list: false, edit: false, filter: false, show: true } },
      name: {
        isTitle: true,
        isVisible: { list: true, edit: true, filter: true, show: true },
      },
      email: { isVisible: { list: true, edit: true, filter: true, show: true } },
      password: {
        type: 'password',
        isVisible: { list: false, edit: true, filter: false, show: false },
      },
      passwordHash: { isVisible: false },
      phone: {
        type: 'string',
        isVisible: { list: true, edit: true, filter: true, show: true },
      },
      birthDate: {
        type: 'date',
        isVisible: { list: false, edit: true, filter: true, show: true },
      },
      role: {
        availableValues: [
          { value: 'admin', label: 'Administrador' },
          { value: 'supermarket', label: 'Supermercado' },
          { value: 'freelancer', label: 'Freelancer' },
          { value: 'agency', label: 'Agência' },
        ],
        isVisible: { list: true, edit: true, filter: true, show: true },
      },
      createdAt: { type: 'datetime', isVisible: { list: false, edit: false, filter: true, show: true } },
      updatedAt: { type: 'datetime', isVisible: { list: false, edit: false, filter: true, show: true } },
    },
    editProperties: ['name', 'phone', 'birthDate', 'email', 'password', 'role'],
    filterProperties: ['name', 'phone', 'email', 'role', 'createdAt', 'updatedAt'],
    listProperties: ['name', 'email', 'phone', 'role'],
    showProperties: ['id', 'name', 'phone', 'birthDate', 'email', 'role', 'createdAt', 'updatedAt'],
    actions: {
      new: { before: hashPasswordBeforeSave },
      edit: { before: hashPasswordBeforeSave },
    },
  },
};

export default UserResource;
