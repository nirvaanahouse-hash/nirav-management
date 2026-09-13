import { PermissionGroup } from '../constants/permissions';

export interface PermissionRegistryResponse {
  success: boolean;
  data: {
    groups: PermissionGroup[];
    all: string[];
    defaultUser: string[];
  };
}

export interface MyPermissionsResponse {
  success: boolean;
  data: {
    isSuperAdmin: boolean;
    permissions: string[];
  };
}

export interface UserPermissionsResponse {
  success: boolean;
  data: {
    isSuperAdmin: boolean;
    permissions: string[];
  };
}

export interface SetPermissionsResponse {
  success: boolean;
  message: string;
  data: { permissions: string[] };
}
