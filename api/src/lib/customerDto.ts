import type { Customer } from '@/db/schema';

export type CustomerDto = Pick<
  Customer,
  | 'id'
  | 'fullName'
  | 'phone'
  | 'email'
  | 'region'
  | 'district'
  | 'subCounty'
  | 'parish'
  | 'village'
  | 'address'
>;

/** Explicit public projection: credential and internal fields never leave the API. */
export function toCustomerDto(customer: Customer): CustomerDto {
  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    region: customer.region,
    district: customer.district,
    subCounty: customer.subCounty,
    parish: customer.parish,
    village: customer.village,
    address: customer.address,
  };
}
