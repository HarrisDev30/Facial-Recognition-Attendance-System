export type OrgType = 'college' | 'club' | 'office';
export type MemberType = 'student' | 'faculty' | 'staff';
export type OrgRole = 'admin' | 'marshal';

export interface Organization {
  id: string;
  name: string;
  code: string;
  org_type: OrgType;
  description?: string;
  member_count: number;
}

export interface OrganizationCreatePayload {
  name: string;
  code: string;
  org_type: OrgType;
  description?: string;
}

export interface OrgMember {
  id: string;
  identifier: string;
  first_name: string;
  last_name: string;
  email?: string;
  attendee_type: MemberType;
  role: string;
  joined_at?: string;
}

export interface MemberAddPayload {
  attendee_id: string;
  member_type: MemberType;
  role?: string;
}

export interface OrgStaff {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  org_role: OrgRole;
  created_at?: string;
}

export interface StaffAddPayload {
  user_id: string;
  org_role: OrgRole;
}
