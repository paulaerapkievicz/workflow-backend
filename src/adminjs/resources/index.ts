import {ResourceWithOptions } from "adminjs";

import AgencyResource from './AgencyResource';
import BranchResource from './BranchResource';
import CategoryResource from './CategoryResource';
import CommissionResource from './CommissionResource';
import FreelancerCategoryResource from './FreelancerCategoryResource';
import FreelancerResource from './FreelancerResource';
import InvoiceResource from './InvoiceResource';
import JobLogResource from './JobLogResource';
import JobResource from './JobResource';
import PaymentResource from './PaymentResource';
import ReviewResource from './ReviewResource';
import SessionResource from './SessionResource';
import SupermarketResource from './SupermarketResource';
import UserResource from './UserResource';

export const adminJsResources: ResourceWithOptions[] = [
  UserResource,
  SupermarketResource,
  BranchResource,
  AgencyResource,
  FreelancerResource,
  FreelancerCategoryResource,
  CategoryResource,
  JobResource,
  JobLogResource,
  ReviewResource,
  PaymentResource,
  InvoiceResource,
  CommissionResource,
  SessionResource
];

export default adminJsResources;