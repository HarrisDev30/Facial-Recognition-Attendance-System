import client from './client';
import {
  Organization,
  OrganizationCreatePayload,
  OrgMember,
  MemberAddPayload,
  OrgType,
  MemberType,
  OrgStaff,
  StaffAddPayload,
} from '../types/organization';

export const getOrganizations = async (orgType?: OrgType): Promise<Organization[]> => {
  const params = orgType ? { org_type: orgType } : {};
  const response = await client.get<Organization[]>('/organizations', { params });
  return response.data;
};

export const getOrganization = async (id: string): Promise<Organization> => {
  const response = await client.get<Organization>(`/organizations/${id}`);
  return response.data;
};

export const createOrganization = async (
  payload: OrganizationCreatePayload
): Promise<Organization> => {
  const response = await client.post<Organization>('/organizations', payload);
  return response.data;
};

export const updateOrganization = async (
  id: string,
  payload: Partial<OrganizationCreatePayload>
): Promise<Organization> => {
  const response = await client.put<Organization>(`/organizations/${id}`, payload);
  return response.data;
};

export const deleteOrganization = async (id: string): Promise<void> => {
  await client.delete(`/organizations/${id}`);
};

export const getOrgMembers = async (
  orgId: string,
  memberType?: MemberType
): Promise<OrgMember[]> => {
  const params = memberType ? { member_type: memberType } : {};
  const response = await client.get<OrgMember[]>(`/organizations/${orgId}/members`, { params });
  return response.data;
};

export const addOrgMember = async (
  orgId: string,
  payload: MemberAddPayload
): Promise<void> => {
  await client.post(`/organizations/${orgId}/members`, payload);
};

export const removeOrgMember = async (
  orgId: string,
  attendeeId: string
): Promise<void> => {
  await client.delete(`/organizations/${orgId}/members/${attendeeId}`);
};

export const getOrgStaff = async (orgId: string): Promise<OrgStaff[]> => {
  const response = await client.get<OrgStaff[]>(`/organizations/${orgId}/staff`);
  return response.data;
};

export const addOrgStaff = async (
  orgId: string,
  payload: StaffAddPayload
): Promise<void> => {
  await client.post(`/organizations/${orgId}/staff`, payload);
};

export const removeOrgStaff = async (
  orgId: string,
  userId: string
): Promise<void> => {
  await client.delete(`/organizations/${orgId}/staff/${userId}`);
};
